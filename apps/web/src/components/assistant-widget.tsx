"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { money, type Row } from "@/lib/store";
import { ProductImage } from "./product/product-image";
import styles from "./assistant-widget.module.css";

type Msg = {
  role: "user" | "assistant";
  text: string;
  cards?: Row[];
  sources?: string[];
  failed?: boolean;
};

const CHIPS = [
  "Phí ship bao nhiêu?",
  "Tư vấn quà tặng mẹ dưới 200k",
  "Chính sách đổi trả thế nào?",
];

const SOCIAL_LINKS = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61596519685169",
    icon: "/images/social/facebook.png",
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@goihue",
    icon: "/images/social/tiktok.png",
  },
] as const;

/** Minimal inline formatting for the assistant's plain markdown: **bold** and [label](href). */
function renderRich(text: string) {
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={k++}>{m[1]}</strong>);
    else
      parts.push(
        <Link key={k++} href={m[3]}>
          {m[2]}
        </Link>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function AssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  const showAssistant =
    pathname !== "/account" && !pathname.startsWith("/account/");
  const chatOpen = showAssistant && open;
  const onCart = pathname === "/cart";

  async function send(raw: string, base: Msg[] = messages) {
    const text = raw.trim();
    if (!text || streaming) return;
    setInput("");
    const history = base
      .filter((x) => !x.failed && x.text)
      .slice(-6)
      .map((x) => ({ role: x.role, content: x.text }));
    setMessages([
      ...base,
      { role: "user", text },
      { role: "assistant", text: "" },
    ]);
    setStreaming(true);
    const patchLast = (fn: (msg: Msg) => Msg) =>
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = fn(next[next.length - 1]);
        return next;
      });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const resp = await fetch("/api/store/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) throw new Error("bad response");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const ev = block.match(/^event:(.+)$/m)?.[1]?.trim();
          const dataLine = block.match(/^data:(.+)$/m)?.[1];
          if (!ev || dataLine === undefined) continue;
          let data: Record<string, unknown> = {};
          try {
            data = JSON.parse(dataLine) as Record<string, unknown>;
          } catch {
            continue;
          }
          if (ev === "token") {
            const delta = String(data.delta ?? "");
            patchLast((msg) => ({ ...msg, text: msg.text + delta }));
          } else if (ev === "product_cards") {
            patchLast((msg) => ({
              ...msg,
              cards: (data.items as Row[]) ?? [],
            }));
          } else if (ev === "citations") {
            patchLast((msg) => ({
              ...msg,
              sources: (data.sources as string[]) ?? [],
            }));
          } else if (ev === "correction") {
            patchLast((msg) => ({ ...msg, text: String(data.text ?? "") }));
          } else if (ev === "error") {
            patchLast((msg) => ({
              ...msg,
              failed: true,
              text: String(data.message ?? "Trợ lý đang bận, bạn thử lại nhé."),
            }));
          }
        }
      }
      patchLast((msg) =>
        msg.text
          ? msg
          : {
              ...msg,
              failed: true,
              text: "Trợ lý chưa trả lời được, bạn thử lại nhé.",
            },
      );
    } catch {
      patchLast((msg) => ({
        ...msg,
        failed: true,
        text: "Không kết nối được với trợ lý, bạn thử lại nhé.",
      }));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <>
      {chatOpen && (
        <section
          className={styles.panel}
          data-cart={onCart || undefined}
          aria-label="Trợ lý Gói Huế"
        >
          <header className={styles.head}>
            <span className={styles.mark} aria-hidden="true">
              G
            </span>
            <div className={styles.headText}>
              <h2>Trợ lý Gói Huế</h2>
              <p>Trả lời từ dữ liệu thật của cửa hàng</p>
            </div>
            <button
              type="button"
              className={styles.close}
              aria-label="Đóng trợ lý"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>
          <div className={styles.body} ref={scrollRef}>
            {messages.length === 0 && (
              <p className={styles.hint}>
                Xin chào, mình có thể tư vấn quà tặng Huế, tra phí giao hàng
                hoặc hỗ trợ tra cứu đơn hàng của bạn.
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={
                  msg.role === "user" ? styles.rowUser : styles.rowAssistant
                }
              >
                <div
                  className={
                    msg.role === "user" ? styles.bubbleUser : styles.bubbleBot
                  }
                >
                  {msg.role === "assistant" &&
                  streaming &&
                  i === messages.length - 1 &&
                  !msg.text ? (
                    <span className={styles.dots} aria-label="Đang trả lời">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : (
                    <span className={styles.text}>{renderRich(msg.text)}</span>
                  )}
                  {msg.cards && msg.cards.length > 0 && (
                    <div className={styles.cards}>
                      {msg.cards.map((p) => (
                        <Link
                          key={String(p.id)}
                          className={styles.card}
                          href={`/products/${String(p.slug)}`}
                        >
                          <span className={styles.thumb}>
                            <ProductImage
                              src={String(p.image ?? "")}
                              alt={String(p.name)}
                              fill
                              sizes="64px"
                            />
                          </span>
                          <span className={styles.cardBody}>
                            <span className={styles.cardName}>
                              {String(p.name)}
                            </span>
                            <span className={styles.cardMeta}>
                              {money(Number(p.price))} · Còn {Number(p.stock)}{" "}
                              hộp
                            </span>
                          </span>
                          <span className={styles.cardArrow} aria-hidden="true">
                            →
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                  {msg.sources && msg.sources.length > 0 && (
                    <p className={styles.source}>
                      Nguồn: {msg.sources.join(" · ")}
                    </p>
                  )}
                  {msg.failed && (
                    <button
                      type="button"
                      className={styles.retry}
                      onClick={() => {
                        const base = messages.slice(0, -2);
                        const lastUser = messages[messages.length - 2];
                        if (lastUser) void send(lastUser.text, base);
                      }}
                    >
                      Thử lại
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {messages.length === 0 && (
            <div className={styles.chips}>
              {CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => void send(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
          <form
            className={styles.inputRow}
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhắn cho trợ lý…"
              aria-label="Nhắn cho trợ lý"
              disabled={streaming}
            />
            <button
              type="submit"
              className={styles.sendBtn}
              aria-label="Gửi tin nhắn"
              disabled={streaming || !input.trim()}
            >
              ↑
            </button>
          </form>
        </section>
      )}
      <div
        className={styles.launcher}
        data-cart={onCart || undefined}
        data-chat-open={chatOpen || undefined}
      >
        <div className={styles.socialLinks}>
          {SOCIAL_LINKS.map(({ name, href, icon }) => (
            <a
              key={name}
              className={styles.fab}
              data-platform={name}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${name} Gói Huế (mở tab mới)`}
              title={name}
            >
              <Image src={icon} width={26} height={26} alt="" unoptimized />
            </a>
          ))}
        </div>
        {showAssistant && (
          <div className={styles.chatControls}>
            {!chatOpen && (
              <button
                type="button"
                className={styles.pill}
                onClick={() => setOpen(true)}
              >
                Hỏi trợ lý Gói Huế
              </button>
            )}
            <button
              type="button"
              className={styles.fab}
              aria-label={open ? "Đóng trợ lý" : "Mở trợ lý Gói Huế"}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? (
                "×"
              ) : (
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { api, ApiError, money, type Row, useStore } from "@/lib/store";
import { ProductImage } from "./product/product-image";
import { AiPreferences } from "./ai-preferences";
import styles from "./assistant-widget.module.css";

type Msg = {
  role: "user" | "assistant";
  text: string;
  cards?: Row[];
  sources?: string[];
  failed?: boolean;
  steps?: { id: string; name: string; summary?: string; ok?: boolean }[];
  request?: ChatRequest;
  comparison?: { items: Row[]; priceDifference: number };
};

type CartProposal = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  priceSource?: string;
  image: string;
  stock: number;
  quantity: number;
};

type ChatRequest = {
  message: string;
  conversationId: string;
  history: { role: string; content: string }[];
  key: string;
};

const TOOL_NAMES: Record<string, string> = {
  search_products: "Tìm theo tên và loại sản phẩm",
  recommend_products: "Tìm sản phẩm phù hợp",
  compare_products: "So sánh sản phẩm",
  add_to_cart: "Chuẩn bị thêm vào giỏ",
  get_shipping: "Kiểm tra phí giao hàng",
  lookup_order: "Tra cứu đơn của bạn",
  get_policy: "Tra cứu chính sách",
  get_memory: "Đọc sở thích đã ghi nhớ",
};

const CHIPS = [
  "Tôi muốn chọn một loại trà",
  "Tìm bánh mè xửng",
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
        <Link key={k++} href={/^\/(?!\/)/.test(m[3]) ? m[3] : "/products"}>
          {m[2]}
        </Link>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function SocialLinks() {
  return (
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
  );
}

export function AssistantWidget() {
  const pathname = usePathname();
  const { state, loading } = useStore();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  const onCart = pathname === "/cart";
  if (
    loading ||
    process.env.NEXT_PUBLIC_AI_CHAT_ENABLED === "false" ||
    pathname === "/account" ||
    pathname.startsWith("/account/")
  ) {
    return (
      <div className={styles.launcher} data-cart={onCart || undefined}>
        <SocialLinks />
      </div>
    );
  }
  return (
    <ChatSession
      key={state?.user?.id ?? "guest"}
      customer={state?.user?.role === "CUSTOMER"}
      onCart={onCart}
    />
  );
}

function ChatSession({
  customer,
  onCart,
}: {
  customer: boolean;
  onCart: boolean;
}) {
  const { state, mutate } = useStore();
  const [open, setOpen] = useState(false);
  const [proposal, setProposal] = useState<CartProposal | null>(null);
  const [proposalQty, setProposalQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const pendingProposal = useRef<CartProposal | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const conversation = useRef("");
  const generation = useRef(0);
  const [provider, setProvider] = useState("");
  const [historyLoading, setHistoryLoading] = useState(customer);
  const [historyError, setHistoryError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const sending = useRef(false);

  useEffect(() => {
    const chatGeneration = generation;
    const reset = () => {
      chatGeneration.current++;
      abortRef.current?.abort();
      conversation.current = "";
      sending.current = false;
      setStreaming(false);
      setMessages([]);
      setAttempt((value) => value + 1);
    };
    window.addEventListener("ai-preferences-changed", reset);
    return () => {
      window.removeEventListener("ai-preferences-changed", reset);
      chatGeneration.current++;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!customer) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setHistoryLoading(true);
      setHistoryError("");
      try {
        const history = await api("agent/history");
        if (active) {
          conversation.current = history.conversationId;
          setMessages(history.messages ?? []);
        }
      } catch {
        if (active) setHistoryError("Chưa tải được hội thoại đã lưu.");
      } finally {
        if (active) setHistoryLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [customer, attempt]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const chatOpen = open;
  function newConversation() {
    generation.current++;
    abortRef.current?.abort();
    conversation.current = crypto.randomUUID();
    sending.current = false;
    setStreaming(false);
    setMessages([]);
    setProvider("");
    pendingProposal.current = null;
    setProposal(null);
  }

  function noteLocal(text: string) {
    setMessages((prev) => [...prev, { role: "assistant", text }]);
  }

  async function confirmProposal() {
    if (!proposal || adding) return;
    const p = proposal;
    if (state && state.user.role !== "CUSTOMER") {
      setProposal(null);
      noteLocal("Tài khoản của bạn không dùng giỏ hàng khách.");
      return;
    }
    const prefix = state ? "" : "guest/";
    setAdding(true);
    try {
      const summary = await api(`${prefix}cart/summary`);
      const current = (summary.items as Row[]).find(
        (c) => c.productId === p.productId,
      );
      const next = Number(current?.quantity ?? 0) + proposalQty;
      if (
        !Number.isInteger(proposalQty) ||
        proposalQty < 1 ||
        next > Math.min(100, p.stock)
      )
        throw new Error("Số lượng vượt tồn kho hoặc giới hạn giỏ hàng.");
      await mutate(`${prefix}commerce`, "cart-set", {
        productId: p.productId,
        quantity: next,
        cartToken: summary.cartToken,
        ...(p.priceSource
          ? { expectedUnitPrice: p.price, expectedPriceSource: p.priceSource }
          : {}),
      });
      setProposal(null);
      noteLocal(`Đã thêm ${proposalQty} × ${p.name} vào giỏ hàng.`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setProposal(null);
        noteLocal(
          "Giá hoặc giỏ hàng vừa thay đổi. Bạn hãy yêu cầu lại để xem giá mới.",
        );
      } else {
        noteLocal("Chưa thêm được vào giỏ, bạn thử lại giúp mình nhé.");
      }
    } finally {
      setAdding(false);
    }
  }

  async function send(
    raw: string,
    base: Msg[] = messages,
    retry?: ChatRequest,
  ) {
    const text = raw.trim();
    if (!text || sending.current || historyLoading || historyError) return;
    sending.current = true;
    const currentGeneration = generation.current;
    setInput("");
    const history = base
      .filter((x) => !x.failed && x.text)
      .slice(-6)
      .map((x) => ({ role: x.role, content: x.text.slice(0, 1000) }));
    if (!conversation.current) conversation.current = crypto.randomUUID();
    const request = retry ?? {
      message: text,
      history,
      conversationId: conversation.current,
      key: crypto.randomUUID(),
    };
    setMessages([
      ...base,
      { role: "user", text },
      { role: "assistant", text: "", request },
    ]);
    setStreaming(true);
    const patchLast = (fn: (msg: Msg) => Msg) =>
      setMessages((prev) => {
        if (generation.current !== currentGeneration || prev.length === 0)
          return prev;
        const next = [...prev];
        next[next.length - 1] = fn(next[next.length - 1]);
        return next;
      });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const resp = await fetch("/api/store/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": request.key,
        },
        body: JSON.stringify({
          message: request.message,
          history: request.history,
          conversationId: request.conversationId,
        }),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) throw new Error("bad response");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const ev = block.match(/^event:(.+)$/m)?.[1]?.trim();
          const dataLine = block
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");
          if (!ev || !dataLine) continue;
          let data: Record<string, unknown> = {};
          try {
            data = JSON.parse(dataLine) as Record<string, unknown>;
          } catch {
            continue;
          }
          if (ev === "meta") {
            if (generation.current === currentGeneration)
              setProvider(String(data.provider ?? ""));
          } else if (ev === "tool_call") {
            patchLast((msg) => ({
              ...msg,
              steps: [
                ...(msg.steps ?? []),
                { id: String(data.id), name: String(data.name) },
              ],
            }));
          } else if (ev === "tool_result") {
            patchLast((msg) => ({
              ...msg,
              steps: (msg.steps ?? []).map((step) =>
                step.id === data.id
                  ? {
                      ...step,
                      summary: String(data.summary ?? ""),
                      ok: Boolean(data.ok),
                    }
                  : step,
              ),
            }));
          } else if (ev === "comparison") {
            patchLast((msg) => ({
              ...msg,
              comparison: {
                items: (data.items as Row[]) ?? [],
                priceDifference: Number(data.priceDifference ?? 0),
              },
            }));
          } else if (ev === "cart_proposal") {
            pendingProposal.current = {
              productId: String(data.productId ?? ""),
              slug: String(data.slug ?? ""),
              name: String(data.name ?? ""),
              price: Number(data.price ?? 0),
              priceSource:
                typeof data.priceSource === "string"
                  ? data.priceSource
                  : undefined,
              image: String(data.image ?? ""),
              stock: Number(data.stock ?? 0),
              quantity: Number(data.quantity ?? 1),
            };
          } else if (ev === "done") {
            completed = true;
            if (
              generation.current === currentGeneration &&
              pendingProposal.current
            ) {
              setProposal(pendingProposal.current);
              setProposalQty(Math.max(1, pendingProposal.current.quantity));
              pendingProposal.current = null;
            }
          } else if (ev === "memory") {
            if (generation.current === currentGeneration)
              window.dispatchEvent(new Event("ai-memory-updated"));
          } else if (ev === "token") {
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
        msg.text && completed
          ? msg
          : {
              ...msg,
              failed: true,
              text: msg.text || "Trợ lý chưa trả lời được, bạn thử lại nhé.",
            },
      );
    } catch {
      patchLast((msg) => ({
        ...msg,
        failed: true,
        text: "Không kết nối được với trợ lý, bạn thử lại nhé.",
      }));
    } finally {
      if (generation.current === currentGeneration) {
        setStreaming(false);
        sending.current = false;
        abortRef.current = null;
      }
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
              <p>
                {provider === "deterministic"
                  ? "Chế độ theo luật"
                  : provider === "bedrock"
                    ? "Bedrock · Gọi công cụ"
                    : provider === "replay"
                      ? "Hội thoại đã lưu"
                      : "Tư vấn từ dữ liệu cửa hàng"}
              </p>
            </div>
            <button
              type="button"
              className={styles.close}
              aria-label="Cuộc trò chuyện mới"
              title="Cuộc trò chuyện mới"
              disabled={historyLoading || Boolean(historyError)}
              onClick={newConversation}
            >
              ＋
            </button>
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
            <AiPreferences />
            {!customer && (
              <p className={styles.hint}>
                Đăng nhập để bật lưu lịch sử và ghi nhớ sở thích.
              </p>
            )}
            {historyLoading && <p role="status">Đang tải hội thoại…</p>}
            {historyError && (
              <p role="alert">
                {historyError}{" "}
                <button
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Thử lại
                </button>
              </p>
            )}
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
                  {msg.steps && msg.steps.length > 0 && (
                    <details
                      className={styles.trace}
                      open={streaming && i === messages.length - 1}
                    >
                      <summary>
                        {msg.steps.length} bước kiểm tra dữ liệu
                      </summary>
                      <ol>
                        {msg.steps.map((step) => (
                          <li key={step.id}>
                            <strong>
                              {TOOL_NAMES[step.name] ?? "Kiểm tra dữ liệu"}
                            </strong>
                            <p>{step.summary ?? "Đang kiểm tra…"}</p>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                  {msg.cards && msg.cards.length > 0 && !msg.comparison && (
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
                  {msg.comparison && msg.comparison.items.length >= 2 && (
                    <div className={styles.compare}>
                      <div className={styles.compareGrid}>
                        <span aria-hidden="true" />
                        {msg.comparison.items.slice(0, 2).map((p) => (
                          <span
                            key={String(p.id)}
                            className={styles.compareHead}
                          >
                            <span className={styles.compareThumb}>
                              <ProductImage
                                src={String(p.image ?? "")}
                                alt={String(p.name)}
                                fill
                                sizes="64px"
                              />
                            </span>
                            <span className={styles.compareName}>
                              {String(p.name)}
                            </span>
                          </span>
                        ))}
                        <span className={styles.compareLabel}>Giá</span>
                        {msg.comparison.items.slice(0, 2).map((p) => (
                          <span
                            key={String(p.id)}
                            className={styles.comparePrice}
                          >
                            {money(Number(p.price))}
                          </span>
                        ))}
                        <span className={styles.compareLabel}>Còn hàng</span>
                        {msg.comparison.items.slice(0, 2).map((p) => (
                          <span key={String(p.id)}>
                            Còn {Number(p.stock)} sản phẩm
                          </span>
                        ))}
                        <span className={styles.compareLabel}>Đã giao</span>
                        {msg.comparison.items.slice(0, 2).map((p) => (
                          <span key={String(p.id)}>
                            {Number(p.deliveredQuantity ?? 0)} sản phẩm
                          </span>
                        ))}
                      </div>
                      <p className={styles.compareDiff}>
                        Chênh lệch giá: {money(msg.comparison.priceDifference)}
                      </p>
                      <div className={styles.compareActions}>
                        {msg.comparison.items.slice(0, 2).map((p) => (
                          <Link
                            key={String(p.id)}
                            className={styles.compareBtn}
                            href={`/products/${String(p.slug)}`}
                          >
                            Xem sản phẩm
                          </Link>
                        ))}
                      </div>
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
                        const base = messages.slice(0, i - 1);
                        const lastUser = messages[i - 1];
                        if (lastUser)
                          void send(lastUser.text, base, msg.request);
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
                  disabled={
                    historyLoading || Boolean(historyError) || streaming
                  }
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
              disabled={streaming || historyLoading || Boolean(historyError)}
            />
            <button
              type="submit"
              className={styles.sendBtn}
              aria-label="Gửi tin nhắn"
              disabled={
                streaming ||
                historyLoading ||
                Boolean(historyError) ||
                !input.trim()
              }
            >
              ↑
            </button>
          </form>
        </section>
      )}
      {proposal && (
        <div
          className={styles.modalBackdrop}
          onClick={() => {
            if (!adding) setProposal(null);
          }}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Xác nhận thêm vào giỏ hàng"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Thêm vào giỏ hàng?</h3>
            <div className={styles.modalProduct}>
              <span className={styles.thumb}>
                <ProductImage
                  src={proposal.image}
                  alt={proposal.name}
                  fill
                  sizes="64px"
                />
              </span>
              <span className={styles.cardBody}>
                <span className={styles.cardName}>{proposal.name}</span>
                <span className={styles.cardMeta}>
                  {money(proposal.price)} · Còn {proposal.stock} sản phẩm
                </span>
              </span>
            </div>
            <div className={styles.modalQty}>
              <span>Số lượng</span>
              <span className={styles.stepper}>
                <button
                  type="button"
                  aria-label="Giảm số lượng"
                  disabled={adding || proposalQty <= 1}
                  onClick={() => setProposalQty((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <span aria-live="polite">{proposalQty}</span>
                <button
                  type="button"
                  aria-label="Tăng số lượng"
                  disabled={
                    adding || proposalQty >= Math.min(100, proposal.stock)
                  }
                  onClick={() =>
                    setProposalQty((q) =>
                      Math.min(Math.min(100, proposal.stock), q + 1),
                    )
                  }
                >
                  +
                </button>
              </span>
            </div>
            <p className={styles.modalTotal}>
              Tạm tính mục này:{" "}
              <strong>{money(proposal.price * proposalQty)}</strong>
            </p>
            <p className={styles.modalWarn}>
              Trợ lý chỉ đề xuất — bạn xác nhận thì món mới vào giỏ.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                disabled={adding}
                onClick={() => setProposal(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className={styles.modalConfirm}
                disabled={adding}
                onClick={() => void confirmProposal()}
              >
                {adding ? "Đang thêm…" : "Thêm vào giỏ"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        className={styles.launcher}
        data-cart={onCart || undefined}
        data-chat-open={chatOpen || undefined}
      >
        <SocialLinks />
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
      </div>
    </>
  );
}

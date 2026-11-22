"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, type Row } from "@/lib/store";
import { privacyArticles, returnArticles } from "./policy-content";
import styles from "./policies.module.css";

const policyPages = [
  { href: "/privacy-policy", label: "Bảo mật thông tin" },
  { href: "/return-policy", label: "Đổi trả & hoàn tiền" },
];

export function Policies({ returns = false }: { returns?: boolean }) {
  const articles = returns ? returnArticles : privacyArticles;
  const title = returns ? "Chính sách đổi trả" : "Chính sách bảo mật";
  const currentPath = returns ? "/return-policy" : "/privacy-policy";
  const [policy, setPolicy] = useState<Row | null>(null);
  const [metadataStatus, setMetadataStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [activeArticle, setActiveArticle] = useState("dieu-1");
  const [contentsOpen, setContentsOpen] = useState(false);
  const pageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (returns) return;
    let active = true;
    void api("policy").then((result) => {
      if (!active) return;
      setPolicy(result);
      setMetadataStatus("ready");
    }).catch(() => {
      if (active) setMetadataStatus("error");
    });
    return () => { active = false; };
  }, [returns, attempt]);

  useEffect(() => {
    let frame = 0;
    const header = document.querySelector("header");
    const syncHeaderOffset = () => {
      const offset = (header?.getBoundingClientRect().height ?? 88) + 24;
      const scrollPadding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      pageRef.current?.style.setProperty("--policy-header-offset", `${offset}px`);
      pageRef.current?.style.setProperty("--policy-anchor-offset", `${Math.max(0, offset - scrollPadding)}px`);
    };
    const observer = new ResizeObserver(syncHeaderOffset);
    if (header) observer.observe(header);
    syncHeaderOffset();
    const update = () => {
      frame = 0;
      const offset = (header?.getBoundingClientRect().bottom ?? 120) + 40;
      let current = articles[0].id;
      for (const article of articles) {
        const section = document.getElementById(article.id);
        if (section && section.getBoundingClientRect().top <= offset) current = article.id;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) current = articles.at(-1)!.id;
      setActiveArticle(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [articles]);

  return (
    <main ref={pageRef} className={styles.page} id="policy-top">
      <div className="gh-wrap">
        <nav className={styles.breadcrumb} aria-label="Đường dẫn trang">
          <Link href="/">Trang chủ</Link>
          <span aria-hidden="true">/</span>
          <span>Chính sách</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{returns ? "Đổi trả" : "Bảo mật"}</span>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className="gh-kicker">An tâm cùng Gói Huế</p>
            <h1>{title}</h1>
            <p className={styles.lead}>
              {returns
                ? "Đồng hành cùng bạn sau mỗi món quà, với thông tin đổi trả rõ ràng và dễ theo dõi."
                : "Trân trọng sự tin cậy của bạn, từ mỗi thông tin sẻ chia đến từng món quà được gửi trao."}
            </p>
          </div>
          <div className={styles.seal} aria-hidden="true">
            <span>GÓI HUẾ</span>
            <svg viewBox="0 0 48 48" fill="none">
              <path d="M24 5 39 11v12c0 9-7 16-15 20C16 39 9 32 9 23V11L24 5Z" />
              <path d="m17 24 5 5 10-11" />
            </svg>
            <span>TRỌN CHỮ TIN</span>
          </div>
        </header>

        <nav className={styles.policyTabs} aria-label="Các chính sách">
          {policyPages.map((item) => (
            <Link key={item.href} href={item.href} aria-current={currentPath === item.href ? "page" : undefined}>
              {item.label}<span aria-hidden="true">↗</span>
            </Link>
          ))}
        </nav>

        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <nav className={styles.contents} aria-label="Mục lục chính sách">
              <div className={styles.contentsHeading}>
                <span>Nội dung chính</span><span>01 — 07</span>
              </div>
              <button className={styles.contentsToggle} type="button" aria-expanded={contentsOpen}
                aria-controls="policy-contents" onClick={() => setContentsOpen((value) => !value)}>
                Nội dung chính <span>{contentsOpen ? "Thu gọn −" : "7 mục +"}</span>
              </button>
              <ol id="policy-contents" data-open={contentsOpen}>
                {articles.map((article, index) => (
                  <li key={article.id}>
                    <a href={`#${article.id}`} aria-current={activeArticle === article.id ? "location" : undefined}
                      onClick={() => setActiveArticle(article.id)}>
                      <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                      <span>{article.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
              <a className={styles.backToTop} href="#policy-top">Về đầu trang <span aria-hidden="true">↑</span></a>
            </nav>
            <div className={styles.support}>
              <p className={styles.eyebrow}>Gói Huế đồng hành</p>
              <h2>{returns ? "Cần hỗ trợ đơn hàng?" : "Thông tin của bạn"}</h2>
              <p>{returns ? "Theo dõi đơn hàng và gửi yêu cầu hỗ trợ tại tài khoản của bạn." : "Xem và gửi yêu cầu về dữ liệu cá nhân tại trung tâm quyền riêng tư."}</p>
              <Link href={returns ? "/account/orders" : "/account/privacy"}>
                {returns ? "Mở đơn hàng" : "Trung tâm quyền riêng tư"}<span aria-hidden="true">↗</span>
              </Link>
            </div>
          </aside>

          <div className={styles.document}>
            <div className={styles.draftNotice}>
              <span className={styles.draftBadge}>Bản dự thảo</span>
              <p>Chưa công bố hiệu lực chính thức. Nội dung đang chờ phê duyệt.</p>
              {!returns && (
                <div className={styles.metadata} aria-live="polite">
                  {metadataStatus === "loading" ? "Đang tải mã phiên bản…" : metadataStatus === "error" ? (
                    <><span>Chưa tải được mã phiên bản.</span><button type="button" onClick={() => { setMetadataStatus("loading"); setAttempt((value) => value + 1); }}>Thử lại</button></>
                  ) : <>Phiên bản: {String(policy?.version || "Chưa có mã phiên bản")}</>}
                </div>
              )}
            </div>

            <article className={styles.paper} aria-label={title}>
              {articles.map((article, index) => (
                <section key={article.id} id={article.id} className={styles.article} aria-labelledby={`${article.id}-title`}>
                  <div className={styles.articleHeading}>
                    <span className={styles.chapter} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <h2 id={`${article.id}-title`}>{article.title}</h2>
                  </div>
                  <div className={styles.copy}>{article.content}</div>
                </section>
              ))}
              <div className={styles.documentEnd} aria-hidden="true"><span />❖<span /></div>
              <p className={styles.signature}>Gói Huế · Nâng niu từng món quà, trân trọng từng niềm tin.</p>
              <Link className={styles.documentAction} href={returns ? "/account/orders" : "/account/privacy"}>
                {returns ? "Theo dõi đơn hàng của bạn" : "Quản lý dữ liệu cá nhân"}<span aria-hidden="true">↗</span>
              </Link>
            </article>
          </div>
        </div>
      </div>
    </main>
  );
}

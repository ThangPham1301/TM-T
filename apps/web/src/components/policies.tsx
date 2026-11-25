"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { policyInfo, policySections, type PolicyTopic, type PolicyVersion } from "@/lib/policies";
import { PolicyPreview } from "./policy-preview";
import styles from "./policies.module.css";

const policyPages = {
  privacy: {
    ...policyInfo.privacy,
    label: "Quyền riêng tư",
    lead: "Tìm hiểu thông tin Gói Huế xử lý và cách quản lý dữ liệu của bạn.",
    actions: [
      { href: "/account/privacy", label: "Trung tâm quyền riêng tư" },
      { href: "/tra-cuu-don-hang#ho-tro-don-hang", label: "Gửi yêu cầu cho đơn vãng lai" },
    ],
  },
  shipping: {
    ...policyInfo.shipping,
    label: "Đặt hàng & giao hàng",
    lead: "Xem cách đặt đơn, phí giao hàng, phương thức thanh toán và cách theo dõi đơn.",
    actions: [
      { href: "/tra-cuu-don-hang#ho-tro-don-hang", label: "Hỗ trợ đơn vãng lai" },
      { href: "/account/orders", label: "Đơn hàng của tôi" },
    ],
  },
  returns: {
    ...policyInfo.returns,
    label: "Đổi trả & hoàn tiền",
    lead: "Xem thời hạn, cách gửi yêu cầu và phương án xử lý khi sản phẩm có vấn đề.",
    actions: [
      { href: "/account/orders", label: "Mở đơn hàng" },
      { href: "/tra-cuu-don-hang#ho-tro-don-hang", label: "Hỗ trợ đổi trả đơn vãng lai" },
    ],
  },
} as const;

export function Policies({ kind, policy }: { kind: PolicyTopic; policy: PolicyVersion | null }) {
  const { title, label, href, lead, actions } = policyPages[kind];
  const articles = useMemo(() => policySections(policy?.content ?? ""), [policy]);
  const [activeArticle, setActiveArticle] = useState("dieu-1");
  const [contentsOpen, setContentsOpen] = useState(false);
  const pageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!articles.length) return;
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
          <span aria-current="page">{label}</span>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className="gh-kicker">An tâm cùng Gói Huế</p>
            <h1>{title}</h1>
            <p className={styles.lead}>{lead}</p>
            {policy && <p className={styles.version}>Phiên bản {policy.version}</p>}
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
          {Object.values(policyPages).map((item) => (
            <Link key={item.href} href={item.href} aria-current={href === item.href ? "page" : undefined}>
              {item.label}<span aria-hidden="true">↗</span>
            </Link>
          ))}
        </nav>

        {policy ? <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <nav className={styles.contents} aria-label="Mục lục chính sách">
              <div className={styles.contentsHeading}>
                <span>Nội dung chính</span><span>{articles.length} mục</span>
              </div>
              <button className={styles.contentsToggle} type="button" aria-expanded={contentsOpen}
                aria-controls="policy-contents" onClick={() => setContentsOpen((value) => !value)}>
                Nội dung chính <span>{contentsOpen ? "Thu gọn −" : `${articles.length} mục +`}</span>
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
            <nav className={styles.support} aria-label="Liên kết hỗ trợ">
              <h2>{kind === "privacy" ? "Quản lý dữ liệu cá nhân" : "Xem đơn hàng"}</h2>
              {actions.map((action) => (
                <Link key={action.href} href={action.href}>{action.label}<span aria-hidden="true">↗</span></Link>
              ))}
            </nav>
          </aside>

          <div className={styles.document}>
            <article className={styles.paper} aria-label={title}>
              {articles.map((article, index) => (
                <section key={article.id} id={article.id} className={styles.article} aria-labelledby={`${article.id}-title`}>
                  <div className={styles.articleHeading}>
                    <span className={styles.chapter} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <h2 id={`${article.id}-title`}>{article.title}</h2>
                  </div>
                  <PolicyPreview content={article.content} className={styles.copy} />
                </section>
              ))}
              <div className={styles.documentEnd} aria-hidden="true"><span />❖<span /></div>
              <div className={styles.documentActions}>
                {actions.map((action) => (
                  <Link key={action.href} className={styles.documentAction} href={action.href}>
                    {action.label}<span aria-hidden="true">↗</span>
                  </Link>
                ))}
              </div>
            </article>
          </div>
        </div> : (
          <section className={styles.unavailable} role="status">
            <p>Hiện chưa tải được chính sách. Vui lòng thử lại.</p>
            <button type="button" onClick={() => window.location.reload()}>Tải lại trang</button>
          </section>
        )}
      </div>
    </main>
  );
}

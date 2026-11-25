"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Row, useStore } from "@/lib/store";
import { productItem } from "@/lib/analytics-commerce";
import { trackEvent } from "@/lib/analytics";
import { useExposure } from "@/lib/analytics-visibility";
import { ProductImage } from "./product/product-image";
import { ProductPrice } from "./pricing/price-display";
import styles from "./recommendation-rail.module.css";

type Props = { surface: "home" | "cart"; refreshKey?: string; categories?: Row[] };

export function RecommendationRail(props: Props) {
  const { state } = useStore();
  if (process.env.NEXT_PUBLIC_RECOMMENDATIONS_ENABLED === "false") return null;
  return <Rail key={state?.user?.id ?? "guest"} {...props} />;
}

function Suggestion({ product, category, index }: { product: Row; category: string; index: number }) {
  const params = { item_list_id: "cart_recommendations", item_list_name: "Gợi ý cho giỏ hàng",
    items: [{ ...productItem(product), item_list_id: "cart_recommendations", item_list_name: "Gợi ý cho giỏ hàng", index }] };
  const exposure = useExposure<HTMLElement>("view_item_list", params, `cart_recommendations:cart:${product.id}`);
  const href = `/products/${product.slug}`;
  return <article ref={exposure} className={styles.card} onClickCapture={event => {
    if ((event.target as Element).closest("a[href]")) trackEvent("select_item", params);
  }}>
    <Link href={href} className={styles.image} tabIndex={-1} aria-hidden="true">
      <ProductImage fill src={String(product.image ?? "")} alt="" sizes="96px" />
    </Link>
    <div className={styles.copy}>
      <small>{category}</small>
      <h3><Link href={href}>{String(product.name)}</Link></h3>
      <div className={styles.price}><ProductPrice product={product} /></div>
      <Link className={styles.link} href={href} aria-label={`Xem sản phẩm ${product.name}`}>Xem thức quà <span aria-hidden="true">↗</span></Link>
    </div>
  </article>;
}

function Rail({ surface, refreshKey, categories = [] }: Props) {
  const [items, setItems] = useState<Row[]>([]);
  const [strategy, setStrategy] = useState("");
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const changed = () => setAttempt(value => value + 1);
    window.addEventListener("ai-preferences-changed", changed);
    return () => window.removeEventListener("ai-preferences-changed", changed);
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setStatus("loading");
      try {
        const response = await api(`products/recommended?surface=${surface}&limit=4`);
        if (active) { setItems(response.items ?? []); setStrategy(String(response.strategy)); setStatus("ready"); }
      } catch { if (active) setStatus("error"); }
    });
    return () => { active = false; };
  }, [surface, refreshKey, attempt]);

  const title = surface === "cart" ? "Gợi ý thêm cho giỏ hàng" : strategy === "PERSONALIZED" ? "Gợi ý cho bạn" : "Gợi ý từ cửa hàng";
  return <section className={styles.rail} aria-label="Gợi ý sản phẩm">
    <header className={styles.heading}><div><span className={styles.eyebrow}>Thêm một chút hương Huế</span><h2>{title}</h2>
      <p>{strategy === "PERSONALIZED" ? "Dựa trên danh mục bạn từng mua và lựa chọn cá nhân hóa."
        : strategy === "BOUGHT_TOGETHER" ? "Thường được mua cùng trong các đơn đã giao." : "Một vài thức quà để bạn cân nhắc thêm."}</p>
    </div><Link className={styles.all} href="/products">Bộ sưu tập <span aria-hidden="true">↗</span></Link></header>
    {status === "loading" && <p className={styles.state} role="status">Đang chọn thức quà gợi ý…</p>}
    {status === "error" && <div className={styles.state} role="status">Chưa tải được gợi ý. <button type="button" onClick={() => setAttempt(value => value + 1)}>Thử lại</button></div>}
    {status === "ready" && !items.length && <p className={styles.state}>Chưa có sản phẩm còn hàng phù hợp để gợi ý thêm.</p>}
    {status === "ready" && items.length > 0 && <div className={styles.grid}>
      {items.map((product, index) => <Suggestion key={product.id} product={product} index={index}
        category={String(categories.find(category => category.code === product.category)?.name ?? "Đặc sản Huế")} />)}
    </div>}
  </section>;
}

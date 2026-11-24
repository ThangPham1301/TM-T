"use client";
import Link from "next/link";
import { productItem } from "@/lib/analytics-commerce";
import { trackEvent } from "@/lib/analytics";
import { useExposure } from "@/lib/analytics-visibility";
import type { Row } from "@/lib/store";
import { priceSource } from "@/lib/pricing";
import { ProductPrice } from "../pricing/price-display";
import { ProductImage } from "./product-image";
import type { Offer } from "@/lib/discounts";
import { ProductOffer } from "../discounts/offer-display";
export const ART = "/goi-hue/assets/";
export function ProductCard({
  product: p,
  category,
  offer,
  list = { id: "catalog", name: "Danh mục sản phẩm", instance: "catalog", index: 0 },
}: {
  product: Row;
  category?: string;
  offer?: Offer;
  list?: { id: string; name: string; instance: string; index: number };
}) {
  const item = { ...productItem(p), item_list_id: list.id, item_list_name: list.name, index: list.index };
  const params = { item_list_id: list.id, item_list_name: list.name, items: [item] };
  const exposure = useExposure<HTMLElement>("view_item_list", params, `${list.id}:${list.instance}:${p.id}`);
  return (
    <article ref={exposure} className="lan-product lan-frame" onClickCapture={event => {
      if ((event.target as Element).closest("a[href]")) trackEvent("select_item", params);
    }}>
      <Link href={`/products/${p.slug}`} className="lan-product-photo">
        <ProductImage
          fill
          src={String(p.image ?? "")}
          alt={String(p.name)}
          sizes="(max-width:600px) 90vw,(max-width:1000px) 44vw,28vw"
        />
      </Link>
      <div className="lan-product-copy">
        <small>{category ?? String(p.category ?? "Đặc sản Huế")}</small>
        <h3>
          <Link href={`/products/${p.slug}`}>{String(p.name)}</Link>
        </h3>
        <p>{String(p.description ?? "")}</p>
        {Number(p.stock) > 0 && (priceSource(p)?.source ?? "BASE") === "BASE" && <ProductOffer offer={offer} />}
        <div>
          <ProductPrice product={p} />
          <Link className="lan-button" href={`/products/${p.slug}`}>
            Chọn mua →
          </Link>
        </div>
      </div>
    </article>
  );
}
export function CollectionStory() {
  return (
    <section className="lan-story-cta lan-frame">
      <small>CHUYỆN CỐ ĐÔ</small>
      <h2>Hương sắc sông Hương trong từng nếp gói</h2>
      <p>Khám phá những thức quà và câu chuyện phong vị xứ Huế.</p>
      <Link className="lan-button lan-button-paper" href="/cau-chuyen-hue">
        Đọc câu chuyện Huế →
      </Link>
    </section>
  );
}
export function LoadState({
  loading,
  error,
  empty,
  retry,
}: {
  loading: boolean;
  error: string;
  empty: boolean;
  retry: () => void;
}) {
  if (loading)
    return (
      <p className="lan-state" role="status">
        Đang tải sản phẩm…
      </p>
    );
  if (error)
    return (
      <div className="lan-state" role="alert">
        <p>{error}</p>
        <button className="lan-button" onClick={retry}>
          Thử lại
        </button>
      </div>
    );
  if (empty) return <p className="lan-state">Chưa có sản phẩm phù hợp.</p>;
  return null;
}

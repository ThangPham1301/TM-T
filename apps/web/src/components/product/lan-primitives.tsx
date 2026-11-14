import Link from "next/link";
import { money, type Row } from "@/lib/store";
import { ProductImage } from "./product-image";
export const ART = "/goi-hue/assets/";
export function ProductCard({ product: p, category }: { product: Row; category?: string }) {
  return <article className="lan-product lan-frame"><Link href={`/products/${p.slug}`} className="lan-product-photo"><ProductImage fill src={String(p.image ?? "")} alt={String(p.name)} sizes="(max-width:600px) 90vw,(max-width:1000px) 44vw,28vw" /></Link><div className="lan-product-copy"><small>{category ?? String(p.category ?? "Đặc sản Huế")}</small><h3><Link href={`/products/${p.slug}`}>{String(p.name)}</Link></h3><p>{String(p.description ?? "")}</p><div><strong>{money(p.price)}</strong><Link className="lan-button" href={`/products/${p.slug}`}>Chọn mua →</Link></div></div></article>;
}
export function CollectionStory() {
  return <section className="lan-story-cta lan-frame"><small>CHUYỆN CỐ ĐÔ</small><h2>Hương sắc sông Hương trong từng nếp gói</h2><p>Khám phá những thức quà và câu chuyện phong vị xứ Huế.</p><Link className="lan-button lan-button-paper" href="/#heritage-story">Đọc câu chuyện Huế →</Link></section>;
}
export function LoadState({ loading, error, empty, retry }: {loading: boolean; error: string; empty: boolean; retry: () => void}) {
  if (loading) return <p className="lan-state" role="status">Đang tải sản phẩm…</p>;
  if (error) return <div className="lan-state" role="alert"><p>{error}</p><button className="lan-button" onClick={retry}>Thử lại</button></div>;
  if (empty) return <p className="lan-state">Chưa có sản phẩm phù hợp.</p>;
  return null;
}

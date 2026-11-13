"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fields, money, type Row, useStore } from "@/lib/store";
import { ProductImage } from "./product/product-image";

export function Catalog({ slug }: { slug?: string }) {
  const [products, setProducts] = useState<Row[]>([]),
    [categories, setCategories] = useState<Row[]>([]),
    [searchTerm, setSearchTerm] = useState(""),
    [categoryCode, setCategoryCode] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const { state, busy, run, mutate } = useStore();
  const router = useRouter();
  useEffect(() => {
    let active = true;
    void Promise.all([
      api(slug ? `products/${encodeURIComponent(slug)}` : "products"),
      api("categories"),
    ])
      .then(([data, categoryRows]) => {
        if (!active) return;
        let rows: Row[] = slug ? [data] : data;
        const query = new URLSearchParams(window.location.search),
          q = query.get("q")?.toLocaleLowerCase("vi"),
          category = query.get("category");
        if (q)
          rows = rows.filter((p) =>
            String(p.name).toLocaleLowerCase("vi").includes(q),
          );
        if (category) rows = rows.filter((p) => p.category === category);
        setCategories(categoryRows);
        setSearchTerm(query.get("q") ?? "");
        setCategoryCode(category ?? "");
        setProducts(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);
  function add(p: Row, quantity: number) {
    if (!state) {
      router.push("/login");
      return;
    }
    void run(async () => {
      const summary = await api("cart/summary");
      const cart: Row[] = summary.items;
      const current = cart.find((c) => c.productId === p.id);
      await mutate("commerce", "cart-set", {
        productId: p.id,
        quantity: Number(current?.quantity ?? 0) + quantity,
        cartToken: summary.cartToken,
      });
    });
  }
  return (
    <main className="store-page">
      <div className="store-heading">
        <span className="eyebrow">Tinh tuyển phong vị Huế</span>
        <h1>
          {slug
            ? String(products[0]?.name ?? "Chi tiết sản phẩm")
            : "Bộ sưu tập Gói Huế"}
        </h1>
        <p>Bánh mứt, mè xửng và quà biếu cho những khoảnh khắc sum vầy.</p>
      </div>
      {!slug && (
        <form action="/products" className="store-filters">
          <label>
            Tìm sản phẩm
            <input
              name="q"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>
          <label>
            Danh mục
            <select
              name="category"
              value={categoryCode}
              onChange={(e) => setCategoryCode(e.target.value)}
            >
              <option value="">Tất cả</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.code)}>
                  {String(c.name)}
                </option>
              ))}
            </select>
          </label>
          <button>Tìm kiếm</button>
        </form>
      )}
      {loading && <p aria-busy="true">Đang tải sản phẩm…</p>}
      {error && <p className="store-error">{error}</p>}
      {!loading && !error && !products.length && (
        <p>Chưa có sản phẩm phù hợp.</p>
      )}
      <div
        className={
          slug ? "store-product-detail" : "heritage-products store-products"
        }
      >
        {products.map((p) => (
          <article key={p.id}>
            <Link className="product-visual" href={`/products/${p.slug}`}>
              <ProductImage
                src={String(p.image)}
                alt={String(p.name)}
                width={700}
                height={500}
              />
            </Link>
            <div className="store-product-content">
              <small className="store-product-category">
                {String(
                  categories.find((c) => c.code === p.category)?.name ??
                    p.category,
                )}
              </small>
              <Link className="product-name" href={`/products/${p.slug}`}>
                {String(p.name)}
              </Link>
              <p className="store-product-description">
                {String(p.description)}
              </p>
              <div className="store-product-meta">
                <strong>{money(p.price)}</strong>
                <span>Còn {String(p.stock)} sản phẩm</span>
              </div>
              <form
                onSubmit={(e) => {
                  const b = fields(e);
                  add(p, Number(b.quantity));
                }}
              >
                <label className="sr-only" htmlFor={`qty-${p.id}`}>
                  Số lượng
                </label>
                <input
                  id={`qty-${p.id}`}
                  name="quantity"
                  type="number"
                  min={1}
                  max={Math.min(100, Number(p.stock))}
                  defaultValue={1}
                />
                <button disabled={busy || Number(p.stock) <= 0}>
                  ♧ Thêm vào giỏ
                </button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

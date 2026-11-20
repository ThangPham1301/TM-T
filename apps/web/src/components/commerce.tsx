"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Row } from "@/lib/store";
import { offerForProduct } from "@/lib/discounts";
import { applyPricing, priceSource } from "@/lib/pricing";
import { usePricing } from "./pricing/use-pricing";
import { usePublicOffers } from "./discounts/use-public-offers";
import {
  ProductCard,
  LoadState,
  CollectionStory,
} from "./product/lan-primitives";
import { ProductDetail } from "./product/product-detail";
import { Pagination } from "./workspace-nav";

export function Catalog({ slug }: { slug?: string }) {
  return slug ? <ProductDetail slug={slug} /> : <Collection />;
}
function Collection() {
  const offers = usePublicOffers();
  const { feed } = usePricing();
  const [scheduled, setScheduled] = useState(false);
  const [discountId, setDiscountId] = useState("");
  const group = offers.find(
    (offer) => offer.scope === "PRODUCTS" && offer.id === discountId,
  );
  const [products, setProducts] = useState<Row[]>([]),
    [categories, setCategories] = useState<Row[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [price, setPrice] = useState(""),
    [stock, setStock] = useState(false),
    [sort, setSort] = useState("original"),
    [page, setPage] = useState(1),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.all([api("products"), api("categories")])
      .then(([p, c]) => {
        if (!live) return;
        const params = new URLSearchParams(window.location.search);
        setProducts(p);
        setCategories(c);
        setCategory(params.get("category") ?? "");
        setQuery(params.get("q") ?? "");
        setDiscountId(params.get("discount") ?? "");
        setScheduled(params.get("pricing") === "scheduled");
        setError("");
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [attempt]);
  const normalize = (s: unknown) =>
    String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLocaleLowerCase("vi");
  const filtered = products.map((product) => applyPricing(product, feed)).filter(
    (p) =>
      (!scheduled || (Number(p.stock) > 0 && priceSource(p)?.source === "SCHEDULE")) &&
      (!group || group.productIds?.includes(p.id)) &&
      (!query ||
        normalize(`${p.name} ${p.description}`).includes(normalize(query))) &&
      (!category || p.category === category) &&
      (!stock || Number(p.stock) > 0) &&
      (!price ||
        (price === "0"
          ? Number(p.price) < 50000
          : price === "1"
            ? Number(p.price) >= 50000 && Number(p.price) <= 100000
            : price === "2"
              ? Number(p.price) > 100000 && Number(p.price) <= 200000
              : Number(p.price) > 200000)),
  );
  if (sort !== "original")
    filtered.sort((a, b) =>
      sort === "asc"
        ? Number(a.price) - Number(b.price)
        : Number(b.price) - Number(a.price),
    );
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / 9))),
    rows = filtered.slice((current - 1) * 9, current * 9);
  function reset() {
    setQuery("");
    setDiscountId("");
    setScheduled(false);
    setCategory("");
    setPrice("");
    setStock(false);
    setPage(1);
    window.history.replaceState(null, "", "/products");
  }
  return (
    <main className="lan-page lan-collection">
      <nav className="lan-breadcrumb" aria-label="Đường dẫn">
        <Link href="/">Trang chủ</Link>
        <span>/</span>
        <span aria-current="page">Bộ sưu tập đặc sản</span>
      </nav>
      <header className="lan-collection-intro">
        <small>MỸ VỊ TIẾN CUNG & THỨC QUÀ DÂN GIAN</small>
        <h1>Bộ Sưu Tập Gói Huế</h1>
        <p>
          Tuyển lựa những thức quà trứ danh xứ Kinh kỳ — từ mạch nha mè rang,
          hạt sen đến trà và những hộp quà gửi người thương.
        </p>
        <span>Đặc sản và quà biếu từ Huế</span>
      </header>
      <div className="lan-toolbar">
        <p>
          Hiển thị: <strong>{filtered.length} sản phẩm</strong>
        </p>
        <label>
          Sắp xếp
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="original">Thứ tự bộ sưu tập</option>
            <option value="asc">Giá: Thấp đến Cao</option>
            <option value="desc">Giá: Cao đến Thấp</option>
          </select>
        </label>
      </div>
      <div className="lan-active-filters" aria-label="Bộ lọc đang áp dụng">
        <span>
          Đang lọc:{" "}
          {String(
            categories.find((c) => c.code === category)?.name ??
              "Tất cả đặc sản",
          )}
        </span>
        {group && (
          <button
            type="button"
            onClick={() => {
              setDiscountId("");
              setPage(1);
              const url = new URL(window.location.href);
              url.searchParams.delete("discount");
              window.history.replaceState(null, "", url);
            }}
          >
            {group.name} ×
          </button>
        )}
        {scheduled && <button type="button" onClick={() => {
          setScheduled(false);
          setPage(1);
          const url = new URL(window.location.href);
          url.searchParams.delete("pricing");
          window.history.replaceState(null, "", url);
        }}>Giá giờ vàng ×</button>}
        {query && (
          <button onClick={() => setQuery("")}>Từ khóa: {query} ×</button>
        )}
        {price && <button onClick={() => setPrice("")}>Khoảng giá ×</button>}
        {stock && <button onClick={() => setStock(false)}>Còn hàng ×</button>}
        <button onClick={reset}>Xóa tất cả bộ lọc</button>
      </div>
      <div className="lan-collection-grid">
        <aside className="lan-filter lan-frame">
          <h2>Bộ Lọc Tinh Chọn</h2>
          <label>
            Tìm đặc sản
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Mè xửng, trà Huế…"
            />
          </label>
          <fieldset>
            <legend>Danh mục sản phẩm</legend>
            <label>
              <input
                type="radio"
                name="category"
                checked={!category}
                onChange={() => {
                  setCategory("");
                  setPage(1);
                }}
              />
              Tất cả đặc sản ({products.length})
            </label>
            {categories.map((c) => (
              <label key={c.id}>
                <input
                  type="radio"
                  name="category"
                  checked={category === c.code}
                  onChange={() => {
                    setCategory(String(c.code));
                    setPage(1);
                  }}
                />
                {String(c.name)} (
                {products.filter((p) => p.category === c.code).length})
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Khoảng giá (VNĐ)</legend>
            {[
              ["", "Tất cả mức giá"],
              ["0", "Dưới 50.000 đ"],
              ["1", "50.000 đ – 100.000 đ"],
              ["2", "100.000 đ – 200.000 đ"],
              ["3", "Trên 200.000 đ"],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="price"
                  checked={price === value}
                  onChange={() => {
                    setPrice(value);
                    setPage(1);
                  }}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Trạng thái sản phẩm</legend>
            <label>
              <input
                type="checkbox"
                checked={stock}
                onChange={(e) => {
                  setStock(e.target.checked);
                  setPage(1);
                }}
              />
              Còn hàng tại xưởng
            </label>
          </fieldset>
        </aside>
        <div>
          <LoadState
            loading={loading}
            error={error}
            empty={!rows.length}
            retry={() => {
              setLoading(true);
              setAttempt(attempt + 1);
            }}
          />
          {!loading && !error && !rows.length && (
            <button className="lan-button lan-button-paper" onClick={reset}>
              Đặt lại bộ lọc
            </button>
          )}
          <div className="lan-products">
            {rows.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                offer={offerForProduct(offers, p.id)}
                category={String(
                  categories.find((c) => c.code === p.category)?.name ??
                    p.category,
                )}
              />
            ))}
          </div>
          {!loading && !error && (
            <Pagination
              page={current}
              total={filtered.length}
              pageSize={9}
              onChange={setPage}
            />
          )}
        </div>
      </div>
      <CollectionStory />
    </main>
  );
}

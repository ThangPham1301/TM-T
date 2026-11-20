"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, money, type Row, useStore } from "@/lib/store";
import { ProductImage } from "./product-image";
import { LoadState, ProductCard } from "./lan-primitives";

const tabs = [
  "Câu chuyện phong vị",
  "Thông số & Thành phần",
  "Thưởng thức & Bảo quản",
];

// Thông số hiển thị của từng sản phẩm (hardcode tạm thời vì DB chưa có các trường này).
const SPECS: Record<
  string,
  {
    packaging?: string;
    weight?: string;
    ingredients?: string;
    shelfLife?: string;
    origin?: string;
    storage?: string;
  }
> = {
  "me-xung-gion-ngu-tien-300g": {
    packaging: "Hộp 300g",
    weight: "300g",
    ingredients: "Mè rang, đậu phộng, mạch nha",
    shelfLife: "In trên bao bì sản phẩm",
    origin: "Huế, Việt Nam",
    storage:
      "Dùng trực tiếp hoặc dùng kèm trà nóng. Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp; sau khi mở nên đậy kín để giữ độ giòn.",
  },
  "me-xung-deo-cung-dinh-300g": {
    packaging: "Hộp 300g",
    weight: "300g",
    ingredients: "Mè rang, đậu phộng, mạch nha",
    shelfLife: "In trên bao bì sản phẩm",
    origin: "Huế, Việt Nam",
    storage:
      "Dùng trực tiếp hoặc dùng kèm trà nóng. Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp; đậy kín sau khi mở để giữ độ dẻo mềm.",
  },
  "mut-hat-sen-tinh-tam-300g": {
    packaging: "Hũ 300g",
    weight: "300g",
    ingredients: "Hạt sen, đường",
    shelfLife: "In trên bao bì sản phẩm",
    origin: "Huế, Việt Nam",
    storage:
      "Dùng trực tiếp như món ăn vặt hoặc dùng kèm trà nóng. Bảo quản nơi khô ráo, thoáng mát; đậy kín nắp sau khi mở.",
  },
  "tra-cung-dinh-100g": {
    packaging: "Hộp giấy 100g",
    weight: "100g",
    ingredients: "Các loại thảo mộc phối trộn theo phong cách trà cung đình Huế",
    shelfLife: "In trên bao bì sản phẩm",
    origin: "Huế, Việt Nam",
    storage:
      "Cho trà vào ấm, chế nước nóng, đợi vài phút cho trà ngấm rồi thưởng thức; có thể pha lại nhiều lần trong ngày. Bảo quản nơi khô ráo, tránh ẩm và tránh để gần nơi có mùi mạnh.",
  },
  "mut-gung-hue-200g": {
    packaging: "Hộp 200g",
    weight: "200g",
    ingredients: "Gừng tươi, đường",
    shelfLife: "In trên bao bì sản phẩm",
    origin: "Huế, Việt Nam",
    storage:
      "Dùng trực tiếp hoặc dùng kèm trà nóng. Bảo quản nơi khô ráo, thoáng mát; đậy kín sau khi mở để giữ hương gừng.",
  },
  "me-xung-gion-ngu-tien-150g": {
    packaging: "Gói 150g (10 miếng × 15g)",
    weight: "150g",
    ingredients: "Mè rang, đậu phộng, mạch nha",
    shelfLife: "In trên bao bì sản phẩm",
    origin: "Huế, Việt Nam",
    storage:
      "Dùng trực tiếp hoặc dùng kèm trà nóng, tiện mang theo. Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp để giữ độ giòn.",
  },
  "me-xung-deo-cung-dinh-150g": {
    packaging: "Gói 150g",
    weight: "150g",
    ingredients: "Mè rang, đậu phộng, mạch nha",
    shelfLife: "In trên bao bì sản phẩm",
    origin: "Huế, Việt Nam",
    storage:
      "Dùng trực tiếp hoặc dùng kèm trà nóng. Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp; sau khi mở nên dùng sớm để giữ độ dẻo ngon.",
  },
  "hop-qua-di-san-co-do-900g": {
    packaging: "Hộp quà 900g (3 hộp 300g bên trong)",
    weight: "900g",
    ingredients:
      "Mè Xửng Giòn Ngự Tiến 300g, Mè Xửng Dẻo Cung Đình 300g, Mứt Hạt Sen Tịnh Tâm 300g",
    shelfLife: "In trên bao bì sản phẩm",
    origin: "Huế, Việt Nam",
    storage:
      "Các món được đóng gói riêng bên trong, dùng dần theo nhu cầu. Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp.",
  },
  "hop-qua-doan-vien-400g": {
    packaging: "Hộp quà 400g",
    weight: "400g",
    ingredients: "Các món đặc sản Huế tuyển chọn, đóng gói riêng bên trong hộp",
    shelfLife: "In trên bao bì sản phẩm",
    origin: "Huế, Việt Nam",
    storage:
      "Các món được đóng gói riêng bên trong, dùng dần theo nhu cầu. Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp.",
  },
};
export function ProductDetail({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Row | null>(null),
    [related, setRelated] = useState<Row[]>([]),
    [categories, setCategories] = useState<Row[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [missing, setMissing] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [quantity, setQuantity] = useState(1),
    [tab, setTab] = useState(0);
  const zoom = useRef<HTMLDialogElement>(null),
    tabList = useRef<HTMLDivElement>(null);
  const [relatedStrategy, setRelatedStrategy] = useState("");
  const { state, busy, run, mutate } = useStore();
  const router = useRouter();
  useEffect(() => {
    let live = true;
    Promise.all([
      api(`products/${encodeURIComponent(slug)}`),
      api("categories"),
    ])
      .then(async ([p, c]) => {
        if (!live) return;
        setProduct(p);
        setCategories(c);
        setError("");
        setRelated([]);
        setRelatedStrategy("");
        if (process.env.NEXT_PUBLIC_RECOMMENDATIONS_ENABLED === "false") return;
        try {
          const rec = await api(
            `products/recommended?surface=product&productId=${encodeURIComponent(p.id)}&limit=4`,
          );
          if (live) {
            setRelated(rec.items ?? []);
            setRelatedStrategy(String(rec.strategy ?? ""));
          }
        } catch {
          try {
            const all = await api("products");
            if (live) {
              setRelated(all.filter((r: Row) => r.id !== p.id && Number(r.stock) > 0).slice(0, 4));
              setRelatedStrategy("");
            }
          } catch {
            // Keep the block empty rather than failing the page.
          }
        }
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          setMissing(e instanceof ApiError && e.status === 404);
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [slug, attempt]);
  async function purchase(buyNow = false) {
    if (!product) return;
    if (!state) {
      router.push("/login");
      return;
    }
    if (state.user.role !== "CUSTOMER") return;
    const p = product;
    await run(async () => {
      const summary = await api("cart/summary");
      const current = summary.items.find((c: Row) => c.productId === p.id);
      const next = Number(current?.quantity ?? 0) + quantity;
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        next > Math.min(100, Number(p.stock))
      )
        throw new Error("Số lượng vượt tồn kho hoặc giới hạn giỏ hàng.");
      await mutate("commerce", "cart-set", {
        productId: p.id,
        quantity: next,
        cartToken: summary.cartToken,
      });
      if (buyNow) router.push("/checkout");
    });
  }
  const category = categories.find((c) => c.code === product?.category),
    stock = Math.max(0, Number(product?.stock ?? 0));
  const canBuy =
    !busy && stock > 0 && (!state || state.user.role === "CUSTOMER");
  const spec = SPECS[String(product?.slug ?? "")];
  return (
    <main className="lan-page lan-detail">
      <nav className="lan-breadcrumb" aria-label="Đường dẫn">
        <Link href="/">Trang chủ</Link>
        <span>/</span>
        <Link href="/products">Bộ sưu tập</Link>
        {category && (
          <>
            <span>/</span>
            <Link href={`/products?category=${category.code}`}>
              {String(category.name)}
            </Link>
          </>
        )}
        <span>/</span>
        <span aria-current="page">
          {String(product?.name ?? "Chi tiết sản phẩm")}
        </span>
      </nav>
      <LoadState
        loading={loading}
        error={missing ? "Không tìm thấy sản phẩm này." : error}
        empty={!product}
        retry={() => {
          setLoading(true);
          setMissing(false);
          setAttempt(attempt + 1);
        }}
      />
      {missing && (
        <Link className="lan-button" href="/products">
          Trở về bộ sưu tập
        </Link>
      )}
      {product && !loading && !error && (
        <>
          <section className="lan-detail-grid">
            <div className="lan-detail-gallery">
              <button
                className="lan-detail-photo lan-frame"
                aria-label="Phóng to ảnh sản phẩm"
                onClick={() => zoom.current?.showModal()}
              >
                <ProductImage
                  fill
                  priority
                  src={String(product.image ?? "")}
                  alt={String(product.name)}
                  sizes="(max-width:760px) 90vw,48vw"
                />
                <span>Phóng to ↗</span>
              </button>
              <div className="lan-thumbnails">
                <button aria-label="Ảnh chính" aria-pressed="true">
                  <ProductImage
                    src={String(product.image ?? "")}
                    alt="Ảnh chính sản phẩm"
                    width={88}
                    height={88}
                  />
                </button>
              </div>
            </div>
            <div className="lan-purchase">
              <small>{String(category?.name ?? "ĐẶC SẢN CỐ ĐÔ")}</small>
              <p className="lan-stock">
                {stock > 0 ? `Còn ${stock} sản phẩm` : "Tạm hết hàng"}
              </p>
              <h1>{String(product.name)}</h1>
              <div className="lan-price lan-frame">
                <small>Giá niêm yết</small>
                <strong>{money(product.price)}</strong>
              </div>
              <fieldset className="lan-packaging">
                <legend>Loại sản phẩm / Quy cách</legend>
                <label className="lan-frame">
                  <input type="radio" name="package" checked readOnly />
                  {String(product.packaging ?? spec?.packaging ?? product.name)}
                  <strong>{money(product.price)}</strong>
                </label>
              </fieldset>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void purchase();
                }}
              >
                <label htmlFor="product-quantity">Số lượng</label>
                <div className="lan-buy-row">
                  <div className="lan-quantity">
                    <button
                      type="button"
                      aria-label="Giảm số lượng"
                      disabled={quantity <= 1 || !stock}
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      −
                    </button>
                    <input
                      id="product-quantity"
                      type="number"
                      min={1}
                      max={Math.min(100, stock) || 1}
                      value={quantity}
                      disabled={!stock}
                      onChange={(e) =>
                        setQuantity(
                          Math.max(
                            1,
                            Math.min(
                              Math.min(100, stock) || 1,
                              Number(e.target.value) || 1,
                            ),
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      aria-label="Tăng số lượng"
                      disabled={quantity >= Math.min(100, stock)}
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <button className="lan-button" disabled={!canBuy}>
                    {stock > 0 ? "Thêm vào giỏ hàng" : "Tạm hết hàng"}
                  </button>
                </div>
              </form>
              <button
                className="lan-button lan-button-paper lan-buy-now"
                disabled={!canBuy}
                onClick={() => void purchase(true)}
              >
                Mua ngay →
              </button>
              {state && state.user.role !== "CUSTOMER" && (
                <p>Tài khoản quản trị không dùng để đặt hàng.</p>
              )}
              <div className="lan-services">
                <div>
                  <strong>Giao nhận & Thanh toán</strong>
                  <p>
                    Kiểm tra thông tin giao nhận và phí tại bước thanh toán.
                  </p>
                </div>
                <div>
                  <strong>Thông tin sản phẩm</strong>
                  <p>Xem quy cách và mô tả hiện hành trước khi chọn mua.</p>
                </div>
                <div>
                  <strong>Chính sách đổi trả</strong>
                  <p>
                    <Link href="/return-policy">
                      Xem điều kiện và hướng dẫn đổi trả →
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </section>
          <section className="lan-detail-info">
            <div
              className="lan-detail-tabs"
              role="tablist"
              aria-label="Thông tin sản phẩm"
              ref={tabList}
            >
              {tabs.map((title, i) => (
                <button
                  key={title}
                  id={`product-tab-${i}`}
                  role="tab"
                  aria-selected={tab === i}
                  aria-controls="product-panel"
                  tabIndex={tab === i ? 0 : -1}
                  onClick={() => setTab(i)}
                  onKeyDown={(e) => {
                    let next = tab;
                    if (e.key === "ArrowRight") next = (tab + 1) % 3;
                    else if (e.key === "ArrowLeft") next = (tab + 2) % 3;
                    else if (e.key === "Home") next = 0;
                    else if (e.key === "End") next = 2;
                    else return;
                    e.preventDefault();
                    setTab(next);
                    (
                      tabList.current?.children[next] as HTMLButtonElement
                    )?.focus();
                  }}
                >
                  {title}
                </button>
              ))}
            </div>
            <div
              className="lan-tab-content"
              id="product-panel"
              role="tabpanel"
              aria-labelledby={`product-tab-${tab}`}
              tabIndex={0}
            >
              {tab === 0 ? (
                <>
                  <h2>Nếp quà tao nhã bên dòng Hương Giang</h2>
                  <p>
                    {String(
                      product.story ??
                        product.description ??
                        "Thông tin đang được cập nhật.",
                    )}
                  </p>
                </>
              ) : tab === 1 ? (
                <>
                  <h2>Thông số & Thành phần</h2>
                  <dl className="lan-specs">
                    {[
                      ["Danh mục", category?.name],
                      ["Quy cách", product.packaging ?? spec?.packaging],
                      ["Khối lượng", product.weight ?? spec?.weight],
                      ["Thành phần", product.ingredients ?? spec?.ingredients],
                      ["Hạn sử dụng", product.shelfLife ?? spec?.shelfLife],
                      ["Xuất xứ", product.origin ?? spec?.origin],
                    ].map(([name, value]) => (
                      <div key={String(name)}>
                        <dt>{String(name)}</dt>
                        <dd>{String(value ?? "Đang cập nhật")}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <>
                  <h2>Thưởng thức & Bảo quản</h2>
                  <p>
                    {String(
                      product.storage ??
                        spec?.storage ??
                        "Thông tin bảo quản đang được cập nhật. Vui lòng tham khảo hướng dẫn trên bao bì sản phẩm.",
                    )}
                  </p>
                </>
              )}
            </div>
          </section>
          {related.length > 0 && (
          <section className="lan-section">
            <header className="lan-section-heading">
              <div>
                <small>MỸ VỊ TIẾN CUNG</small>
                <h2>
                  {relatedStrategy === "BOUGHT_TOGETHER"
                    ? "Thường được mua cùng"
                    : "Có thể bạn cũng thích"}
                </h2>
                {relatedStrategy === "BOUGHT_TOGETHER" && (
                  <p>Dựa trên các đơn đã giao tại cửa hàng.</p>
                )}
              </div>
              <Link href="/products">Xem tất cả →</Link>
            </header>
            <div className="lan-related">
              {related.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  category={String(
                    categories.find((c) => c.code === p.category)?.name ??
                      p.category,
                  )}
                />
              ))}
            </div>
          </section>
          )}
          <dialog className="lan-zoom" ref={zoom}>
            <button
              className="lan-button"
              onClick={() => zoom.current?.close()}
            >
              Đóng ảnh ×
            </button>
            <ProductImage
              src={String(product.image ?? "")}
              alt={String(product.name)}
              width={900}
              height={900}
            />
          </dialog>
        </>
      )}
    </main>
  );
}

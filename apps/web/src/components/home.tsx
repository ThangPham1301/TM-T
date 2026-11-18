"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Row } from "@/lib/store";
import { ProductImage } from "./product/product-image";
import { ART, ProductCard, LoadState } from "./product/lan-primitives";
export function HomeExperience() {
  const [products, setProducts] = useState<Row[]>([]),
    [categories, setCategories] = useState<Row[]>([]),
    [category, setCategory] = useState("");
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.all([api("products"), api("categories")])
      .then(([p, c]) => {
        if (live) {
          setProducts(p);
          setCategories(c);
          setError("");
        }
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
  const [recs, setRecs] = useState<Row[]>([]);
  useEffect(() => {
    let live = true;
    api("products/recommended?surface=home&limit=4")
      .then((r) => {
        if (live) setRecs(r.items ?? []);
      })
      .catch(() => {
        if (live) setRecs([]);
      });
    return () => {
      live = false;
    };
  }, []);
  const visible = products
    .filter((p) => !category || p.category === category)
    .slice(0, 6);
  const gifts = products
    .filter((p) =>
      /qu[aà]|gift/i.test(
        `${p.category} ${categories.find((c) => c.code === p.category)?.name ?? ""}`,
      ),
    )
    .slice(0, 2);
  return (
    <main className="lan-page lan-home">
      <section className="lan-hero lan-frame">
        <div className="lan-hero-copy lan-plaque">
          <small>TINH HOA CỐ ĐÔ</small>
          <h1>
            Phong vị
            <br />
            Huế
          </h1>
          <p>
            Mè xửng, hạt sen và trà — những thức quà mộc mạc gói ghém nếp nhà
            thâm trầm xứ Huế.
          </p>
          <Link className="lan-button" href="/products">
            Khám phá ngay →
          </Link>
        </div>
        <div className="lan-hero-photo">
          <ProductImage
            src={ART + "photo-hero-tea-table.jpg"}
            alt="Bàn trà và thức quà Huế"
            fill
            priority
            sizes="(max-width:760px) 100vw,60vw"
          />
        </div>
      </section>
      <section className="lan-values" aria-label="Giá trị Gói Huế">
        {[
          ["Tinh hoa truyền thống", "Những thức quà gắn với phong vị Cố Đô."],
          ["Chất lượng tinh tuyển", "Khám phá mè xửng, hạt sen và trà Huế."],
          ["Tận tâm từng gói", "Gói ghém chỉn chu để gửi người thương."],
          ["Quà tặng ý nghĩa", "Gửi trao tình cảm qua từng thức quà."],
        ].map(([title, copy]) => (
          <div key={title}>
            <h2>{title}</h2>
            <p>{copy}</p>
          </div>
        ))}
      </section>
      <section className="lan-section lan-home-catalog">
        <aside className="lan-filter lan-frame">
          <h2>Danh mục quà</h2>
          <button aria-pressed={!category} onClick={() => setCategory("")}>
            Tất cả đặc sản <span>→</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              aria-pressed={category === c.code}
              onClick={() => setCategory(String(c.code))}
            >
              {String(c.name)} <span>→</span>
            </button>
          ))}
        </aside>
        <div>
          <header className="lan-section-heading">
            <div>
              <small>ĐƯỢC YÊU THÍCH NHẤT</small>
              <h2>Sản phẩm bán chạy</h2>
            </div>
            <Link href="/products">Xem tất cả →</Link>
          </header>
          <LoadState
            loading={loading}
            error={error}
            empty={!visible.length}
            retry={() => {
              setLoading(true);
              setAttempt(attempt + 1);
            }}
          />
          <div className="lan-products">
            {visible.map((p) => (
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
        </div>
      </section>
      {recs.length > 0 && (
        <section className="lan-section lan-recs">
          <header className="lan-section-heading">
            <div>
              <small>GỢI Ý TỪ CỬA HÀNG</small>
              <h2>Được khách chọn mua nhiều nhất</h2>
              <p>Xếp theo số lượng đã bán tại cửa hàng.</p>
            </div>
            <Link href="/products">Xem tất cả →</Link>
          </header>
          <div className="lan-products">
            {recs.map((p) => (
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
      <section className="lan-section lan-gifts">
        <header className="lan-section-heading lan-centered">
          <div>
            <small>TRANG TRỌNG & Ý NGHĨA</small>
            <h2>Set Quà Tặng Gói Huế</h2>
            <p>Chọn một món quà, gửi trao một tấm lòng.</p>
          </div>
        </header>
        <div className="lan-gift-grid">
          {gifts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
          {!loading && !error && !gifts.length && (
            <p>
              Các set quà đang được cập nhật.{" "}
              <Link href="/products">Khám phá bộ sưu tập →</Link>
            </p>
          )}
        </div>
      </section>
      <section className="lan-section">
        <header className="lan-section-heading">
          <div>
            <small>GÓC NHÌN NGHỆ THUẬT</small>
            <h2>Thư Viện Khoảnh Khắc</h2>
          </div>
          <p>Những lát cắt mộc mạc của phong vị Huế.</p>
        </header>
        <div className="lan-gallery">
          {[
            ["photo-story-nha-ruong.jpg", "Nếp gói bao bì di sản"],
            ["photo-sp-me-xung-dia.jpg", "Mè rang giòn thơm lừng"],
            ["photo-sp-tra-sen-lon.jpg", "Một chén trà xứ Huế"],
          ].map(([src, title]) => (
            <figure key={src}>
              <ProductImage
                src={ART + src}
                alt={title}
                fill
                sizes="(max-width:760px) 90vw,33vw"
              />
              <figcaption>{title}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className="lan-section lan-home-story" id="heritage-story">
        <small>NẾP NHÀ TRẦM MẶC</small>
        <h2>Gói chút Huế gửi nhau…</h2>
        <p>
          Huế không vội vã. Giữa nhịp sống bên dòng sông Hương, những thức quà
          thân thuộc lưu giữ một phần nếp nhà và ký ức Cố Đô.
        </p>
        <p>
          Từ mè xửng đến hạt sen, từ chén trà đến hộp quà gửi người thương, Gói
          Huế mời bạn tìm một phong vị cho riêng mình.
        </p>
        <Link className="lan-button" href="/products">
          Chọn quà Cố Đô →
        </Link>
      </section>
    </main>
  );
}

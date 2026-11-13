"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, money, type Row } from "@/lib/store";
import { ProductImage } from "./product/product-image";
const HERO =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBgDTnNDpDqWayHGmfgdpMZ7xrIpepsmqvZgohQd66eSgDGKr7krs5KknIa7b4nRGLRpZ1FQt5ye-7UfbqbiPvJvJk1WwXIrbwaCwIrTdJFFNr3ykdI5S8DWq6OdVN3-EKG57DFKRSrBew_wdq8j-i8jLch_hKQsGgnqbqtyN9t9H5K_e3TDwZ3WbFQPlBv1Hz4dJd1EJUaLXqGEKZh5C-4YeKNuxpklujrvtUvGDeZTK552UkmRfHd";
export function HomeExperience() {
  const [products, setProducts] = useState<Row[]>([]),
    [categories, setCategories] = useState<Row[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    void Promise.all([api("products"), api("categories")])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main className="heritage-home">
      <section
        className="heritage-hero"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(60,34,20,.98),rgba(76,43,24,.86) 47%,rgba(63,35,20,.28)),url(${HERO})`,
        }}
      >
        <div className="heritage-shell hero-grid">
          <div className="hero-copy">
            <span className="heritage-pill">✺ Phong vị Cố Đô · Gói Huế</span>
            <h1>
              Tinh Hoa Bánh Mứt Cung Đình Huế<em>Gói Trọn Hương Vị Kinh Kỳ</em>
            </h1>
            <p>
              Những thức quà mang hương vị mè rang, trà sen và bánh mứt truyền
              thống. Chọn món quà gửi trao tình cảm, lưu giữ phong vị Huế trong
              từng khoảnh khắc.
            </p>
            <div className="hero-buttons">
              <Link href="/products">Khám Phá Bộ Sưu Tập →</Link>
              <Link href="/return-policy">Chăm Sóc Sau Bán Hàng</Link>
            </div>
            <dl className="hero-metrics">
              <div>
                <dt>Tinh tuyển</dt>
                <dd>Bánh mứt và đặc sản</dd>
              </div>
              <div>
                <dt>Đồng hành</dt>
                <dd>Theo dõi đơn hàng</dd>
              </div>
              <div>
                <dt>Minh bạch</dt>
                <dd>Chính sách và đổi trả</dd>
              </div>
            </dl>
          </div>
          <article className="hero-feature">
            <div>
              <ProductImage
                fill
                priority
                src={String(products[0]?.image ?? HERO)}
                alt="Bộ sưu tập Gói Huế"
                sizes="(max-width:760px) 100vw,360px"
              />
            </div>
            <header>
              <h2>
                {String(products[0]?.name ?? "Phong vị Huế trong từng món quà")}
              </h2>
              {products[0] && <b>{money(products[0].price)}</b>}
            </header>
            <p>
              Bộ sưu tập bánh mứt, mè xửng và trà dành cho bạn và người thương.
            </p>
            <Link href="/products">Khám Phá Ngay →</Link>
          </article>
        </div>
      </section>
      <section className="home-section">
        <div className="heritage-shell">
          <header className="home-heading">
            <div>
              <span>Tứ Đại Danh Vị</span>
              <h2>Danh Mục Di Sản Cố Đô</h2>
            </div>
            <p>Chọn một hương vị, gửi trao một tấm lòng.</p>
          </header>
          <div className="heritage-categories">
            {categories.map((category, i) => (
              <Link
                key={category.id}
                href={`/products?category=${category.code}`}
              >
                <div>
                  <ProductImage
                    fill
                    src={String(
                      category.imageId
                        ? category.image
                        : (products.find((p) => p.category === category.code)
                            ?.image ??
                            category.image ??
                            HERO),
                    )}
                    alt={String(category.name)}
                    sizes="(max-width:760px) 100vw,25vw"
                  />
                </div>
                <small>Bộ sưu tập 0{i + 1}</small>
                <h3>{String(category.name)}</h3>
                <p>
                  {String(
                    category.description ||
                      "Khám phá phong vị được tuyển chọn từ Huế.",
                  )}
                </p>
                <b>Khám phá →</b>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="home-section popular-section">
        <div className="heritage-shell">
          <header className="home-heading">
            <div>
              <span>✧ Tuyển Chọn Gói Huế</span>
              <h2>Ngự Phẩm Dành Cho Bạn</h2>
            </div>
            <Link href="/products">Xem tất cả →</Link>
          </header>
          {error && <p className="store-error">{error}</p>}
          <div className="heritage-products">
            {products.slice(0, 4).map((p) => (
              <article key={p.id}>
                <Link className="product-visual" href={`/products/${p.slug}`}>
                  <ProductImage
                    fill
                    src={String(p.image)}
                    alt={String(p.name)}
                    sizes="(max-width:760px) 100vw,25vw"
                  />
                </Link>
                <small>{String(p.category)}</small>
                <Link className="product-name" href={`/products/${p.slug}`}>
                  {String(p.name)}
                </Link>
                <p>{String(p.description)}</p>
                <div>
                  <b>{money(p.price)}</b>
                </div>
                <Link
                  className="store-product-action"
                  href={`/products/${p.slug}`}
                >
                  ♧ Chọn sản phẩm
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="home-section story-section" id="heritage-story">
        <div className="heritage-shell story-grid">
          <div className="story-image">
            <ProductImage
              src={HERO}
              alt="Phong vị xứ Huế"
              width={900}
              height={730}
            />
          </div>
          <div className="story-copy">
            <span className="section-kicker">Chuyện Cố Đô</span>
            <h2>
              Gìn Giữ Hương Vị,
              <br />
              Gửi Trao Tình Huế
            </h2>
            <p>
              Mỗi món quà từ Huế mang theo câu chuyện về sự tỉ mỉ và tinh tế.
              Gói Huế mong đưa những hương vị thân quen đến gần hơn với người
              thưởng thức.
            </p>
            <p>
              Từ mè xửng dẻo đến trà sen thanh, hãy chọn thức quà phù hợp và
              theo dõi trọn hành trình từ đặt hàng đến chăm sóc sau bán.
            </p>
            <Link href="/products">Khám phá phong vị Huế →</Link>
          </div>
        </div>
      </section>
      <section className="newsletter-section">
        <div className="heritage-shell newsletter-panel">
          <div>
            <span>♡ Đồng Hành Cùng Khách Hàng</span>
            <h2>Một Tài Khoản Cho Trọn Hành Trình</h2>
            <p>
              Quản lý đơn hàng, thông tin cá nhân và yêu cầu đổi trả ngay tại
              Gói Huế.
            </p>
          </div>
          <div>
            <Link className="primary-link" href="/account">
              Mở tài khoản của tôi →
            </Link>
            <p>
              <Link href="/privacy-policy">Tìm hiểu chính sách bảo mật</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

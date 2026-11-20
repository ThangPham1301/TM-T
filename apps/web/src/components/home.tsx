"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type Row } from "@/lib/store";
import { ProductImage } from "./product/product-image";

type Slide = {
  kicker: string;
  title: string;
  lead: string;
  image: {
    src: string;
    alt: string;
  };
};

const heroSlides: Slide[] = [
  {
    kicker: "Đặc sản & quà biếu Cố đô",
    title: "Phong vị Huế",
    lead: "Mè xửng dẻo thơm, trà Huế thanh dịu, quà biếu đậm tình miền Trung — trao gửi bằng cả tấm lòng.",
    image: {
      src: "/images/heritage/photos/hero-studio.jpg",
      alt: "Hộp quà, lon trà sen và đĩa mè xửng thủ công của Gói Huế",
    },
  },
  {
    kicker: "Bên chén trà Huế",
    title: "Thong thả một chén trà",
    lead: "Mè xửng mạch nha dẻo thơm cùng trà sen thanh dịu — lời mời ngồi lại bên hiên nhà rường.",
    image: {
      src: "/images/heritage/photos/hero-tea-table.jpg",
      alt: "Đĩa mè xửng bên ấm trà sứ xanh trắng dưới nắng hiên nhà",
    },
  },
  {
    kicker: "Quà biếu Cố đô",
    title: "Hộp quà trao gửi tấm lòng",
    lead: "Hộp Đoàn Viên ba khoang, đóng gói chỉn chu cho người thân và đối tác.",
    image: {
      src: "/images/heritage/photos/sp-hop-qua-doan-vien.jpg",
      alt: "Hộp quà Đoàn Viên Gói Huế mở nắp",
    },
  },
];

const categoryItems = [
  {
    href: "/products?category=me-xung-keo-hue",
    name: "Mè xửng Huế",
    note: "Dẻo thơm mạch nha, mè rang",
    image: "/images/heritage/photos/cat-me-xung.jpg",
  },
  {
    href: "/products?category=tra-cung-dinh",
    name: "Trà Huế",
    note: "Trà sen, trà cung đình",
    image: "/images/heritage/photos/cat-tra-hue.jpg",
  },
  {
    href: "/products?category=banh-cung-dinh",
    name: "Bánh & Mứt cung đình",
    note: "Bánh in, mứt, điểm tâm",
    image: "/images/heritage/photos/sp-ke-trung-bay.jpg",
  },
  {
    href: "/products?category=qua-bieu",
    name: "Quà biếu",
    note: "Hộp quà biếu tặng trang nhã",
    image: "/images/heritage/photos/cat-qua-bieu.jpg",
  },
];

const originBadges = [
  "Chuẩn OCOP 4 sao",
  "Mã QR từng lô",
  "Chỉ dẫn địa lý",
  "Nguồn gốc rõ ràng",
];

function Motif({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <img
      className={`gh-motif ${className}`}
      src={`/images/heritage/motifs/${name}.webp`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
    />
  );
}

function HeritageBanner({
  slides,
  level = 2,
  titleId,
  priority = false,
  children,
  className = "",
  autoPlayMs = 3500,
}: {
  slides: Slide[];
  level?: 1 | 2;
  titleId?: string;
  priority?: boolean;
  children?: React.ReactNode;
  className?: string;
  autoPlayMs?: number;
}) {
  const isMulti = slides.length > 1;
  const [active, setActive] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isMulti || reducedMotion) return;
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, autoPlayMs);
    return () => clearInterval(interval);
  }, [isMulti, reducedMotion, slides.length, autoPlayMs, active]);

  return (
    <div className="gh-banner-shell">
      <div
        className={`gh-banner gh-surface-imperial ${
          isMulti ? "gh-banner--multi" : ""
        } ${className}`}
        {...(isMulti
          ? {
              role: "group",
              "aria-roledescription": "carousel",
              "aria-label": "Giới thiệu nổi bật",
            }
          : {})}
      >
        <div className="gh-banner__copy">
          <div className="gh-banner__slides" aria-live="off">
            {slides.map((slide, idx) => (
              <div
                key={idx}
                className={`gh-banner__slide ${
                  idx === active ? "is-active" : ""
                }`}
                style={idx !== active ? { display: "none" } : undefined}
                aria-hidden={idx !== active ? true : undefined}
                inert={idx !== active}
                {...(isMulti
                  ? {
                      role: "group",
                      "aria-roledescription": "slide",
                      "aria-label": `${idx + 1} / ${slides.length}`,
                    }
                  : {})}
              >
                <span className="gh-banner__kicker">{slide.kicker}</span>
                {idx === 0 && level === 1 ? (
                  <h1 id={titleId} className="gh-banner__title">
                    {slide.title}
                  </h1>
                ) : (
                  <h2
                    id={idx === 0 ? titleId : `${titleId}-${idx}`}
                    className="gh-banner__title"
                  >
                    {slide.title}
                  </h2>
                )}
                <div className="gh-banner__rule" aria-hidden="true" />
                {slide.lead ? (
                  <p className="gh-banner__lead">{slide.lead}</p>
                ) : null}
              </div>
            ))}
          </div>
          {children}
        </div>

        <div className="gh-banner__visual">
          {slides.map((slide, idx) => (
            <div
              key={slide.image.src + idx}
              className={`gh-banner__photo ${
                idx === active ? "is-active" : ""
              }`}
            >
              <ProductImage
                fill
                priority={priority && idx === 0}
                sizes="(max-width: 960px) 100vw, 55vw"
                src={slide.image.src}
                alt={idx === active ? slide.image.alt : ""}
              />
            </div>
          ))}
        </div>

        {isMulti && (
          <>
            <button
              type="button"
              className="gh-banner__arrow gh-banner__arrow--prev"
              aria-label="Trang trước"
              onClick={() =>
                setActive((prev) => (prev - 1 + slides.length) % slides.length)
              }
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 12H5m6-6-6 6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              className="gh-banner__arrow gh-banner__arrow--next"
              aria-label="Trang kế tiếp"
              onClick={() => setActive((prev) => (prev + 1) % slides.length)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </button>
            <div
              className="gh-banner__dots"
              role="group"
              aria-label="Chọn trang giới thiệu"
            >
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={idx === active ? "is-active" : undefined}
                  aria-label={`Trang ${idx + 1} / ${slides.length}`}
                  aria-current={idx === active ? "true" : undefined}
                  onClick={() => setActive(idx)}
                >
                  <span />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function HomeExperience() {
  const router = useRouter();
  const [traceCode, setTraceCode] = useState("");
  const [featuredProducts, setFeaturedProducts] = useState<Row[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    api("products")
      .then((data) => {
        if (active) {
          const list = Array.isArray(data) ? data : data?.items ?? [];
          setFeaturedProducts(list.slice(0, 4));
          setProductsLoaded(true);
        }
      })
      .catch(() => {
        if (active) setProductsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleTraceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = traceCode.trim();
    if (code) {
      router.push(`/trace/${encodeURIComponent(code)}`);
    }
  };

  return (
    <main className="gh-home" id="main-content">
      {/* 1. HERO BANNER */}
      <section
        className="gh-home-band gh-home-hero"
        aria-labelledby="gh-hero-title"
      >
        <Motif name="02-canh-hoa" className="gh-band__blossom" />
        <Motif name="01-hien-nha-phai" className="gh-band__veranda" />
        <div className="gh-wrap">
          <HeritageBanner
            level={1}
            titleId="gh-hero-title"
            priority
            slides={heroSlides}
          >
            <div className="gh-banner__actions">
              <Link className="gh-btn gh-btn--fold" href="/products">
                Khám phá bộ sưu tập{" "}
                <span className="gh-btn__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
              <a className="gh-btn gh-btn--ghost" href="#ocop-traceability">
                Truy xuất nguồn gốc
              </a>
            </div>
          </HeritageBanner>
        </div>
      </section>

      {/* 2. FEATURED SECTION */}
      <section
        className="gh-home-section"
        id="featured"
        aria-label="Sản phẩm nổi bật"
      >
        <div className="gh-wrap">
          {productsLoaded && featuredProducts.length > 0 && (
            <div className="recommendation-module__bxvk_W__rail">
              <div className="recommendation-module__bxvk_W__header">
                <div
                  className="recommendation-module__bxvk_W__line"
                  aria-hidden="true"
                />
                <h2>Sản phẩm nổi bật</h2>
                <div
                  className="recommendation-module__bxvk_W__line"
                  aria-hidden="true"
                />
              </div>
              <div className="recommendation-module__bxvk_W__grid">
                {featuredProducts.map((p) => {
                  const slug = String(p.slug || p.id || "");
                  const price = Number(p.price || p.priceVnd || 0);
                  const imageSrc =
                    (p.thumbnailUrl as string) ||
                    (p.image as string) ||
                    "/images/heritage/photos/photo-sp-me-xung-dia.jpg";

                  return (
                    <Link
                      key={p.id}
                      className="gh-frame-card recommendation-module__bxvk_W__card"
                      href={`/products/${encodeURIComponent(slug)}`}
                    >
                      <div className="gh-card-media recommendation-module__bxvk_W__media">
                        <ProductImage
                          fill
                          sizes="(max-width: 760px) 45vw, 210px"
                          src={imageSrc}
                          alt={String(p.name || "")}
                        />
                      </div>
                      <div className="recommendation-module__bxvk_W__body">
                        <strong className="recommendation-module__bxvk_W__name">
                          {String(p.name || "")}
                        </strong>
                        <span className="recommendation-module__bxvk_W__price">
                          {new Intl.NumberFormat("vi-VN", {
                            style: "currency",
                            currency: "VND",
                          }).format(price)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* DIVIDER */}
      <div className="gh-wrap">
        <div className="gh-divider" aria-hidden="true">
          <span className="gh-divider__knot" />
        </div>
      </div>

      {/* 3. COLLECTIONS */}
      <section
        className="gh-home-section gh-collections"
        id="collection"
        aria-labelledby="gh-collection-title"
      >
        <Motif name="05-may" className="gh-collections__cloud" />
        <Motif name="07-hat-me" className="gh-collections__seeds" />
        <div className="gh-wrap">
          <div className="gh-section-header gh-section-header--center">
            <div className="gh-section-header__line" />
            <h2 id="gh-collection-title">Chọn thức quà</h2>
            <div className="gh-section-header__line" />
          </div>
          <div className="gh-categories">
            {categoryItems.map((item) => (
              <Link key={item.href} className="gh-frame-card" href={item.href}>
                <div className="gh-card-media">
                  <ProductImage
                    fill
                    sizes="(max-width: 600px) 100vw, (max-width: 1100px) 50vw, 25vw"
                    src={item.image}
                    alt=""
                  />
                </div>
                <div className="gh-categories__foot">
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.note}</small>
                  </span>
                  <span className="gh-categories__arrow" aria-hidden="true">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4. HERITAGE STORY */}
      <section
        className="gh-story"
        id="heritage-story"
        aria-labelledby="gh-story-title"
      >
        <Motif name="02-canh-hoa" className="gh-story__blossom" />
        <Motif name="01-hien-nha" className="gh-story__veranda" />
        <Motif name="10-tuong-thanh" className="gh-story__wall" />
        <Motif
          name="12-hoa-sen-cung-dinh-phai"
          className="gh-story__lotus"
        />
        <div className="gh-wrap">
          <div className="gh-story__grid">
            <div className="gh-story__copy">
              <h2 id="gh-story-title">Bên chén trà Huế</h2>
              <div className="gh-story__rule" aria-hidden="true" />
              <p>
                Thưởng chén trà Huế, cảm nhận hương vị thanh dịu và nét tinh tế
                trong những thức quà mộc mạc của cố đô.
              </p>
              <p className="gh-story__muted">
                Một miếng mè xửng dẻo thơm mùi mạch nha, nhấp cùng ngụm trà sen
                ấm nóng — lời mời thong thả ngồi lại, kể nhau nghe đôi chuyện
                xứ kinh kỳ.
              </p>
              <Link
                className="gh-btn gh-btn--paper"
                href="/products?category=tra-cung-dinh"
              >
                Khám phá Trà Huế{" "}
                <span className="gh-btn__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
            <div className="gh-frame-plaque gh-story__photo">
              <ProductImage
                width={900}
                height={620}
                sizes="(max-width: 960px) 100vw, 50vw"
                src="/images/heritage/photos/story-tra-hue.jpg"
                alt="Bàn tay rót trà Huế từ ấm sứ hoa lam bên đĩa mè xửng"
              />
            </div>
          </div>

          <div className="gh-story__grid gh-story__grid--reverse">
            <div className="gh-frame-plaque gh-story__photo">
              <ProductImage
                width={900}
                height={620}
                sizes="(max-width: 960px) 100vw, 50vw"
                src="/images/heritage/photos/story-nha-ruong.jpg"
                alt="Hiên nhà rường gỗ cổ truyền xứ Huế ngập nắng"
              />
            </div>
            <div className="gh-story__copy">
              <span className="gh-kicker">Di sản kiến trúc & ẩm thực</span>
              <h2>Thức quà từ Huế</h2>
              <div className="gh-story__rule" aria-hidden="true" />
              <p>
                Gói Huế mang đến những thức quà mộc mạc mà tinh tế của xứ Huế: mè
                xửng dẻo thơm, trà Huế thanh dịu và những món quà biếu trang
                nhã.
              </p>
              <p className="gh-story__muted">
                Mỗi hộp quà lấy cảm hứng từ nếp giấy Dó thủ công, nhịp mái hiên
                nhà rường và cổng thành cổ kính.
              </p>
              <Link
                className="gh-btn gh-btn--brown gh-btn--fold"
                href="/products?category=qua-bieu"
              >
                Chọn hộp quà biếu{" "}
                <span className="gh-btn__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. OCOP TRACEABILITY */}
      <section
        className="gh-home-band"
        id="ocop-traceability"
        aria-labelledby="gh-trace-title"
      >
        <Motif name="09-cong-thanh" className="gh-band__gate" />
        <Motif
          name="02-canh-hoa-phai"
          className="gh-band__blossom-right"
        />
        <div className="gh-wrap">
          <div className="gh-banner-shell">
            <div className="gh-banner gh-surface-imperial">
              <div className="gh-banner__copy">
                <div className="gh-banner__slides" aria-live="off">
                  <div className="gh-banner__slide is-active">
                    <span className="gh-banner__kicker">
                      Hệ thống truy xuất nguồn gốc
                    </span>
                    <h2 id="gh-trace-title" className="gh-banner__title">
                      Minh bạch nguồn gốc từng hộp quà
                    </h2>
                    <div className="gh-banner__rule" aria-hidden="true" />
                    <p className="gh-banner__lead">
                      Mỗi hộp xuất xưởng đều gắn mã định danh. Nhập mã QR trên
                      nhãn để xem vùng nguyên liệu, lô sản xuất và chứng nhận.
                    </p>
                  </div>
                </div>

                <form className="gh-trace-form" onSubmit={handleTraceSubmit}>
                  <label
                    className="gh-trace-form__label"
                    htmlFor="home-trace-code"
                  >
                    Mã QR trên nhãn hộp
                  </label>
                  <div className="gh-trace-form__row">
                    <input
                      id="home-trace-code"
                      className="gh-field"
                      required
                      maxLength={160}
                      placeholder="Ví dụ: QR-OMA-20261015-LOT08"
                      value={traceCode}
                      onChange={(e) => setTraceCode(e.target.value)}
                    />
                    <button type="submit" className="gh-btn gh-btn--fold">
                      Kiểm tra{" "}
                      <span className="gh-btn__arrow" aria-hidden="true">
                        →
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    className="gh-trace-form__sample"
                    onClick={() => setTraceCode("QR-OMA-20261015-LOT08")}
                  >
                    Dùng mã mẫu
                  </button>
                </form>

                <ul
                  className="gh-banner__badges"
                  aria-label="Cam kết nguồn gốc"
                >
                  {originBadges.map((badge) => (
                    <li key={badge} className="gh-badge gh-badge--gold">
                      {badge}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="gh-banner__visual">
                <div className="gh-banner__photo is-active">
                  <ProductImage
                    fill
                    sizes="(max-width: 960px) 100vw, 55vw"
                    src="/images/heritage/photos/sp-goi-le-tra.jpg"
                    alt="Túi mè xửng và trà cung đình Gói Huế có nhãn mã QR truy xuất"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. ACCOUNT CTA */}
      <section className="gh-home-section" aria-labelledby="gh-account-title">
        <div className="gh-wrap">
          <div className="gh-frame-functional gh-frame-functional--fold gh-account-cta">
            <div>
              <span className="gh-kicker">Đồng hành cùng khách hàng</span>
              <h2 id="gh-account-title">Một tài khoản cho trọn hành trình</h2>
              <p>
                Quản lý đơn hàng, thông tin cá nhân và yêu cầu đổi trả ngay tại
                Gói Huế.
              </p>
            </div>
            <Link
              className="gh-btn gh-btn--brown gh-btn--fold"
              href="/account/profile"
            >
              Mở tài khoản của tôi{" "}
              <span className="gh-btn__arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

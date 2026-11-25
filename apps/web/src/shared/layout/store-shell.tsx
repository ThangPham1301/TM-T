"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { guestLookupPath } from "@/lib/guest-order";

export type StoreHeaderProps = {
  user: { name: string; role: string } | null;
  cartCount?: number;
  busy?: boolean;
  onLogout: () => void;
};

export type StoreFooterProps = {
  categories?: readonly { id: string; code: string; name: string }[];
};

const collections = [
  {
    href: "/products?category=me-xung-keo-hue",
    name: "Mè xửng Huế",
    note: "Dẻo thơm mạch nha, mè rang",
  },
  {
    href: "/products?category=tra-cung-dinh",
    name: "Trà Huế",
    note: "Trà sen, trà cung đình",
  },
  {
    href: "/products?category=banh-cung-dinh",
    name: "Bánh & Mứt cung đình",
    note: "Bánh in, mứt, điểm tâm",
  },
  {
    href: "/products?category=qua-bieu",
    name: "Quà biếu",
    note: "Hộp quà biếu tặng trang nhã",
  },
];

function Dropdown({
  label,
  triggerClassName = "",
  ariaLabel,
  align = "start",
  panelClassName = "",
  children,
}: {
  label: React.ReactNode;
  triggerClassName?: string;
  ariaLabel?: string;
  align?: "start" | "end";
  panelClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="gh-dropdown" ref={ref}>
      <button
        type="button"
        className={triggerClassName}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        <div
          id={id}
          className={`gh-dropdown__panel gh-dropdown__panel--${align} ${panelClassName}`}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a") || (e.target as HTMLElement).closest("button")) {
              setOpen(false);
            }
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function StoreHeader({
  user,
  cartCount = 0,
  busy = false,
  onLogout,
}: StoreHeaderProps) {
  const pathname = usePathname();
  const userName = user?.name?.trim() || "Tài khoản";
  const initial = userName.charAt(0).toLocaleUpperCase("vi") || "T";

  return (
    <>
      <header className="gh-header gh-surface-imperial">
        <div className="gh-wrap gh-header__main">
          <Link className="gh-brand" aria-label="Gói Huế - Trang chủ" href="/">
            <img
              className="gh-brand__mark"
              src="/images/heritage/logo-goi-hue.svg"
              alt=""
              width={38}
              height={38}
            />
            <span className="gh-brand__text">Gói Huế</span>
          </Link>

          <nav className="gh-nav" aria-label="Điều hướng chính">
            <Link
              className="gh-nav-link"
              aria-current={pathname === "/" ? "page" : undefined}
              href="/"
            >
              Trang chủ
            </Link>

            <Dropdown
              triggerClassName="gh-nav-link"
              panelClassName="gh-collections-panel"
              label={
                <>
                  Bộ sưu tập <span className="gh-chevron" aria-hidden="true">﹀</span>
                </>
              }
            >
              <ul>
                <li>
                  <Link href="/recommendations">
                    <strong>Gợi ý từ cửa hàng</strong>
                    <small>Gợi ý mua sắm dành cho bạn</small>
                  </Link>
                </li>
                {collections.map((c) => (
                  <li key={c.href}>
                    <Link href={c.href}>
                      <strong>{c.name}</strong>
                      <small>{c.note}</small>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link className="gh-collections-panel__all" href="/products">
                Xem tất cả sản phẩm →
              </Link>
            </Dropdown>

            <Link
              className="gh-nav-link"
              aria-current={pathname === "/cau-chuyen-hue" ? "page" : undefined}
              href="/cau-chuyen-hue"
            >
              Chuyện Huế
            </Link>
          </nav>

          <div className="gh-header__tools">
            <div className="gh-search-wide">
              <form className="gh-search" role="search" action="/products" method="get">
                <label className="sr-only" htmlFor="header-search">
                  Tìm sản phẩm
                </label>
                <span className="gh-search__icon">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M16 16l4.5 4.5" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="header-search"
                  type="search"
                  minLength={2}
                  placeholder="Tìm mè xửng, trà sen…"
                  name="q"
                />
              </form>
            </div>

            <div className="gh-search-compact">
              <Dropdown
                align="end"
                ariaLabel="Tìm sản phẩm"
                triggerClassName="gh-icon-button"
                label={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M16 16l4.5 4.5" strokeLinecap="round" />
                  </svg>
                }
              >
                <form
                  className="gh-search"
                  role="search"
                  action="/products"
                  method="get"
                  style={{ padding: "8px" }}
                >
                  <input
                    type="search"
                    minLength={2}
                    placeholder="Tìm mè xửng, trà sen…"
                    name="q"
                    autoFocus
                  />
                </form>
              </Dropdown>
            </div>

            <Link
              className="gh-icon-button gh-cart"
              title="Giỏ hàng"
              aria-label={cartCount > 0 ? `Mở giỏ hàng, ${cartCount} sản phẩm` : "Mở giỏ hàng"}
              href="/cart"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M4 8h16l-1.2 12H5.2L4 8z" />
                <path d="M8 8V6a4 4 0 0 1 8 0v2" />
              </svg>
              {cartCount > 0 && (
                <span className="gh-cart__count" aria-hidden="true">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            <div className="gh-dropdown">
              {user ? (
                <Dropdown
                  align="end"
                  ariaLabel={`Mở menu tài khoản của ${userName}`}
                  triggerClassName="gh-account-trigger"
                  label={
                    <>
                      <span className="gh-avatar" aria-hidden="true">
                        {initial}
                      </span>
                      <span className="gh-account-trigger__name">{userName}</span>
                      <span className="gh-chevron" aria-hidden="true">
                        ﹀
                      </span>
                    </>
                  }
                >
                  <div className="gh-account-menu__who">
                    <strong>{userName}</strong>
                  </div>
                  <ul className="gh-account-menu">
                    {user.role === "ADMIN" ? (
                      <li>
                        <Link href="/admin">Kênh quản trị</Link>
                      </li>
                    ) : (
                      <>
                        <li>
                          <Link href="/account/profile">Hồ sơ cá nhân</Link>
                        </li>
                        <li>
                          <Link href="/account/orders">Đơn hàng của tôi</Link>
                        </li>
                        <li>
                          <Link href="/account/addresses">Sổ địa chỉ</Link>
                        </li>
                        <li>
                          <Link href="/account/privacy">Quyền dữ liệu</Link>
                        </li>
                        <li>
                          <Link href="/account/returns">Đổi trả của tôi</Link>
                        </li>
                      </>
                    )}
                    <li>
                      <Link href="/account/security">Bảo mật tài khoản</Link>
                    </li>
                    <li>
                      <button type="button" disabled={busy} onClick={onLogout}>
                        Đăng xuất
                      </button>
                    </li>
                  </ul>
                </Dropdown>
              ) : (
                <Dropdown
                  align="end"
                  ariaLabel="Mở menu tài khoản"
                  triggerClassName="gh-account-trigger gh-account-trigger--guest"
                  label={
                    <>
                      <span
                        className="gh-avatar gh-avatar--guest gh-emblem"
                        aria-hidden="true"
                      />
                      <span className="gh-account-trigger__name">Tài khoản</span>
                      <span className="gh-chevron" aria-hidden="true">
                        ﹀
                      </span>
                    </>
                  }
                >
                  <div className="gh-account-menu__who">
                    <strong>Chào mừng đến Gói Huế</strong>
                    <small>Đăng nhập để dùng địa chỉ đã lưu và xem lịch sử đơn.</small>
                  </div>
                  <div className="gh-account-menu__actions">
                    <Link
                      className="gh-btn gh-btn--brown"
                      href="/login?returnUrl=%2Faccount%2Fprofile"
                    >
                      Đăng nhập
                    </Link>
                    <Link className="gh-btn gh-btn--paper" href="/register">
                      Đăng ký tài khoản
                    </Link>
                  </div>
                  <ul className="gh-account-menu">
                    <li>
                      <Link href={guestLookupPath}>Tra cứu đơn hàng</Link>
                    </li>
                  </ul>
                </Dropdown>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav
        className="gh-bottom-nav gh-surface-imperial"
        aria-label="Điều hướng điện thoại"
      >
        <Link aria-current={pathname === "/" ? "page" : undefined} href="/">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z" />
          </svg>
          <span>Trang chủ</span>
        </Link>
        <Link href="/products">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          <span>Danh mục</span>
        </Link>
        <Link href="/products">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M16 16l4.5 4.5" strokeLinecap="round" />
          </svg>
          <span>Tìm kiếm</span>
        </Link>
        <Link aria-label="Mở giỏ hàng" href="/cart">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M4 8h16l-1.2 12H5.2L4 8z" />
            <path d="M8 8V6a4 4 0 0 1 8 0v2" />
          </svg>
          <span>Giỏ hàng</span>
        </Link>
      </nav>
    </>
  );
}

export function StoreFooter(_props: StoreFooterProps) {
  return (
    <footer className="gh-footer gh-surface-imperial">
      <div className="gh-wrap">
        <div className="gh-footer__grid">
          <div>
            <Link className="gh-brand" aria-label="Gói Huế - Trang chủ" href="/">
              <img
                className="gh-brand__mark"
                src="/images/heritage/logo-goi-hue.svg"
                alt=""
                width={38}
                height={38}
              />
              <span className="gh-brand__text">Gói Huế</span>
            </Link>
            <p>
              Gìn giữ và tôn vinh phong vị bánh mứt, mè xửng và trà xứ Huế, đóng
              gói chỉn chu để trao gửi trọn tấm lòng.
            </p>
            <span className="gh-badge gh-badge--gold gh-footer__chip">
              OCOP 4 sao Thừa Thiên Huế
            </span>
          </div>

          <div>
            <h2>Bộ sưu tập</h2>
            <ul>
              {collections.map((c) => (
                <li key={c.href}>
                  <Link href={c.href}>{c.name}</Link>
                </li>
              ))}
              <li>
                <Link href="/cau-chuyen-hue">Chuyện Huế</Link>
              </li>
            </ul>
          </div>

          <div>
            <h2>Chăm sóc &amp; hỗ trợ</h2>
            <ul>
              <li><Link href={guestLookupPath}>Tra cứu đơn hàng</Link></li>
              <li><Link href="/shipping-payment-policy">Đặt hàng, thanh toán và giao hàng</Link></li>
              <li>
                <Link href="/return-policy">Chính sách đổi trả</Link>
              </li>
              <li>
                <Link href="/privacy-policy">Chính sách quyền riêng tư</Link>
              </li>
            </ul>
          </div>

          <div>
            <h2>Phòng trưng bày &amp; xưởng bánh</h2>
            <p>128 Lê Lợi, Phường Phú Nhuận, Thành phố Huế</p>
            <p>(0234) 388 9988 · thuquan@omahue.vn</p>
          </div>
        </div>
        <div className="gh-footer__bottom">
          © 2026 Gói Huế · Tinh tuyển di sản · Chuẩn hóa OCOP
        </div>
      </div>
    </footer>
  );
}

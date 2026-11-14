"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { api, type Row } from "@/lib/store";
import { useEffect, useState } from "react";

export function SiteHeader() {
  const { state, busy, run, logout } = useStore();
  const pathname = usePathname();
  if (["/admin/products", "/admin/categories"].includes(pathname)) return null;
  return (
    <header className="site-header">
      <div className="utility-bar">
        <span>Đặc sản Huế · Gói trọn yêu thương</span>
        <span className="utility-push">
          Thanh toán khi nhận hàng · Hỗ trợ sau bán
        </span>
      </div>
      <div className="main-nav">
        <Link className="brand" href="/">
          <span className="brand-seal">G</span>
          <span>
            <strong>GÓI HUẾ</strong>
            <small>Phong vị Cố Đô</small>
          </span>
        </Link>
        <form className="header-search" action="/products">
          <label className="sr-only" htmlFor="search">
            Tìm sản phẩm
          </label>
          <input
            id="search"
            name="q"
            placeholder="Tìm mè xửng, trà, quà biếu…"
          />
          <button aria-label="Tìm kiếm">⌕</button>
        </form>
        <nav aria-label="Điều hướng chính">
          <Link href="/">Trang chủ</Link>
          <Link href="/products">Bộ sưu tập</Link>
          <Link href="/#heritage-story">Câu chuyện Huế</Link>
          <Link href="/return-policy">Đổi trả</Link>
        </nav>
        <Link className="track-order-link" href="/account/orders">
          Đơn hàng
        </Link>
        <Link href="/cart" className="cart-header-button">
          ♧ Giỏ hàng{" "}
          {state?.user.role === "CUSTOMER" && (
            <b aria-label={`${state.cartCount} sản phẩm`}>
              ({state.cartCount})
            </b>
          )}
        </Link>
        {state ? (
          <details className="user-dropdown">
            <summary className="account-button authenticated">
              {String(state.user.name).charAt(0)}
            </summary>
            <div className="user-dropdown-menu">
              <strong>{String(state.user.name)}</strong>
              <Link href="/account">Tài khoản</Link>
              <Link href="/account/privacy">Quyền dữ liệu</Link>
              <Link href="/account/returns">Đổi trả của tôi</Link>
              {state.user.role === "ADMIN" && (
                <Link href="/admin">Quản trị</Link>
              )}
              <button disabled={busy} onClick={() => void run(logout)}>
                Đăng xuất
              </button>
            </div>
          </details>
        ) : (
          <Link className="store-login" href="/login">
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}
export function SiteFooter() {
  const pathname = usePathname();
  const [categories, setCategories] = useState<Row[]>([]);
  useEffect(() => {
    void api("categories")
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);
  if (["/admin/products", "/admin/categories"].includes(pathname)) return null;
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <Link className="brand" href="/">
            <span className="brand-seal">G</span>
            <span>
              <strong>GÓI HUẾ</strong>
              <small>Phong vị Cố Đô</small>
            </span>
          </Link>
          <p>
            Tinh tuyển bánh mứt, mè xửng và trà Huế cho những món quà đậm tình.
          </p>
        </div>
        <div>
          <h2>Bộ sưu tập</h2>
          {categories.slice(0, 4).map((c) => (
            <p key={c.id}>
              <Link href={`/products?category=${c.code}`}>
                {String(c.name)}
              </Link>
            </p>
          ))}
        </div>
        <div>
          <h2>Chăm sóc khách hàng</h2>
          <p>
            <Link href="/account/orders">Đơn hàng của tôi</Link>
          </p>
          <p>
            <Link href="/account/returns">Yêu cầu đổi trả</Link>
          </p>
          <p>
            <Link href="/account/privacy">Yêu cầu dữ liệu cá nhân</Link>
          </p>
        </div>
        <div>
          <h2>Thông tin liên hệ</h2>
          <p>Đầu mối tiếp nhận: Đang cập nhật.</p>
          <p>Gửi yêu cầu trực tiếp trong tài khoản Gói Huế.</p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© Gói Huế · Phong vị Cố Đô</span>
        <Link href="/privacy-policy">Chính sách bảo mật</Link>
        <Link href="/return-policy">Chính sách đổi trả</Link>
      </div>
    </footer>
  );
}
export function StatusMessages() {
  const { error, notice, busy } = useStore();
  return (
    <div className="store-messages" aria-live="polite">
      {busy && <p role="status">Đang xử lý…</p>}
      {error && (
        <p className="store-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="store-success" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

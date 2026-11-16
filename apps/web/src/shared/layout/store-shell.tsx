"use client";
import Link from "next/link";
import { BrandMark } from "./brand-mark";
import styles from "./store-shell.module.css";

export type StoreHeaderProps = { user: { name: string; role: string } | null; cartCount?: number; busy?: boolean; onLogout: () => void };
export type StoreFooterProps = { categories: readonly { id: string; code: string; name: string }[] };

export function StoreHeader({ user, cartCount = 0, busy = false, onLogout }: StoreHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.mainNav}>
        <div className={styles.brand}><BrandMark logoSrc="/images/stitch/asset-08.png" /></div>
        <form className={styles.search} action="/products">
          <label className="sr-only" htmlFor="search">
            Tìm sản phẩm
          </label>
          <input
            id="search"
            name="q"
            placeholder="Tìm kiếm mè xửng, mứt sen Tịnh Tâm, trà cung đình…"
          />
          <button aria-label="Tìm kiếm"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></svg></button>
        </form>
        <nav aria-label="Điều hướng chính">
          <Link href="/products">Bộ sưu tập</Link>
          <Link href="/#heritage-story">Câu chuyện Huế</Link>
        </nav>

        {user ? (
          <details className={styles.dropdown}>
            <summary className={styles.account} aria-label={`Tài khoản ${user.name}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 20v-2a7 7 0 0 1 14 0v2H5Z" /></svg><span className={styles.chevron} aria-hidden="true">⌄</span>
            </summary>
            <div className={styles.menu}>
              <strong>{String(user.name)}</strong>
              <Link href="/account">Tài khoản</Link>
              <Link href="/account/orders">Đơn hàng</Link>
              <Link href="/account/privacy">Quyền dữ liệu</Link>
              <Link href="/account/returns">Đổi trả của tôi</Link>
              {user.role === "ADMIN" && (
                <Link href="/admin">Quản trị</Link>
              )}
              <button disabled={busy} onClick={onLogout}>
                Đăng xuất
              </button>
            </div>
          </details>
        ) : (
          <Link className={styles.login} href="/login" aria-label="Đăng nhập">
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 20v-2a7 7 0 0 1 14 0v2H5Z" /></svg>
          </Link>
        )}
        <Link href="/cart" aria-label="Giỏ hàng" className={styles.cart}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16v14H4Z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></svg>
          {user?.role === "CUSTOMER" && (
            <b aria-label={`${cartCount} sản phẩm`}>
              {cartCount}
            </b>
          )}
        </Link>
      </div>
    </header>
  );
}
export function StoreFooter({ categories }: StoreFooterProps) {
  const giftCategory = categories.find(category => /quà|qua|gift/i.test(category.name));
  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div>
          <div className={styles.brand}><BrandMark logoSrc="/images/stitch/asset-08.png" /></div>
          <p>Gói ghém phong vị và nét văn hoá tao nhã Cố Đô gửi trao người trân quý. Mỗi thức quà là tấm lòng gìn giữ tinh hoa truyền thống cung đình và làng nghề sông Hương.</p>
          <span className={styles.heritageTag}>Mỹ vị dân gian &amp; Ngự thiện Cố Đô</span>
        </div>
        <div>
          <h2>Khám phá</h2>
          <ul className={styles.footerLinks}>
            <li><Link href="/products">Bộ sưu tập sản phẩm</Link></li>
            <li>{giftCategory ? <Link href={`/products?category=${encodeURIComponent(giftCategory.code)}`}>Set quà đoàn viên</Link> : <span title="Chưa có danh mục tương ứng">Set quà đoàn viên <small>(Đang cập nhật)</small></span>}</li>
            <li><span title="Chưa có chức năng xếp hạng bán chạy">Bán chạy nhất <small>(Đang cập nhật)</small></span></li>
          </ul>
        </div>
        <div>
          <h2>Chính sách &amp; Hỗ trợ</h2>
          <ul className={styles.footerLinks}>
            <li><Link href="/return-policy">Chính sách đổi trả <span className={styles.draft}>Bản thảo</span></Link></li>
            <li><span>Quy định giao hàng COD <small>(Đang cập nhật)</small></span></li>
            <li><span>Hướng dẫn bảo quản đặc sản <small>(Đang cập nhật)</small></span></li>
            <li><Link href="/privacy-policy">Chính sách bảo mật</Link></li>
          </ul>
        </div>
        <div>
          <h2>Thông tin liên hệ</h2>
          <div className={styles.contact}><span aria-hidden="true">⌖</span><div><strong>Xưởng &amp; Văn phòng:</strong><span>Đang cập nhật</span></div></div>
          <div className={styles.contact}><span aria-hidden="true">☎</span><div><strong>Hotline:</strong><span>Đang cập nhật</span></div></div>
          <div className={styles.contact}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1" /><path d="m3 6 9 7 9-7" /></svg><div><strong>Email hỗ trợ:</strong><span>Đang cập nhật</span></div></div>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <span>© 2025 Gói Huế. Gói trọn phong vị Cố Đô. Tất cả quyền được bảo lưu.</span>
      </div>
    </footer>
  );
}


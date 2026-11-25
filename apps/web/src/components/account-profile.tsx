"use client";

import Link from "next/link";
import { useState } from "react";
import { fields, useStore } from "@/lib/store";
import styles from "./account-profile.module.css";

export function AccountProfile() {
  const { state, busy, run, mutate } = useStore();
  const [success, setSuccess] = useState(false);
  if (!state) return null;
  const user = state.user;
  const initials = String(user.name || "Gói Huế").trim().split(/\s+/).slice(-2)
    .map(word => word[0]?.toUpperCase() || "").join("") || "GH";

  return <section className={styles.profile}>
    <header className={styles.heading}>
      <span className={styles.eyebrow}>{user.role === "ADMIN" ? "Tài khoản quản trị" : "Tài khoản Gói Huế"}</span>
      <h1>Hồ sơ cá nhân</h1>
      <p>Cập nhật thông tin liên hệ và lựa chọn những tin bạn muốn nhận.</p>
    </header>
    {success && <div className={styles.success} role="status">
      <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
      <div><strong>Đã lưu thay đổi</strong><p>Thông tin hồ sơ và lựa chọn nhận tin đã được cập nhật.</p></div>
      <button type="button" aria-label="Đóng thông báo" onClick={() => setSuccess(false)}>×</button>
    </div>}
    <div className={styles.identity}>
      <span className={styles.avatar} aria-hidden="true">{initials}</span>
      <div><strong>{String(user.name || "Tài khoản Gói Huế")}</strong><p>{String(user.email || "")}</p></div>
      <span className={styles.role}>{user.role === "ADMIN" ? "Quản trị viên" : "Khách hàng"}</span>
    </div>
    <form onReset={() => setSuccess(false)} onSubmit={event => {
      const form = event.currentTarget;
      const data = fields(event);
      const marketingGranted = form.querySelector<HTMLInputElement>('input[name="marketing"]')?.checked ?? false;
      setSuccess(false);
      void run(async () => {
        await mutate("command", "profile", { name: data.name, phone: data.phone, address: data.address });
        if (marketingGranted !== Boolean(user.marketing)) {
          await mutate("command", "consent", { granted: marketingGranted });
        }
        setSuccess(true);
      });
    }}>
      <div className={styles.grid}>
        <section className={styles.panel} aria-labelledby="profile-contact-title">
          <header className={styles.panelHeading}>
            <span className={`material-symbols-outlined ${styles.emblem}`} aria-hidden="true">person</span>
            <div><h2 id="profile-contact-title">Thông tin cá nhân</h2><p>Thông tin gắn với tài khoản của bạn.</p></div>
          </header>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor="profile-fullname">Họ và tên <span aria-hidden="true">*</span></label>
              <input id="profile-fullname" name="name" autoComplete="name" required maxLength={100}
                defaultValue={String(user.name ?? "")} disabled={busy} placeholder="Họ và tên của bạn" />
            </div>
            <div className={styles.field}>
              <label htmlFor="profile-email">Email đăng nhập</label>
              <input id="profile-email" type="email" autoComplete="email" readOnly
                defaultValue={String(user.email ?? "")} aria-describedby="profile-email-hint" />
              <small id="profile-email-hint">Email đăng nhập không thể thay đổi tại trang này.</small>
            </div>
            <div className={styles.field}>
              <label htmlFor="profile-phone">Số điện thoại <small>Không bắt buộc</small></label>
              <input id="profile-phone" name="phone" type="tel" autoComplete="tel" maxLength={30}
                defaultValue={String(user.phone ?? "")} disabled={busy} placeholder="Số điện thoại liên hệ" />
            </div>
          </div>
          <Link className={styles.securityLink} href="/account/security">
            <span className="material-symbols-outlined" aria-hidden="true">lock</span>
            <span>Quản lý mật khẩu và bảo mật</span><span aria-hidden="true">↗</span>
          </Link>
        </section>
        <section className={styles.panel} aria-labelledby="profile-preferences-title">
          <header className={styles.panelHeading}>
            <span className={`material-symbols-outlined ${styles.emblem}`} aria-hidden="true">tune</span>
            <div><h2 id="profile-preferences-title">Địa chỉ &amp; lựa chọn nhận tin</h2><p>Điều chỉnh theo nhu cầu của bạn.</p></div>
          </header>
          <div className={styles.field}>
            <label htmlFor="profile-address">Địa chỉ liên hệ <small>Không bắt buộc</small></label>
            <textarea id="profile-address" name="address" rows={4} autoComplete="street-address" maxLength={400}
              defaultValue={String(user.address ?? "")} disabled={busy} placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố" />
          </div>
          <label className={styles.marketing}>
            <input type="checkbox" name="marketing" defaultChecked={Boolean(user.marketing)} disabled={busy} />
            <span><strong>Nhận bản tin Gói Huế</strong><span>Đặc sản theo mùa và những thông tin mới từ cửa hàng. Bạn có thể thay đổi lựa chọn bất cứ lúc nào.</span></span>
          </label>
          <p className={styles.note}>Lựa chọn nhận bản tin được quản lý riêng với việc lưu hội thoại và cá nhân hóa của trợ lý. <Link href="/privacy-policy">Xem chính sách quyền riêng tư ↗</Link></p>
        </section>
      </div>
      <div className={styles.actions}>
        <p><span aria-hidden="true">*</span> Thông tin bắt buộc</p>
        <button type="reset" className={styles.secondary} disabled={busy}>Hủy thay đổi</button>
        <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Đang lưu…" : "Lưu thay đổi"}<span aria-hidden="true">→</span></button>
      </div>
    </form>
  </section>;
}

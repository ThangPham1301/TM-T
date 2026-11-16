"use client";

import { useState } from "react";
import { fields, useStore } from "@/lib/store";

export function AccountProfile() {
  const { state, busy, run, mutate } = useStore();
  const [success, setSuccess] = useState(false);

  if (!state) return null;
  const user = state.user;

  // Compute initials for the avatar
  const initials = String(user.name || "KH")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "GH";

  return (
    <div style={{ maxWidth: "1024px", width: "100%", margin: "0 auto" }}>
      {/* Success Toast Notification */}
      {success && (
        <div className="heritage-toast-banner" role="status">
          <div className="icon-box">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 className="title">Cập nhật thành công</h4>
            <p className="desc">
              Thông tin hồ sơ của quý khách đã được cập nhật thành công vào hệ thống của Gói Huế.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSuccess(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--af-outline)",
              padding: "4px",
            }}
            title="Đóng thông báo"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
          </button>
          <div className="accent-bar" />
        </div>
      )}

      {/* Page Header (Editorial Layout) */}
      <div className="account-hero-banner">
        <div className="account-hero-eyebrow">
          <span className="account-hero-dot" />
          <span>Thông tin tài khoản</span>
        </div>
        <h1 className="account-hero-title">Hồ sơ cá nhân</h1>
        <p className="account-hero-subtitle">
          Quản lý thông tin định danh và tùy chọn liên lạc của quý khách.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          const form = event.currentTarget;
          const data = fields(event);
          const marketingGranted = form.querySelector<HTMLInputElement>('input[name="marketing"]')?.checked ?? false;
          setSuccess(false);

          void run(async () => {
            await mutate("command", "profile", {
              name: data.name,
              phone: data.phone,
              address: data.address,
            });

            if (marketingGranted !== Boolean(user.marketing)) {
              await mutate("command", "consent", {
                granted: marketingGranted,
              });
            }

            setSuccess(true);
          });
        }}
      >
        {/* Top Profile Identification Card */}
        <div
          className="heritage-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1.5rem",
            marginBottom: "1.75rem",
          }}
        >
          <div
            style={{
              width: "76px",
              height: "76px",
              borderRadius: "50%",
              backgroundColor: "var(--af-surface-container)",
              color: "var(--af-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--gh-font-display)",
              fontSize: "26px",
              fontWeight: 700,
              flexShrink: 0,
              boxShadow: "inset 0 1px 3px rgba(53, 41, 31, 0.08)",
            }}
          >
            {initials}
          </div>
          <div>
            <h2
              style={{
                fontFamily: "var(--gh-font-body)",
                fontSize: "19px",
                fontWeight: 600,
                color: "var(--af-primary)",
                margin: 0,
              }}
            >
              {String(user.name || "Quý khách")}
            </h2>
            <p
              style={{
                fontFamily: "var(--gh-font-body)",
                fontSize: "14px",
                color: "var(--af-outline)",
                margin: "0.25rem 0 0",
              }}
            >
              {String(user.email || "")}
            </p>
          </div>
        </div>

        {/* Main Profile Information Form Cards (2 columns on tablet/desktop) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          {/* Card 1: Thông tin cá nhân */}
          <div className="heritage-card">
            <div className="heritage-card-header">
              <span className="material-symbols-outlined">person</span>
              <div>
                <h3 className="heritage-card-header-title">Thông tin cá nhân</h3>
                <p className="heritage-card-header-sub">Thông tin liên lạc và giao nhận đơn hàng</p>
              </div>
            </div>

            <div className="heritage-field-group">
              <label className="heritage-field-label" htmlFor="profile-fullname">
                Họ và tên <span className="required">*</span>
              </label>
              <div className="heritage-input-wrapper">
                <input
                  id="profile-fullname"
                  name="name"
                  type="text"
                  required
                  defaultValue={String(user.name ?? "")}
                  className="heritage-input"
                  placeholder="Ví dụ: Nguyễn Văn An"
                />
                <span className="material-symbols-outlined">edit</span>
              </div>
            </div>

            <div className="heritage-field-group">
              <label className="heritage-field-label" htmlFor="profile-email">
                Email <span className="required">*</span>
              </label>
              <div className="heritage-input-wrapper">
                <input
                  id="profile-email"
                  name="email"
                  type="email"
                  readOnly
                  disabled
                  defaultValue={String(user.email ?? "")}
                  className="heritage-input"
                  style={{ opacity: 0.85, cursor: "not-allowed" }}
                />
                <span className="material-symbols-outlined">mail</span>
              </div>
            </div>

            <div className="heritage-field-group" style={{ marginBottom: 0 }}>
              <label className="heritage-field-label" htmlFor="profile-phone">
                Số điện thoại <span className="required">*</span>
              </label>
              <div className="heritage-input-wrapper">
                <input
                  id="profile-phone"
                  name="phone"
                  type="tel"
                  required
                  defaultValue={String(user.phone ?? "")}
                  className="heritage-input"
                  placeholder="Ví dụ: 0905 123 456"
                />
                <span className="material-symbols-outlined">call</span>
              </div>
            </div>
          </div>

          {/* Card 2: Địa chỉ & Tùy chọn */}
          <div
            className="heritage-card"
            style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
          >
            <div>
              <div className="heritage-card-header">
                <span className="material-symbols-outlined">tune</span>
                <div>
                  <h3 className="heritage-card-header-title">Địa chỉ &amp; Tùy chọn</h3>
                  <p className="heritage-card-header-sub">Địa chỉ nhận hàng và tùy chọn nhận tin</p>
                </div>
              </div>

              <div className="heritage-field-group">
                <label className="heritage-field-label" htmlFor="profile-address">
                  Địa chỉ liên hệ <span className="required">*</span>
                </label>
                <div className="heritage-input-wrapper">
                  <textarea
                    id="profile-address"
                    name="address"
                    rows={3}
                    required
                    defaultValue={String(user.address ?? "")}
                    className="heritage-textarea"
                    placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành..."
                  />
                  <span className="material-symbols-outlined" style={{ top: "12px", right: "12px" }}>
                    pin_drop
                  </span>
                </div>
              </div>

              {/* Marketing newsletter checkbox */}
              <div
                style={{
                  backgroundColor: "var(--af-surface-container-low)",
                  padding: "1rem",
                  borderRadius: "0.5rem",
                  marginTop: "1rem",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="marketing"
                    defaultChecked={Boolean(user.marketing)}
                    style={{
                      marginTop: "3px",
                      width: "16px",
                      height: "16px",
                      accentColor: "var(--af-primary-container)",
                      cursor: "pointer",
                    }}
                  />
                  <div>
                    <span
                      style={{
                        fontFamily: "var(--gh-font-body)",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--af-primary)",
                        display: "block",
                      }}
                    >
                      Bản tin ẩm thực Huế
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--gh-font-body)",
                        fontSize: "13px",
                        color: "var(--af-on-surface-variant)",
                        display: "block",
                        marginTop: "2px",
                        lineHeight: 1.5,
                      }}
                    >
                      Nhận thông báo về các thức quà theo mùa và phong vị đặc sản mới của Gói Huế.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Reassurance note */}
            <div
              style={{
                marginTop: "1.25rem",
                padding: "0.85rem 1rem",
                borderRadius: "0.5rem",
                backgroundColor: "var(--af-surface-container-low)",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <span className="material-symbols-outlined" style={{ color: "var(--af-secondary-gold)", fontSize: "20px" }}>
                shield
              </span>
              <span style={{ fontSize: "12px", color: "var(--af-on-surface-variant)", lineHeight: 1.45 }}>
                Thông tin của quý khách được bảo mật nghiêm cẩn theo Quy chuẩn An toàn Dữ liệu Gói Huế.
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "1rem",
            paddingTop: "0.5rem",
          }}
        >
          <button
            type="reset"
            className="heritage-btn-secondary"
            disabled={busy}
            onClick={() => setSuccess(false)}
          >
            Hủy bỏ
          </button>
          <button type="submit" className="heritage-btn-primary group" disabled={busy}>
            <div className="gilded-corner" />
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>save</span>
            <span>{busy ? "Đang lưu..." : "Lưu thay đổi"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

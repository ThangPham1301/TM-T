"use client";

import { useState } from "react";
import { api, fields, useStore } from "@/lib/store";

export function AccountSecurity() {
  const { busy, run } = useStore();
  const [success, setSuccess] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newPasswordVal, setNewPasswordVal] = useState("");

  // Evaluate password strength
  const getStrength = (val: string) => {
    if (!val) return { score: 0, text: "Chưa nhập", color: "var(--af-outline)" };
    let score = 0;
    if (val.length >= 8) score++;
    if (val.length >= 12) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/[0-9]/.test(val) && /[^A-Za-z0-9]/.test(val)) score++;

    if (score <= 1) return { score: 1, text: "Yếu", color: "var(--af-error)" };
    if (score === 2) return { score: 2, text: "Trung bình", color: "var(--af-secondary-gold)" };
    if (score === 3) return { score: 3, text: "Khá mạnh", color: "#4caf50" };
    return { score: 4, text: "Rất mạnh", color: "#2e7d32" };
  };

  const strength = getStrength(newPasswordVal);

  return (
    <div style={{ maxWidth: "1120px", width: "100%", margin: "0 auto" }}>
      {/* Top Heritage Breadcrumb / Header Area */}
      <div className="account-hero-banner">
        <div className="account-hero-eyebrow">
          <span className="account-hero-dot" />
          <span>Bảo mật</span>
        </div>
        <h1 className="account-hero-title">Bảo mật tài khoản</h1>
        <p className="account-hero-subtitle">
          Quản lý mật khẩu và bảo mật thông tin tài khoản của bạn.
        </p>
      </div>

      {/* Success Toast */}
      {success && (
        <div className="heritage-toast-banner" role="status">
          <div className="icon-box">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 className="title">Đổi mật khẩu thành công</h4>
            <p className="desc">
              Mật khẩu mới đã được cập nhật an toàn. Các phiên đăng nhập trên thiết bị khác đã được kết thúc.
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
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
          </button>
          <div className="accent-bar" />
        </div>
      )}

      {/* Main Grid: Two-Column Structure (Left 7, Right 5) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "2rem",
          alignItems: "flex-start",
        }}
      >
        {/* LEFT COLUMN: Password Change Form */}
        <div>
          <div
            className="heritage-card"
            style={{
              padding: 0,
              overflow: "hidden",
            }}
          >
            {/* Top gradient stripe */}
            <div
              style={{
                height: "6px",
                width: "100%",
                background: "linear-gradient(90deg, var(--af-secondary), var(--af-secondary-container), var(--af-primary))",
              }}
            />

            <div style={{ padding: "1.75rem 2rem 2rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  paddingBottom: "1rem",
                  borderBottom: "1px solid var(--af-surface-container)",
                  marginBottom: "1.5rem",
                }}
              >
                <span className="material-symbols-outlined" style={{ color: "var(--af-secondary)", fontSize: "28px" }}>
                  lock_reset
                </span>
                <div>
                  <h2
                    style={{
                      fontFamily: "var(--gh-font-display)",
                      fontSize: "20px",
                      fontWeight: 600,
                      color: "var(--af-primary)",
                      margin: 0,
                    }}
                  >
                    Thay đổi mật khẩu đăng nhập
                  </h2>
                  <p
                    style={{
                      fontFamily: "var(--gh-font-body)",
                      fontSize: "13px",
                      color: "var(--af-on-surface-variant)",
                      margin: "0.2rem 0 0",
                    }}
                  >
                    Đổi mật khẩu định kỳ để nâng cao tính an toàn cho tài khoản
                  </p>
                </div>
              </div>

              <form
                onSubmit={(event) => {
                  const form = event.currentTarget;
                  const { currentPassword, newPassword, confirmation } = fields(event);
                  setSuccess(false);

                  void run(async () => {
                    if (newPassword !== confirmation) {
                      throw new Error("Mật khẩu xác nhận chưa khớp với mật khẩu mới.");
                    }
                    await api("password", "POST", { currentPassword, newPassword });
                    form.reset();
                    setNewPasswordVal("");
                    setSuccess(true);
                  });
                }}
              >
                {/* Current Password */}
                <div className="heritage-field-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label className="heritage-field-label" htmlFor="sec-current-pwd">
                      Mật khẩu hiện tại <span className="required">*</span>
                    </label>
                  </div>
                  <div className="heritage-input-wrapper">
                    <input
                      id="sec-current-pwd"
                      name="currentPassword"
                      type={showCurrent ? "text" : "password"}
                      required
                      maxLength={72}
                      placeholder="Nhập mật khẩu hiện tại"
                      className="heritage-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--af-outline)",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title={showCurrent ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                        {showCurrent ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="heritage-field-group">
                  <label className="heritage-field-label" htmlFor="sec-new-pwd">
                    Mật khẩu mới <span className="required">*</span>
                  </label>
                  <div className="heritage-input-wrapper">
                    <input
                      id="sec-new-pwd"
                      name="newPassword"
                      type={showNew ? "text" : "password"}
                      required
                      minLength={12}
                      maxLength={72}
                      value={newPasswordVal}
                      onChange={(e) => setNewPasswordVal(e.target.value)}
                      placeholder="Nhập mật khẩu mới (tối thiểu 12 ký tự)"
                      className="heritage-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--af-outline)",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title={showNew ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                        {showNew ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>

                  {/* Password requirement & strength meter */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "0.4rem",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "12px",
                        color: "var(--af-on-surface-variant)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "var(--af-secondary)" }}>
                        info
                      </span>
                      <span>Độ dài yêu cầu: 12 – 72 ký tự.</span>
                    </p>

                    {newPasswordVal && (
                      <span style={{ fontSize: "12px", fontWeight: 600, color: strength.color }}>
                        {strength.text}
                      </span>
                    )}
                  </div>

                  {/* 4 strength bars */}
                  <div className="password-strength-grid">
                    {[1, 2, 3, 4].map((barIndex) => {
                      const isActive = strength.score >= barIndex;
                      let barClass = "password-strength-bar";
                      if (isActive) {
                        if (strength.score <= 1) barClass += " active-weak";
                        else if (strength.score <= 2) barClass += " active-medium";
                        else barClass += " active-strong";
                      }
                      return <div key={barIndex} className={barClass} />;
                    })}
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="heritage-field-group">
                  <label className="heritage-field-label" htmlFor="sec-confirm-pwd">
                    Xác nhận mật khẩu mới <span className="required">*</span>
                  </label>
                  <div className="heritage-input-wrapper">
                    <input
                      id="sec-confirm-pwd"
                      name="confirmation"
                      type={showConfirm ? "text" : "password"}
                      required
                      minLength={12}
                      maxLength={72}
                      placeholder="Nhập lại mật khẩu mới"
                      className="heritage-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--af-outline)",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title={showConfirm ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                        {showConfirm ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Concise Security Notice Box */}
                <div
                  style={{
                    backgroundColor: "var(--af-surface-container)",
                    borderRadius: "0.5rem",
                    padding: "1rem",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ color: "var(--af-secondary)", fontSize: "24px", flexShrink: 0, marginTop: "2px" }}
                  >
                    shield_with_heart
                  </span>
                  <div>
                    <h4
                      style={{
                        fontFamily: "var(--gh-font-body)",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--af-primary)",
                        margin: 0,
                      }}
                    >
                      Lưu ý an toàn
                    </h4>
                    <p
                      style={{
                        fontFamily: "var(--gh-font-body)",
                        fontSize: "13px",
                        color: "var(--af-on-surface-variant)",
                        margin: "0.25rem 0 0",
                        lineHeight: 1.5,
                      }}
                    >
                      Để bảo vệ tài khoản, các phiên đăng nhập khác sẽ được kết thúc sau khi đổi mật khẩu thành công.
                    </p>
                  </div>
                </div>

                {/* CTA Actions */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "0.75rem",
                    paddingTop: "0.5rem",
                    borderTop: "1px solid var(--af-surface-container)",
                  }}
                >
                  <button
                    type="reset"
                    className="heritage-btn-secondary"
                    disabled={busy}
                    onClick={() => {
                      setNewPasswordVal("");
                      setSuccess(false);
                    }}
                  >
                    Hủy
                  </button>
                  <button type="submit" className="heritage-btn-primary group" disabled={busy}>
                    <div className="gilded-corner" />
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>check_circle</span>
                    <span>{busy ? "Đang xử lý..." : "Đổi mật khẩu"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Security Tips & Best Practices */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Card: Lưu ý bảo mật */}
          <div className="heritage-card">
            <div className="heritage-card-header">
              <span className="material-symbols-outlined">security</span>
              <h3 className="heritage-card-header-title">Lưu ý bảo mật tài khoản</h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Tip 1 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  backgroundColor: "var(--af-surface-container-low)",
                  padding: "1rem",
                  borderRadius: "0.5rem",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: "var(--af-surface-container-high)",
                    color: "var(--af-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>key_off</span>
                </div>
                <div>
                  <strong style={{ fontSize: "14px", color: "var(--af-primary)", display: "block" }}>
                    Không chia sẻ mật khẩu
                  </strong>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "13px", color: "var(--af-on-surface-variant)", lineHeight: 1.5 }}>
                    Không chia sẻ mật khẩu tài khoản cho bất kỳ ai, kể cả người thân hoặc nhân viên hỗ trợ.
                  </p>
                </div>
              </div>

              {/* Tip 2 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  backgroundColor: "var(--af-surface-container-low)",
                  padding: "1rem",
                  borderRadius: "0.5rem",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: "var(--af-surface-container-high)",
                    color: "var(--af-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>phonelink_lock</span>
                </div>
                <div>
                  <strong style={{ fontSize: "14px", color: "var(--af-primary)", display: "block" }}>
                    Cảnh giác yêu cầu OTP
                  </strong>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "13px", color: "var(--af-on-surface-variant)", lineHeight: 1.5 }}>
                    Gói Huế không bao giờ yêu cầu cung cấp mã OTP hoặc mật khẩu qua điện thoại, tin nhắn hay mạng xã hội.
                  </p>
                </div>
              </div>

              {/* Tip 3 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  backgroundColor: "var(--af-surface-container-low)",
                  padding: "1rem",
                  borderRadius: "0.5rem",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: "var(--af-surface-container-high)",
                    color: "var(--af-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>lock_clock</span>
                </div>
                <div>
                  <strong style={{ fontSize: "14px", color: "var(--af-primary)", display: "block" }}>
                    Mật khẩu mạnh &amp; độc nhất
                  </strong>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "13px", color: "var(--af-on-surface-variant)", lineHeight: 1.5 }}>
                    Nên kết hợp chữ hoa, chữ thường, chữ số và ký tự đặc biệt, tránh sử dụng lại mật khẩu của các dịch vụ khác.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Cultural Vignette Card */}
          <div
            style={{
              backgroundColor: "var(--af-surface-container-low)",
              borderRadius: "0.75rem",
              padding: "1.25rem 1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              border: "1px solid var(--af-surface-container)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "0.5rem",
                backgroundColor: "var(--af-surface-container-highest)",
                color: "var(--af-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "26px" }}>auto_stories</span>
            </div>
            <div>
              <p
                style={{
                  fontFamily: "var(--gh-font-display)",
                  fontStyle: "italic",
                  fontSize: "15px",
                  color: "var(--af-primary)",
                  margin: 0,
                  lineHeight: 1.45,
                }}
              >
                &ldquo;Cẩn thận từng phong bao, giữ trọn chữ Tín với khách thập phương.&rdquo;
              </p>
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--af-outline)",
                  display: "block",
                  marginTop: "0.3rem",
                }}
              >
                Tôn chỉ bảo mật thông tin bưu phẩm đặc sản Gói Huế
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

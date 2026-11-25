"use client";

import { useRef, useState } from "react";
import { date, label, type Row, useStore } from "@/lib/store";
import { AiPreferences } from "./ai-preferences";

export function AccountPrivacy() {
  const { state, busy, run, mutate } = useStore();
  const [selectedType, setSelectedType] = useState<string>("EXPORT");
  const [requestNote, setRequestNote] = useState<string>("");
  const [successToast, setSuccessToast] = useState<{ title: string; message: string } | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Row | null>(null);

  const formRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  if (!state) return null;
  const privacyList = state.privacy || [];

  const handleSelectType = (val: string) => {
    setSelectedType(val);
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const getFormattedCode = (record: Row) => {
    if (record.code) return String(record.code);
    return `#PR-${String(record.id).slice(0, 4).toUpperCase()}`;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "RESOLVED":
        return "completed";
      case "REVIEWING":
        return "reviewing";
      case "REJECTED":
        return "rejected";
      default:
        return "submitted";
    }
  };

  return (
    <div style={{ maxWidth: "1024px", width: "100%", margin: "0 auto", paddingBottom: "3rem" }}>
      {/* Toast Notification */}
      {successToast && (
        <div className="heritage-toast-banner" role="status">
          <div className="icon-box">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 className="title">{successToast.title}</h4>
            <p className="desc">{successToast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
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

      {/* Page Header */}
      <div className="account-hero-banner">
        <div className="account-hero-eyebrow">
          <span className="account-hero-dot" />
          <span>Trung tâm quyền riêng tư</span>
        </div>
        <h1 className="account-hero-title">Quyền riêng tư &amp; Dữ liệu cá nhân</h1>
        <p className="account-hero-subtitle">
          Quản lý thông tin và thực hiện các quyền đối với dữ liệu cá nhân của bạn theo quy định pháp luật.
        </p>
      </div>

      <AiPreferences />
      {/* SECTION A: Quyền của bạn (5 Cards) */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h2
          style={{
            fontFamily: "var(--gh-font-display)",
            fontSize: "22px",
            fontWeight: 600,
            color: "var(--af-primary)",
            marginBottom: "1rem",
          }}
        >
          Quyền của bạn
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
          }}
        >
          {/* Card 1: Xem dữ liệu */}
          <div
            onClick={() => handleSelectType("ACCESS")}
            className="group"
            style={{
              cursor: "pointer",
              borderRadius: "0.75rem",
              backgroundColor: "var(--af-surface-container-low)",
              padding: "1rem",
              border: "1px solid var(--af-surface-container)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              transition: "all 0.2s ease",
            }}
          >
            <div>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "0.5rem",
                  backgroundColor: "var(--af-surface-container-lowest)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--af-primary)",
                  marginBottom: "0.6rem",
                  boxShadow: "0 1px 3px rgba(53, 41, 31, 0.05)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>visibility</span>
              </div>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--af-primary)", margin: "0 0 0.35rem" }}>
                Xem dữ liệu cá nhân
              </h3>
              <p style={{ fontSize: "12px", color: "var(--af-on-surface-variant)", lineHeight: 1.45, margin: 0 }}>
                Tra cứu dữ liệu định danh, lịch sử đơn hàng và địa chỉ đang lưu trữ.
              </p>
            </div>
            <div
              style={{
                marginTop: "0.85rem",
                paddingTop: "0.5rem",
                borderTop: "1px solid var(--af-surface-container)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "var(--af-secondary)",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              <span>Chọn quyền</span>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
            </div>
          </div>

          {/* Card 2: Xuất dữ liệu */}
          <div
            onClick={() => handleSelectType("EXPORT")}
            className="group"
            style={{
              cursor: "pointer",
              borderRadius: "0.75rem",
              backgroundColor: "var(--af-surface-container-low)",
              padding: "1rem",
              border: "1px solid var(--af-surface-container)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              transition: "all 0.2s ease",
            }}
          >
            <div>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "0.5rem",
                  backgroundColor: "var(--af-surface-container-lowest)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--af-primary)",
                  marginBottom: "0.6rem",
                  boxShadow: "0 1px 3px rgba(53, 41, 31, 0.05)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>download</span>
              </div>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--af-primary)", margin: "0 0 0.35rem" }}>
                Xuất dữ liệu cá nhân
              </h3>
              <p style={{ fontSize: "12px", color: "var(--af-on-surface-variant)", lineHeight: 1.45, margin: 0 }}>
                Yêu cầu đóng gói dữ liệu hồ sơ định dạng lưu trữ máy tính (JSON/PDF).
              </p>
            </div>
            <div
              style={{
                marginTop: "0.85rem",
                paddingTop: "0.5rem",
                borderTop: "1px solid var(--af-surface-container)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "var(--af-secondary)",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              <span>Chọn quyền</span>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
            </div>
          </div>

          {/* Card 3: Yêu cầu xóa dữ liệu */}
          <div
            onClick={() => handleSelectType("DELETE")}
            className="group"
            style={{
              cursor: "pointer",
              borderRadius: "0.75rem",
              backgroundColor: "var(--af-surface-container-low)",
              padding: "1rem",
              border: "1px solid var(--af-surface-container)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              transition: "all 0.2s ease",
            }}
          >
            <div>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "0.5rem",
                  backgroundColor: "var(--af-surface-container-lowest)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--af-error)",
                  marginBottom: "0.6rem",
                  boxShadow: "0 1px 3px rgba(53, 41, 31, 0.05)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>delete</span>
              </div>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--af-primary)", margin: "0 0 0.35rem" }}>
                Yêu cầu xóa dữ liệu
              </h3>
              <p style={{ fontSize: "12px", color: "var(--af-on-surface-variant)", lineHeight: 1.45, margin: 0 }}>
                Đề nghị thu hồi và xóa dữ liệu cá nhân theo quy định về lưu trữ pháp lý.
              </p>
            </div>
            <div
              style={{
                marginTop: "0.85rem",
                paddingTop: "0.5rem",
                borderTop: "1px solid var(--af-surface-container)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "var(--af-error)",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              <span>Chọn quyền</span>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
            </div>
          </div>

          {/* Card 4: Hạn chế xử lý dữ liệu */}
          <div
            onClick={() => handleSelectType("RESTRICT")}
            className="group"
            style={{
              cursor: "pointer",
              borderRadius: "0.75rem",
              backgroundColor: "var(--af-surface-container-low)",
              padding: "1rem",
              border: "1px solid var(--af-surface-container)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              transition: "all 0.2s ease",
            }}
          >
            <div>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "0.5rem",
                  backgroundColor: "var(--af-surface-container-lowest)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--af-primary)",
                  marginBottom: "0.6rem",
                  boxShadow: "0 1px 3px rgba(53, 41, 31, 0.05)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>tune</span>
              </div>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--af-primary)", margin: "0 0 0.35rem" }}>
                Hạn chế xử lý dữ liệu
              </h3>
              <p style={{ fontSize: "12px", color: "var(--af-on-surface-variant)", lineHeight: 1.45, margin: 0 }}>
                Tạm ngưng tiếp thị, thông báo tin mới và giới hạn phạm vi chia sẻ.
              </p>
            </div>
            <div
              style={{
                marginTop: "0.85rem",
                paddingTop: "0.5rem",
                borderTop: "1px solid var(--af-surface-container)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "var(--af-secondary)",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              <span>Chọn quyền</span>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
            </div>
          </div>

          {/* Card 5: Gửi khiếu nại */}
          <div
            onClick={() => handleSelectType("COMPLAINT")}
            className="group"
            style={{
              cursor: "pointer",
              borderRadius: "0.75rem",
              backgroundColor: "var(--af-surface-container-low)",
              padding: "1rem",
              border: "1px solid var(--af-surface-container)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              transition: "all 0.2s ease",
            }}
          >
            <div>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "0.5rem",
                  backgroundColor: "var(--af-surface-container-lowest)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--af-primary)",
                  marginBottom: "0.6rem",
                  boxShadow: "0 1px 3px rgba(53, 41, 31, 0.05)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>gavel</span>
              </div>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--af-primary)", margin: "0 0 0.35rem" }}>
                Gửi khiếu nại
              </h3>
              <p style={{ fontSize: "12px", color: "var(--af-on-surface-variant)", lineHeight: 1.45, margin: 0 }}>
                Gửi ý kiến phản ánh về quyền riêng tư trực tiếp đến ban quản trị.
              </p>
            </div>
            <div
              style={{
                marginTop: "0.85rem",
                paddingTop: "0.5rem",
                borderTop: "1px solid var(--af-surface-container)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "var(--af-secondary)",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              <span>Chọn quyền</span>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION B: Gửi yêu cầu về dữ liệu cá nhân */}
      <div ref={formRef} className="heritage-card" style={{ marginBottom: "2.5rem" }}>
        <div style={{ borderBottom: "1px solid var(--af-surface-container-low)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
          <h2
            style={{
              fontFamily: "var(--gh-font-display)",
              fontSize: "22px",
              fontWeight: 600,
              color: "var(--af-primary)",
              margin: 0,
            }}
          >
            Gửi yêu cầu về dữ liệu cá nhân
          </h2>
          <p
            style={{
              fontFamily: "var(--gh-font-body)",
              fontSize: "14px",
              color: "var(--af-on-surface-variant)",
              marginTop: "0.3rem",
              marginBottom: 0,
            }}
          >
            Vui lòng chọn loại yêu cầu và cung cấp thông tin chi tiết để chúng tôi tiếp nhận và xử lý.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const desc = requestNote.trim();
            if (!desc) return;

            void run(async () => {
              const res = await mutate("command", "privacy-create", {
                type: selectedType,
                description: desc,
              });

              setRequestNote("");
              const code = res?.id ? `#PR-${String(res.id).slice(0, 4).toUpperCase()}` : "#PR-NEW";
              setSuccessToast({
                title: "Yêu cầu đã được tiếp nhận",
                message: `Hồ sơ ${code} đã được ghi nhận vào hệ thống để bộ phận quản trị xử lý.`,
              });
            });
          }}
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "800px" }}
        >
          {/* Request Type Select */}
          <div className="heritage-field-group">
            <label className="heritage-field-label" htmlFor="privacy-type-select">
              Loại yêu cầu <span className="required">*</span>
            </label>
            <div className="heritage-input-wrapper">
              <select
                id="privacy-type-select"
                ref={selectRef}
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="heritage-input"
                style={{ appearance: "none", cursor: "pointer" }}
              >
                <option value="ACCESS">Xem dữ liệu cá nhân</option>
                <option value="EXPORT">Xuất dữ liệu cá nhân (JSON / PDF)</option>
                <option value="DELETE">Yêu cầu xóa dữ liệu</option>
                <option value="RESTRICT">Hạn chế xử lý dữ liệu</option>
                <option value="COMPLAINT">Gửi khiếu nại</option>
              </select>
              <span className="material-symbols-outlined" style={{ pointerEvents: "none" }}>
                expand_more
              </span>
            </div>
          </div>

          {/* Description Textarea */}
          <div className="heritage-field-group">
            <label className="heritage-field-label" htmlFor="privacy-note">
              Mô tả và ghi chú chi tiết <span className="required">*</span>
            </label>
            <textarea
              id="privacy-note"
              required
              rows={4}
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              placeholder="Vui lòng ghi rõ thông tin cần truy xuất, lý do hoặc phạm vi dữ liệu mong muốn được hỗ trợ..."
              className="heritage-textarea"
            />
          </div>

          {/* Warning / Explanation Box */}
          <div
            style={{
              backgroundColor: "var(--af-surface-container-low)",
              padding: "1rem 1.25rem",
              borderRadius: "0.5rem",
              borderLeft: selectedType === "DELETE" ? "4px solid var(--af-error)" : "4px solid var(--af-secondary)",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: "20px",
                color: selectedType === "DELETE" ? "var(--af-error)" : "var(--af-secondary)",
                marginTop: "1px",
              }}
            >
              info
            </span>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--af-on-surface-variant)", lineHeight: 1.55 }}>
              {selectedType === "DELETE" ? (
                <>
                  <strong style={{ color: "var(--af-primary)" }}>Đóng tài khoản.</strong> Quản trị viên kiểm tra đơn hàng
                  và hồ sơ đổi trả đang mở trước khi xử lý. Một số dữ liệu giao dịch có thể được giữ lại để đối soát.
                </>
              ) : selectedType === "EXPORT" ? (
                <>
                  <strong style={{ color: "var(--af-primary)" }}>Xuất dữ liệu.</strong> Khi yêu cầu hoàn tất, bạn có thể
                  tải bản sao dữ liệu tài khoản tại mục Lịch sử yêu cầu.
                </>
              ) : (
                <>
                  <strong style={{ color: "var(--af-primary)" }}>Theo dõi yêu cầu.</strong> Quản trị viên phản hồi và
                  có thể yêu cầu bổ sung thông tin tại mục Lịch sử yêu cầu.
                </>
              )}
            </p>
          </div>

          {/* Submit button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.5rem" }}>
            <button type="submit" className="heritage-btn-primary group" disabled={busy}>
              <div className="gilded-corner" />
              <span>Gửi yêu cầu dữ liệu</span>
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>send</span>
            </button>
            <span style={{ fontSize: "13px", color: "var(--af-on-surface-variant)" }}>
              Phản hồi sẽ được cập nhật tại mục Lịch sử yêu cầu
            </span>
          </div>
        </form>
      </div>

      {/* SECTION C: Lịch sử yêu cầu */}
      <div className="heritage-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "1.5rem 1.75rem",
            backgroundColor: "rgba(255, 241, 232, 0.45)",
            borderBottom: "1px solid var(--af-surface-container)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
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
              Lịch sử yêu cầu
            </h2>
            <p style={{ fontSize: "13px", color: "var(--af-on-surface-variant)", margin: "0.2rem 0 0" }}>
              Theo dõi tiến độ và kết quả các yêu cầu dữ liệu cá nhân của bạn
            </p>
          </div>
          <span
            style={{
              padding: "0.35rem 0.85rem",
              borderRadius: "999px",
              backgroundColor: "var(--af-surface-container-high)",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--af-primary)",
            }}
          >
            {privacyList.length} yêu cầu đã ghi nhận
          </span>
        </div>

        {privacyList.length === 0 ? (
          <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: "var(--af-outline)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "36px", marginBottom: "0.5rem" }}>
              folder_off
            </span>
            <p style={{ margin: 0, fontSize: "14px" }}>Quý khách chưa gửi yêu cầu quyền dữ liệu nào.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="privacy-table">
              <thead>
                <tr>
                  <th>Mã yêu cầu</th>
                  <th>Loại</th>
                  <th>Ngày gửi</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {privacyList.map((rec) => {
                  const code = getFormattedCode(rec);
                  const typeLabel = label(rec.type);
                  const statusLabel = label(rec.status);
                  const isExportReady = rec.type === "EXPORT" && rec.status === "COMPLETED" && rec.export;

                  return (
                    <tr key={rec.id}>
                      <td style={{ fontWeight: 600, color: "var(--af-primary)" }}>{code}</td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{typeLabel}</span>
                      </td>
                      <td style={{ color: "var(--af-on-surface-variant)" }}>{date(rec.createdAt)}</td>
                      <td>
                        <span className={`heritage-status-pill ${getStatusBadgeClass(String(rec.status))}`}>
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              backgroundColor: "currentColor",
                            }}
                          />
                          <span>{statusLabel}</span>
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                          {isExportReady ? (
                            <a
                              href={`/api/store/privacy/${rec.id}/export`}
                              download={`goi-hue-data-${code.replace("#", "")}.json`}
                              className="heritage-btn-primary"
                              style={{
                                padding: "0.35rem 0.85rem",
                                fontSize: "12px",
                                textDecoration: "none",
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>download</span>
                              <span>Tải tệp JSON</span>
                            </a>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => setSelectedRecord(rec)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                              padding: "0.35rem 0.75rem",
                              borderRadius: "0.5rem",
                              backgroundColor: "var(--af-surface-container-low)",
                              border: "1px solid var(--af-surface-container)",
                              color: "var(--af-primary)",
                              fontFamily: "var(--gh-font-body)",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>visibility</span>
                            <span>Xem chi tiết</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedRecord && (
        <div className="heritage-modal-overlay">
          <div className="heritage-modal-card" style={{ maxWidth: "560px" }}>
            <div className="heritage-modal-header">
              <div>
                <span className="account-hero-eyebrow">Chi tiết hồ sơ dữ liệu</span>
                <h3>{getFormattedCode(selectedRecord)}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: "var(--af-surface-container)",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--af-on-surface-variant)",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
              </button>
            </div>

            <div className="heritage-modal-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "0.75rem",
                  borderBottom: "1px solid var(--af-surface-container)",
                }}
              >
                <div>
                  <span style={{ fontSize: "12px", color: "var(--af-outline)", display: "block" }}>Loại yêu cầu</span>
                  <strong style={{ fontSize: "15px", color: "var(--af-primary)" }}>{label(selectedRecord.type)}</strong>
                </div>
                <div>
                  <span className={`heritage-status-pill ${getStatusBadgeClass(String(selectedRecord.status))}`}>
                    {label(selectedRecord.status)}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: "12px", color: "var(--af-outline)", display: "block", marginBottom: "0.25rem" }}>
                  Mô tả của quý khách
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    lineHeight: 1.55,
                    backgroundColor: "var(--af-surface-container-low)",
                    padding: "0.75rem 1rem",
                    borderRadius: "0.5rem",
                  }}
                >
                  {String(selectedRecord.description || "Không có ghi chú thêm.")}
                </p>
              </div>

              {Boolean(selectedRecord.result) && (
                <div>
                  <span style={{ fontSize: "12px", color: "var(--af-outline)", display: "block", marginBottom: "0.25rem" }}>
                    Kết quả từ Ban Quản trị
                  </span>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      lineHeight: 1.55,
                      backgroundColor: "rgba(254, 197, 109, 0.2)",
                      border: "1px solid rgba(201, 150, 67, 0.3)",
                      padding: "0.75rem 1rem",
                      borderRadius: "0.5rem",
                      color: "var(--af-primary)",
                    }}
                  >
                    {String(selectedRecord.result)}
                  </p>
                </div>
              )}

              {/* Timeline */}
              {Array.isArray(selectedRecord.history) && selectedRecord.history.length > 0 && (
                <div>
                  <span style={{ fontSize: "12px", color: "var(--af-outline)", display: "block", marginBottom: "0.5rem" }}>
                    Nhật ký xử lý
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {(selectedRecord.history as Row[]).map((h, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.6rem",
                          fontSize: "13px",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "16px", color: "var(--af-secondary)", marginTop: "2px" }}
                        >
                          check_circle
                        </span>
                        <div>
                          <strong style={{ color: "var(--af-primary)" }}>{String(h.note || label(h.status))}</strong>
                          <span style={{ color: "var(--af-outline)", marginLeft: "0.5rem", fontSize: "11px" }}>
                            {date(h.at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="heritage-modal-footer">
              {selectedRecord.type === "EXPORT" && selectedRecord.status === "COMPLETED" && Boolean(selectedRecord.export || selectedRecord.data) && (
                <a
                  href={`/api/store/privacy/${selectedRecord.id}/export`}
                  download={`goi-hue-data-${getFormattedCode(selectedRecord).replace("#", "")}.json`}
                  className="heritage-btn-primary"
                  style={{ textDecoration: "none" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>download</span>
                  <span>Tải tệp JSON</span>
                </a>
              )}
              <button
                type="button"
                className="heritage-btn-secondary"
                onClick={() => setSelectedRecord(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

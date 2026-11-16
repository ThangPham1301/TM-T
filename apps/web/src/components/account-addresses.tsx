"use client";

import { useState } from "react";
import { fields, type Row, useStore } from "@/lib/store";

export function AccountAddresses() {
  const { state, busy, run, mutate } = useStore();
  const [editingAddress, setEditingAddress] = useState<Row | "new" | null>(null);
  const [addressToDelete, setAddressToDelete] = useState<Row | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("Nhà riêng");

  if (!state) return null;
  const addresses = state.addresses || [];

  return (
    <div style={{ maxWidth: "1024px", width: "100%", margin: "0 auto" }}>
      {/* Header / Action bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "1.25rem",
          paddingBottom: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "600px" }}>
          <div className="account-hero-eyebrow">
            <span className="account-hero-dot" />
            <span>Thiết lập tài khoản</span>
          </div>
          <h1 className="account-hero-title">Sổ địa chỉ nhận hàng</h1>
          <p className="account-hero-subtitle">
            Quản lý các địa chỉ giao nhận quà tặng để thanh toán thuận tiện và nhanh chóng.
          </p>
        </div>

        {/* Action button with court origami motif */}
        <div>
          <button
            type="button"
            className="heritage-btn-primary group"
            disabled={busy}
            onClick={() => {
              setSelectedLabel("Nhà riêng");
              setEditingAddress("new");
            }}
          >
            <div className="gilded-corner" />
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>add</span>
            <span style={{ fontWeight: 500 }}>Thêm địa chỉ mới</span>
          </button>
        </div>
      </div>

      {/* Decorative Imperial Divider */}
      <div className="imperial-divider">
        <div className="imperial-divider-line" />
        <div className="imperial-divider-motifs">
          <span className="imperial-diamond-sm" />
          <span className="imperial-diamond-md" />
          <span className="imperial-diamond-sm" />
        </div>
      </div>

      {/* Address Grid */}
      <div style={{ paddingTop: "1rem" }}>
        {addresses.length === 0 ? (
          /* Empty Address State */
          <div
            style={{
              padding: "3.5rem 2rem",
              textAlign: "center",
              backgroundColor: "var(--af-surface-container-low)",
              borderRadius: "0.75rem",
              marginTop: "1.5rem",
              border: "1px dashed var(--af-outline-variant)",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                margin: "0 auto 1rem",
                borderRadius: "50%",
                backgroundColor: "var(--af-surface-container)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--af-outline)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>location_off</span>
            </div>
            <h3
              style={{
                fontFamily: "var(--gh-font-display)",
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--af-primary)",
                margin: 0,
              }}
            >
              Bạn chưa có địa chỉ nhận hàng
            </h3>
            <p
              style={{
                fontFamily: "var(--gh-font-body)",
                fontSize: "14px",
                color: "var(--af-on-surface-variant)",
                marginTop: "0.5rem",
                marginBottom: "1.5rem",
              }}
            >
              Thêm địa chỉ giao hàng để đặt bánh mứt Cố Đô nhanh chóng và thuận tiện.
            </p>
            <button
              type="button"
              className="heritage-btn-primary group"
              disabled={busy}
              onClick={() => {
                setSelectedLabel("Nhà riêng");
                setEditingAddress("new");
              }}
            >
              <div className="gilded-corner" />
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
              <span>Thêm địa chỉ đầu tiên</span>
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {addresses.map((addr) => {
              const labelText = String(addr.label || "Nhà riêng");
              const isDefault = Boolean(addr.isDefault);
              const isHome = /nhà|home/i.test(labelText);
              const isOffice = /văn phòng|công ty|office/i.test(labelText);

              return (
                <div
                  key={addr.id}
                  className="heritage-card group"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "1.5rem 1.75rem",
                  }}
                >
                  <div className="gilded-corner" />
                  <div>
                    {/* Header: Label Tag & Default Badge */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "1rem",
                      }}
                    >
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          padding: "0.25rem 0.75rem",
                          borderRadius: "999px",
                          backgroundColor: isDefault
                            ? "rgba(254, 197, 109, 0.35)"
                            : "var(--af-surface-container)",
                          color: isDefault
                            ? "var(--af-on-secondary-container)"
                            : "var(--af-on-surface-variant)",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          {isHome ? "home" : isOffice ? "apartment" : "location_on"}
                        </span>
                        <span>{labelText}</span>
                      </div>

                      {isDefault && (
                        <span
                          style={{
                            fontFamily: "var(--gh-font-body)",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "var(--af-secondary)",
                          }}
                        >
                          Mặc định
                        </span>
                      )}
                    </div>

                    {/* Recipient info */}
                    <h3
                      style={{
                        fontFamily: "var(--gh-font-body)",
                        fontSize: "17px",
                        fontWeight: 600,
                        color: "var(--af-primary)",
                        margin: 0,
                      }}
                    >
                      {String(addr.recipient || "")}
                    </h3>

                    <p
                      style={{
                        fontFamily: "var(--gh-font-body)",
                        fontSize: "14px",
                        color: "var(--af-on-surface)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        margin: "0.4rem 0 0",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "17px", color: "var(--af-secondary)" }}>
                        phone_iphone
                      </span>
                      <span style={{ fontWeight: 500 }}>{String(addr.phone || "")}</span>
                    </p>

                    {/* Address Box */}
                    <div
                      style={{
                        marginTop: "0.85rem",
                        padding: "0.85rem 1rem",
                        backgroundColor: "var(--af-surface-container-low)",
                        borderRadius: "0.5rem",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.6rem",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "19px",
                          color: "var(--af-outline)",
                          flexShrink: 0,
                          marginTop: "2px",
                        }}
                      >
                        location_on
                      </span>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "14px",
                          lineHeight: 1.5,
                          color: "var(--af-on-surface)",
                        }}
                      >
                        {String(addr.address || "")}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      marginTop: "1.25rem",
                      paddingTop: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: "0.5rem",
                      borderTop: "1px solid var(--af-surface-container-low)",
                    }}
                  >
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setSelectedLabel(String(addr.label || "Nhà riêng"));
                        setEditingAddress(addr);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.4rem 0.85rem",
                        borderRadius: "0.5rem",
                        backgroundColor: "var(--af-surface-container)",
                        color: "var(--af-primary)",
                        border: "none",
                        fontFamily: "var(--gh-font-body)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "background-color 0.2s ease",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>edit</span>
                      <span>Chỉnh sửa</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setAddressToDelete(addr)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.4rem 0.85rem",
                        borderRadius: "0.5rem",
                        backgroundColor: "var(--af-surface-container)",
                        color: "var(--af-on-surface-variant)",
                        border: "none",
                        fontFamily: "var(--gh-font-body)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>delete</span>
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: THÊM / SỬA ĐỊA CHỈ */}
      {editingAddress && (
        <div className="heritage-modal-overlay">
          <div className="heritage-modal-card">
            <div className="heritage-modal-header">
              <div>
                <span className="account-hero-eyebrow">Thông tin nhận hàng</span>
                <h3>{editingAddress === "new" ? "Thêm địa chỉ mới" : "Chỉnh sửa địa chỉ"}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAddress(null)}
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

            <form
              onSubmit={(event) => {
                const data = fields(event);
                const isDef = event.currentTarget.querySelector<HTMLInputElement>('input[name="isDefault"]')?.checked ?? false;

                void run(async () => {
                  await mutate("command", "address-save", {
                    label: selectedLabel,
                    recipient: data.recipient,
                    phone: data.phone,
                    address: data.address,
                    isDefault: isDef,
                    ...(editingAddress === "new"
                      ? {}
                      : { id: editingAddress.id, revision: editingAddress.revision }),
                  });
                  setEditingAddress(null);
                });
              }}
            >
              <div className="heritage-modal-body">
                {/* Address type selection */}
                <div style={{ marginBottom: "1.25rem" }}>
                  <label className="heritage-field-label" style={{ display: "block", marginBottom: "0.5rem" }}>
                    Nhãn địa chỉ <span className="required">*</span>
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                    {["Nhà riêng", "Văn phòng", "Khác"].map((lbl) => {
                      const active = selectedLabel === lbl;
                      return (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setSelectedLabel(lbl)}
                          style={{
                            padding: "0.65rem 0.5rem",
                            borderRadius: "0.5rem",
                            border: active ? "1px solid var(--af-primary)" : "1px solid var(--af-outline-variant)",
                            backgroundColor: active ? "var(--af-surface-container-high)" : "var(--af-surface-container-low)",
                            color: active ? "var(--af-primary)" : "var(--af-on-surface)",
                            fontFamily: "var(--gh-font-body)",
                            fontSize: "13px",
                            fontWeight: active ? 600 : 500,
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Recipient & Phone */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                  <div className="heritage-field-group">
                    <label className="heritage-field-label" htmlFor="addr-recipient">
                      Họ và tên người nhận <span className="required">*</span>
                    </label>
                    <div className="heritage-input-wrapper">
                      <input
                        id="addr-recipient"
                        name="recipient"
                        type="text"
                        required
                        defaultValue={editingAddress === "new" ? "" : String(editingAddress.recipient ?? "")}
                        placeholder="Ví dụ: Nguyễn Văn An"
                        className="heritage-input"
                      />
                      <span className="material-symbols-outlined">person</span>
                    </div>
                  </div>

                  <div className="heritage-field-group">
                    <label className="heritage-field-label" htmlFor="addr-phone">
                      Số điện thoại <span className="required">*</span>
                    </label>
                    <div className="heritage-input-wrapper">
                      <input
                        id="addr-phone"
                        name="phone"
                        type="tel"
                        required
                        defaultValue={editingAddress === "new" ? "" : String(editingAddress.phone ?? "")}
                        placeholder="Ví dụ: 0905 123 456"
                        className="heritage-input"
                      />
                      <span className="material-symbols-outlined">call</span>
                    </div>
                  </div>
                </div>

                {/* Address details */}
                <div className="heritage-field-group">
                  <label className="heritage-field-label" htmlFor="addr-detail">
                    Địa chỉ chi tiết (Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành) <span className="required">*</span>
                  </label>
                  <textarea
                    id="addr-detail"
                    name="address"
                    rows={3}
                    required
                    defaultValue={editingAddress === "new" ? "" : String(editingAddress.address ?? "")}
                    placeholder="Nhập địa chỉ giao hàng đầy đủ..."
                    className="heritage-textarea"
                  />
                </div>

                {/* Default checkbox */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    cursor: "pointer",
                    fontSize: "14px",
                    color: "var(--af-primary)",
                  }}
                >
                  <input
                    type="checkbox"
                    name="isDefault"
                    defaultChecked={
                      editingAddress === "new"
                        ? addresses.length === 0
                        : Boolean(editingAddress.isDefault)
                    }
                    style={{
                      width: "16px",
                      height: "16px",
                      accentColor: "var(--af-primary-container)",
                    }}
                  />
                  <span>Đặt làm địa chỉ nhận hàng mặc định</span>
                </label>
              </div>

              <div className="heritage-modal-footer">
                <button
                  type="button"
                  className="heritage-btn-secondary"
                  onClick={() => setEditingAddress(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="heritage-btn-primary group" disabled={busy}>
                  <div className="gilded-corner" />
                  <span>{busy ? "Đang lưu..." : "Lưu địa chỉ"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: XÁC NHẬN XÓA ĐỊA CHỈ */}
      {addressToDelete && (
        <div className="heritage-modal-overlay">
          <div className="heritage-modal-card" style={{ maxWidth: "440px" }}>
            <div style={{ padding: "1.75rem 1.75rem 1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "0.75rem" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "var(--af-error-container)",
                    color: "var(--af-error)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>delete</span>
                </div>
                <div>
                  <h3
                    style={{
                      fontFamily: "var(--gh-font-display)",
                      fontSize: "19px",
                      fontWeight: 600,
                      color: "var(--af-primary)",
                      margin: 0,
                    }}
                  >
                    Xác nhận xóa
                  </h3>
                  <span style={{ fontSize: "12px", color: "var(--af-error)", fontWeight: 500 }}>
                    Hành động không thể hoàn tác
                  </span>
                </div>
              </div>

              <p
                style={{
                  fontFamily: "var(--gh-font-body)",
                  fontSize: "14px",
                  color: "var(--af-on-surface-variant)",
                  lineHeight: 1.6,
                  margin: "0.75rem 0 1.5rem",
                }}
              >
                Bạn có chắc chắn muốn gỡ địa chỉ{" "}
                <strong style={{ color: "var(--af-primary)" }}>
                  {String(addressToDelete.label)} — {String(addressToDelete.address).slice(0, 45)}...
                </strong>{" "}
                khỏi sổ địa chỉ của bạn?
              </p>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  className="heritage-btn-secondary"
                  disabled={busy}
                  onClick={() => setAddressToDelete(null)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const toDelete = addressToDelete;
                    void run(async () => {
                      await mutate("command", "address-delete", {
                        id: toDelete.id,
                        revision: toDelete.revision,
                      });
                      setAddressToDelete(null);
                    });
                  }}
                  style={{
                    padding: "0.75rem 1.25rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "var(--af-error)",
                    color: "#ffffff",
                    border: "none",
                    fontFamily: "var(--gh-font-body)",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "opacity 0.2s ease",
                  }}
                >
                  {busy ? "Đang xóa..." : "Xóa địa chỉ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

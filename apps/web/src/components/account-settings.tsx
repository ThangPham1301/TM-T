"use client";

import { useState } from "react";
import { api, fields, type Row, useStore } from "@/lib/store";

export function AddressFields({ address }: { address?: Row }) {
  return (
    <>
      <label>Tên gợi nhớ<input name="label" placeholder="Ví dụ: Nhà riêng" defaultValue={String(address?.label ?? "")} required maxLength={60} /></label>
      <div className="store-field-pair">
        <label>Người nhận<input name="recipient" autoComplete="name" defaultValue={String(address?.recipient ?? "")} required maxLength={100} /></label>
        <label>Số điện thoại<input name="phone" type="tel" autoComplete="tel" defaultValue={String(address?.phone ?? "")} required minLength={8} maxLength={30} /></label>
      </div>
      <label>Địa chỉ giao hàng<textarea name="address" autoComplete="street-address" defaultValue={String(address?.address ?? "")} required maxLength={400} /></label>
    </>
  );
}

export function AddressBook() {
  const { state, busy, run, mutate } = useStore();
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  return (
    <section className="store-card">
      <div className="store-list-heading">
        <h2>Sổ địa chỉ</h2>
        <button type="button" disabled={busy} onClick={() => setEditing("new")}>Thêm địa chỉ</button>
      </div>
      {!state?.addresses.length && <p className="store-subtle">Lưu địa chỉ để chọn nhanh khi đặt hàng.</p>}
      {state?.addresses.map((address) => (
        <article className="store-address" key={address.id}>
          <strong>{String(address.label)}</strong>
          <p>{String(address.recipient)} · {String(address.phone)}</p>
          <p>{String(address.address)}</p>
          <div className="store-row-actions">
            <button type="button" disabled={busy} onClick={() => setEditing(address)}>Chỉnh sửa</button>
            <button type="button" className="store-danger" disabled={busy} onClick={() => {
              if (window.confirm("Xóa địa chỉ đã lưu này?")) void run(async () => {
                await mutate("command", "address-delete", { id: address.id, revision: address.revision });
                setEditing(null);
              });
            }}>Xóa</button>
          </div>
        </article>
      ))}
      {editing && (
        <form key={editing === "new" ? "new" : editing.id} className="store-form" onSubmit={(event) => {
          const data = fields(event);
          void run(async () => {
            await mutate("command", "address-save", {
              ...data,
              ...(editing === "new" ? {} : { id: editing.id, revision: editing.revision }),
            });
            setEditing(null);
          });
        }}>
          <h3>{editing === "new" ? "Thêm địa chỉ" : "Chỉnh sửa địa chỉ"}</h3>
          <AddressFields address={editing === "new" ? undefined : editing} />
          <div className="store-row-actions">
            <button className="primary-button" disabled={busy}>Lưu địa chỉ</button>
            <button type="button" onClick={() => setEditing(null)}>Hủy</button>
          </div>
        </form>
      )}
    </section>
  );
}

export function PasswordSettings() {
  const { busy, run } = useStore();
  const [saved, setSaved] = useState(false);
  return (
    <section className="store-card">
      <h2>Đổi mật khẩu</h2>
      <p className="store-subtle">Dùng ít nhất 12 ký tự. Các phiên đăng nhập khác sẽ kết thúc sau khi lưu.</p>
      <form className="store-form" onSubmit={(event) => {
        const form = event.currentTarget;
        const { currentPassword, newPassword, confirmation } = fields(event);
        setSaved(false);
        void run(async () => {
          if (newPassword !== confirmation) throw new Error("Mật khẩu xác nhận chưa khớp.");
          await api("password", "POST", { currentPassword, newPassword });
          form.reset();
          setSaved(true);
        });
      }}>
        <label>Mật khẩu hiện tại<input type="password" name="currentPassword" autoComplete="current-password" required maxLength={72} /></label>
        <div className="store-field-pair">
          <label>Mật khẩu mới<input type="password" name="newPassword" autoComplete="new-password" required minLength={12} maxLength={72} /></label>
          <label>Nhập lại mật khẩu mới<input type="password" name="confirmation" autoComplete="new-password" required minLength={12} maxLength={72} /></label>
        </div>
        <button className="primary-button" disabled={busy}>Cập nhật mật khẩu</button>
        {saved && <p role="status">Đã đổi mật khẩu.</p>}
      </form>
    </section>
  );
}

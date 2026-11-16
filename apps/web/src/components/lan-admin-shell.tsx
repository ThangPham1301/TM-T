"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
const links = [
  ["orders", "Quản lý đơn hàng"],
  ["products", "Quản lý sản phẩm"],
  ["categories", "Quản lý danh mục"],
  ["settings", "Cấu hình bán hàng"],
  ["returns", "Xử lý đổi trả"],
  ["privacy", "Quyền riêng tư"],
  ["policies", "Quản lý chính sách"],
  ["audit", "Nhật ký hoạt động"],
];
export function LanAdminShell({
  section,
  children,
}: {
  section: string;
  children: ReactNode;
}) {
  const { state, busy, run, logout } = useStore();
  if (section === "settings") return children;
  return (
    <div className="lan-admin-shell">
      <aside className="lan-admin-sidebar">
        <Link href="/admin" className="lan-admin-brand">
          <span>G</span>
          <div>
            <strong>QUẢN TRỊ GÓI HUẾ</strong>
            <small>Hệ thống vận hành di sản</small>
          </div>
        </Link>
        <p>KHU VỰC ĐIỀU HÀNH</p>
        <nav aria-label="Chức năng quản trị">
          {links.map(([key, name]) => (
            <Link
              key={key}
              aria-current={key === section ? "page" : undefined}
              href={`/admin/${key}`}
            >
              {name}
            </Link>
          ))}
        </nav>
        <div className="lan-admin-user">
          <Link href="/">Xem cửa hàng →</Link>
          <strong>{String(state?.user.name ?? "")}</strong>
          <small>Quản trị viên</small>
          <button disabled={busy} onClick={() => void run(logout)}>
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className="lan-admin-workspace">
        <header className="lan-admin-topbar">
          <span>
            QUẢN TRỊ <span aria-hidden="true">›</span> Khu vực điều hành
          </span>
          <Link href="/">Xem cửa hàng Gói Huế ↗</Link>
          <strong>{String(state?.user.name ?? "")}</strong>
        </header>
        {children}
      </div>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { adminNavigationGroups } from "@/shared/layout/navigation";

function AdminMenu({ section }: { section: string }) {
  const id = useId();
  const currentGroup = adminNavigationGroups.find(({ items }) => items.some((item) => item.key === section))?.key;
  const [openGroup, setOpenGroup] = useState(currentGroup);

  return (
    <nav aria-label="Chức năng quản trị">
      {adminNavigationGroups.map((group) => {
        const open = openGroup === group.key;
        const itemsId = `${id}-${group.key}`;
        return (
          <div className="lan-admin-menu-group" key={group.key} data-current={currentGroup === group.key}>
            <button type="button" className="lan-admin-menu-toggle" aria-expanded={open} aria-controls={itemsId}
              onClick={() => setOpenGroup(open ? undefined : group.key)}>
              <span className="material-symbols-outlined" aria-hidden="true">{group.icon}</span>
              <span>{group.label}</span>
              <span className="lan-admin-menu-caret" aria-hidden="true" />
            </button>
            <ul id={itemsId} className="lan-admin-menu-items" hidden={!open}>
              {group.items.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} aria-current={item.key === section ? "page" : undefined}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
export function LanAdminShell({
  section,
  children,
}: {
  section: string;
  children: ReactNode;
}) {
  const { state, busy, run, logout } = useStore();
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
        <AdminMenu key={section} section={section} />
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

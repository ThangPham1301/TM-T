"use client";
import Link from "next/link";
import { accountNavigation, adminNavigation } from "@/shared/layout/navigation";
export function WorkspaceNav({
  admin = false,
  section,
}: {
  admin?: boolean;
  section: string;
}) {
  const sections = admin ? adminNavigation : accountNavigation;
  return (
    <nav
      className="store-tabs"
      aria-label={admin ? "Chức năng quản trị" : "Chức năng tài khoản"}
    >
      {sections.map(({ key, label: name, href }) => (
        <Link
          className={section === key ? "active" : ""}
          key={key}
          href={href}
        >
          {name}
        </Link>
      ))}
    </nav>
  );
}
export function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  return (
    <div className="store-pagination">
      <span>
        {total} kết quả · Trang {current}/{pages}
      </span>
      <button disabled={current <= 1} onClick={() => onChange(current - 1)}>
        ← Trước
      </button>
      <button disabled={current >= pages} onClick={() => onChange(current + 1)}>
        Sau →
      </button>
    </div>
  );
}

"use client";
import Link from "next/link";
export function WorkspaceNav({
  admin = false,
  section,
}: {
  admin?: boolean;
  section: string;
}) {
  const sections = admin
    ? [
        ["orders", "Đơn hàng"],
        ["products", "Sản phẩm"],
        ["categories", "Danh mục"],
        ["settings", "Phí giao hàng"],
        ["returns", "Đổi trả"],
        ["privacy", "Quyền dữ liệu"],
        ["policies", "Chính sách"],
        ["audit", "Nhật ký"],
      ]
    : [
        ["profile", "Hồ sơ"],
        ["orders", "Đơn hàng"],
        ["returns", "Đổi trả"],
        ["privacy", "Quyền dữ liệu"],
      ];
  return (
    <nav
      className="store-tabs"
      aria-label={admin ? "Chức năng quản trị" : "Chức năng tài khoản"}
    >
      {sections.map(([key, name]) => (
        <Link
          className={section === key ? "active" : ""}
          key={key}
          href={`${admin ? "/admin" : "/account"}/${key}`}
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

export type NavigationItem = { key: string; href: string; label: string };
export const accountNavigation: readonly NavigationItem[] = [
  { key: "profile", href: "/account/profile", label: "Hồ sơ" },
  { key: "addresses", href: "/account/addresses", label: "Sổ địa chỉ" },
  { key: "security", href: "/account/security", label: "Mật khẩu" },
  { key: "orders", href: "/account/orders", label: "Đơn hàng" },
  { key: "returns", href: "/account/returns", label: "Đổi trả" },
  { key: "privacy", href: "/account/privacy", label: "Quyền dữ liệu" },
];
export const adminNavigation: readonly NavigationItem[] = [
  { key: "orders", href: "/admin/orders", label: "Đơn hàng" },
  { key: "products", href: "/admin/products", label: "Sản phẩm" },
  { key: "categories", href: "/admin/categories", label: "Danh mục" },
  { key: "settings", href: "/admin/settings", label: "Phí giao hàng" },
  { key: "returns", href: "/admin/returns", label: "Đổi trả" },
  { key: "privacy", href: "/admin/privacy", label: "Quyền dữ liệu" },
  { key: "policies", href: "/admin/policies", label: "Chính sách" },
  { key: "audit", href: "/admin/audit", label: "Nhật ký" },
];


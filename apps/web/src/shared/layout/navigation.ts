export type NavigationItem = { key: string; href: string; label: string; icon?: string };
export const accountNavigation: readonly NavigationItem[] = [
  { key: "profile", href: "/account/profile", label: "Hồ sơ cá nhân", icon: "badge" },
  { key: "addresses", href: "/account/addresses", label: "Sổ địa chỉ", icon: "location_on" },
  { key: "security", href: "/account/security", label: "Bảo mật", icon: "security" },
  { key: "orders", href: "/account/orders", label: "Đơn hàng của tôi", icon: "receipt_long" },
  { key: "returns", href: "/account/returns", label: "Yêu cầu đổi trả", icon: "assignment_return" },
  { key: "privacy", href: "/account/privacy", label: "Quyền riêng tư", icon: "shield" },
];
export const adminNavigation: readonly NavigationItem[] = [
  { key: "orders", href: "/admin/orders", label: "Đơn hàng", icon: "receipt_long" },
  { key: "products", href: "/admin/products", label: "Sản phẩm", icon: "inventory_2" },
  { key: "categories", href: "/admin/categories", label: "Danh mục", icon: "category" },
  { key: "settings", href: "/admin/settings", label: "Cấu hình bán hàng", icon: "tune" },
  { key: "returns", href: "/admin/returns", label: "Đổi trả", icon: "assignment_return" },
  { key: "privacy", href: "/admin/privacy", label: "Quyền riêng tư & dữ liệu", icon: "shield" },
  { key: "policies", href: "/admin/policies", label: "Chính sách", icon: "article" },
  { key: "audit", href: "/admin/audit", label: "Nhật ký", icon: "history" },
];


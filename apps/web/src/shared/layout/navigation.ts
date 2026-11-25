export type NavigationItem = { key: string; href: string; label: string; icon?: string };
export const accountNavigation: readonly NavigationItem[] = [
  { key: "profile", href: "/account/profile", label: "Hồ sơ cá nhân", icon: "badge" },
  { key: "addresses", href: "/account/addresses", label: "Sổ địa chỉ", icon: "location_on" },
  { key: "security", href: "/account/security", label: "Bảo mật", icon: "security" },
  { key: "orders", href: "/account/orders", label: "Đơn hàng của tôi", icon: "receipt_long" },
  { key: "returns", href: "/account/returns", label: "Yêu cầu đổi trả", icon: "assignment_return" },
  { key: "privacy", href: "/account/privacy", label: "Quyền riêng tư", icon: "shield" },
];
export const adminNavigationGroups: readonly {
  key: string;
  label: string;
  icon: string;
  items: readonly NavigationItem[];
}[] = [
  {
    key: "sales", label: "Bán hàng", icon: "shopping_bag",
    items: [
      { key: "orders", href: "/admin/orders", label: "Đơn hàng", icon: "receipt_long" },
      { key: "pricing", href: "/admin/pricing", label: "Giá bán", icon: "payments" },
      { key: "discounts", href: "/admin/discounts", label: "Ưu đãi", icon: "sell" },
      { key: "settings", href: "/admin/settings", label: "Cấu hình bán hàng", icon: "tune" },
    ],
  },
  {
    key: "catalog", label: "Danh mục sản phẩm", icon: "inventory_2",
    items: [
      { key: "products", href: "/admin/products", label: "Sản phẩm", icon: "inventory_2" },
      { key: "categories", href: "/admin/categories", label: "Danh mục", icon: "category" },
    ],
  },
  {
    key: "care", label: "Chăm sóc khách hàng", icon: "support_agent",
    items: [
      { key: "returns", href: "/admin/returns", label: "Xử lý đổi trả", icon: "assignment_return" },
      { key: "support", href: "/admin/support", label: "Hỗ trợ khách vãng lai", icon: "support_agent" },
      { key: "privacy", href: "/admin/privacy", label: "Quyền riêng tư & dữ liệu", icon: "shield" },
    ],
  },
  {
    key: "system", label: "Quản trị hệ thống", icon: "settings",
    items: [
      { key: "policies", href: "/admin/policies", label: "Chính sách", icon: "article" },
      { key: "profile", href: "/account/profile", label: "Hồ sơ cá nhân", icon: "badge" },
      { key: "security", href: "/account/security", label: "Bảo mật tài khoản", icon: "lock" },
      { key: "audit", href: "/admin/audit", label: "Nhật ký hoạt động", icon: "history" },
    ],
  },
];

export const adminNavigation = adminNavigationGroups.flatMap(({ items }) => items);


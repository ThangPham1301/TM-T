"use client";

import { useStore, api, shippingPauseMessage, type Row } from "@/lib/store";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { StoreHeader, StoreFooter } from "@/shared/layout/store-shell";

export function SiteHeader() {
  const { state, busy, run, logout } = useStore();
  const pathname = usePathname();
  if (pathname && ["/admin/returns", "/admin/settings", "/admin/policies", "/admin/audit"].includes(pathname) && state?.user.role === "ADMIN") return null;
  return <StoreHeader user={state ? { name: String(state.user.name), role: String(state.user.role) } : null} cartCount={state?.cartCount} busy={busy} onLogout={() => void run(logout)} />;
}
export function StorePauseBanner() {
  const pathname = usePathname();
  const [shipping, setShipping] = useState<Row | null>(null);
  useEffect(() => {
    if (pathname !== "/") return;
    let active = true;
    void api("shipping").then((result) => {
      if (active) setShipping(result);
    }).catch(() => {
      if (active) setShipping(null);
    });
    return () => { active = false; };
  }, [pathname]);
  if (pathname !== "/" || shipping?.enabled !== false) return null;
  return <p className="store-warning storefront-pause-banner" role="status">{shippingPauseMessage(shipping)}</p>;
}

export function SiteFooter() {
  const pathname = usePathname();
  const [categories, setCategories] = useState<Row[]>([]);
  useEffect(() => {
    void api("categories").then(setCategories).catch(() => setCategories([]));
  }, []);
  if ((pathname?.startsWith("/account") && pathname !== "/account/returns") || pathname?.startsWith("/admin")) {
    return null;
  }
  return <StoreFooter categories={categories.map(c => ({ id: c.id, code: String(c.code), name: String(c.name) }))} />;
}
export function StatusMessages() {
  const { error, notice, busy } = useStore();
  return (
    <div className="store-messages" aria-live="polite">
      {busy && <p role="status">Đang xử lý…</p>}
      {error && (
        <p className="store-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="store-success" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

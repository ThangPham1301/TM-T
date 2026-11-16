"use client";

import { useStore, api, type Row } from "@/lib/store";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { StoreHeader, StoreFooter } from "@/shared/layout/store-shell";

export function SiteHeader() {
  const { state, busy, run, logout } = useStore();
  const pathname = usePathname();
  if (["/admin/products", "/admin/categories", "/admin/inventory"].includes(pathname)) return null;
  return <StoreHeader user={state ? { name: String(state.user.name), role: String(state.user.role) } : null} cartCount={state?.cartCount} busy={busy} onLogout={() => void run(logout)} />;
}
export function SiteFooter() {
  const pathname = usePathname();
  const [categories, setCategories] = useState<Row[]>([]);
  useEffect(() => {
    void api("categories").then(setCategories).catch(() => setCategories([]));
  }, []);
  if (pathname?.startsWith("/account") || pathname?.startsWith("/admin")) {
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

"use client";

import { useStore, api, type Row } from "@/lib/store";
import { useEffect, useState } from "react";
import { StoreHeader, StoreFooter } from "@/shared/layout/store-shell";

export function SiteHeader() {
  const { state, busy, run, logout } = useStore();
  return <StoreHeader user={state ? { name: String(state.user.name), role: String(state.user.role) } : null} cartCount={state?.cartCount} busy={busy} onLogout={() => void run(logout)} />;
}
export function SiteFooter() {
  const [categories, setCategories] = useState<Row[]>([]);
  useEffect(() => {
    void api("categories").then(setCategories).catch(() => setCategories([]));
  }, []);
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

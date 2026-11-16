"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fields, type Row, useStore } from "@/lib/store";
import { AdminShell } from "@/shared/layout/admin-shell";

type Inventory = {
  lots: Row[];
  lotTracked: boolean;
  unallocatedStock: number;
};

export function InventoryAdmin() {
  const { state, loading, busy, mutate, run } = useStore();
  const [products, setProducts] = useState<Row[]>([]);
  const [selected, setSelected] = useState("");
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [error, setError] = useState("");
  const isAdmin = state?.user.role === "ADMIN";
  const product = products.find((item) => item.id === selected);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    api("admin/products").then((rows) => {
      if (active) setProducts(rows);
    }).catch((failure: Error) => {
      if (active) setError(failure.message);
    });
    return () => { active = false; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !selected) return;
    let active = true;
    api(`admin/inventory/lots/${selected}`).then((data) => {
      if (active) setInventory(data);
    }).catch((failure: Error) => {
      if (active) setError(failure.message);
    });
    return () => { active = false; };
  }, [isAdmin, selected]);

  if (loading) return <main className="store-page">Đang tải tài khoản…</main>;
  if (!isAdmin) return <main className="store-page"><Link href="/login">Đăng nhập quản trị</Link></main>;
  return (
    <AdminShell section="inventory" title="Kho theo lô">
      <main className="store-page">
        <section className="store-card">
          <h1>Kho theo lô</h1>
          <label>Sản phẩm
            <select value={selected} disabled={busy} onChange={(event) => {
              setInventory(null);
              setError("");
              setSelected(event.target.value);
            }}>
              <option value="">Chọn sản phẩm</option>
              {products.map((item) => <option key={item.id} value={item.id}>{String(item.name)}</option>)}
            </select>
          </label>
          {error && <p role="alert" className="store-error">{error}</p>}
          {selected && !inventory && !error && <p>Đang tải lô hàng…</p>}
          {product && inventory && (
            <>
              <p>Tồn bán {Number(product.stock)} · Tồn chưa gắn lô {inventory.unallocatedStock}</p>
              {inventory.lots.length > 0 && (
                <table>
                  <thead><tr><th>Mã lô</th><th>Ngày sản xuất</th><th>Hạn sử dụng</th><th>Tồn vật lý</th><th>Trạng thái</th></tr></thead>
                  <tbody>
                    {inventory.lots.map((lot) => (
                      <tr key={lot.id}><td>{String(lot.code)}</td><td>{String(lot.manufacturedOn)}</td>
                        <td>{String(lot.expiresOn)}</td><td>{Number(lot.quantity)}</td><td>{lot.quarantined ? "Cách ly" : "Chưa cách ly"}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              <form className="store-form" key={product.id} onSubmit={(event) => {
                const form = event.currentTarget;
                const values = fields(event);
                void run(async () => {
                  await mutate("commerce", "inventory-lot-add", {
                    ...values, productId: product.id, revision: product.revision,
                    quantity: Number(values.quantity), legacyQuantity: Number(values.legacyQuantity ?? 0),
                  });
                  const [rows, lots] = await Promise.all([
                    api("admin/products"), api(`admin/inventory/lots/${product.id}`),
                  ]);
                  setProducts(rows);
                  setInventory(lots);
                  form.reset();
                });
              }}>
                <h2>Nhập lô</h2>
                {inventory.unallocatedStock > 0 && <p>Chỉ chuyển tồn chưa gắn lô sau khi đối chiếu mã lô và hạn dùng thực tế.</p>}
                <label>Mã lô<input name="code" required maxLength={60} /></label>
                <label>Ngày sản xuất<input name="manufacturedOn" type="date" required /></label>
                <label>Hạn sử dụng<input name="expiresOn" type="date" required /></label>
                <label>Số lượng vật lý trong lô<input name="quantity" type="number" min={1} max={1000000} required /></label>
                {inventory.unallocatedStock > 0 && (
                  <label>Trong đó đã tính trong tồn cũ
                    <input name="legacyQuantity" type="number" min={0} max={inventory.unallocatedStock} defaultValue={0} required />
                  </label>
                )}
                <button disabled={busy}>Lưu lô hàng</button>
              </form>
            </>
          )}
        </section>
      </main>
    </AdminShell>
  );
}

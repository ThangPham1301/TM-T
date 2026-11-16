"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CartView } from "./cart-view";
import { CheckoutView } from "./checkout-view";
import { api, fields, type Row, useStore } from "@/lib/store";
type Summary = {
  items: Row[];
  cartToken: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  shipping: Row;
};
export function Cart({ checkout = false }: { checkout?: boolean }) {
  const { state, loading, busy, run, mutate } = useStore(),
    router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null),
    [error, setError] = useState(""),
    [fetching, setFetching] = useState(false);
  const [addressChoice, setAddressChoice] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  async function refresh() {
    setFetching(true);
    try {
      setSummary(await api("cart/summary"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được giỏ.");
    } finally {
      setFetching(false);
    }
  }
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => {
    if (!live) return;
    if (state?.user.role === "CUSTOMER") {
      setFetching(true);
      void api("cart/summary")
        .then((s) => {
          if (live) {
            setSummary(s);
            setError("");
          }
        })
        .catch((e) => {
          if (live) setError(e.message);
        })
        .finally(() => {
          if (live) setFetching(false);
        });
    } else setSummary(null);
    });
    return () => {
      live = false;
    };
  }, [state]);
  if (loading) return <main className="store-page">Đang tải tài khoản…</main>;
  if (!state)
    return (
      <main className="store-page">
        <h1>Giỏ hàng của bạn</h1>
        <Link href="/login">Đăng nhập để mua hàng →</Link>
      </main>
    );
  if (state.user.role !== "CUSTOMER")
    return (
      <main className="store-page">
        <h1>Giỏ hàng dành cho khách hàng</h1>
        <Link href="/admin">Về quản trị cửa hàng</Link>
      </main>
    );
  const selectedAddress = state.addresses.find((entry) => entry.id === (addressChoice ?? (checkout && state.addresses.length === 1 ? state.addresses[0].id : "")));
  const rows = summary?.items ?? [],
    blocked = rows.some(
      (l) =>
        !l.available || l.priceChanged || Number(l.quantity) > Number(l.stock),
    );
  const disabled = busy || fetching;
  async function update(action: string, b: Record<string, unknown> = {}) {
    if (!summary) return;
    await mutate("commerce", action, { ...b, cartToken: summary.cartToken });
    await refresh();
  }
  if (!checkout) {
    return <CartView summary={summary} fetching={fetching} error={error} disabled={disabled} blocked={blocked}
      refresh={() => void refresh()} update={(action, data) => void run(() => update(action, data))}
      checkout={() => router.push("/checkout")} />;
  }
  return <CheckoutView
    summary={summary} user={state.user} addresses={state.addresses} selectedAddress={selectedAddress}
    fetching={fetching} error={error} busy={busy} disabled={disabled} blocked={blocked} addingAddress={addingAddress}
    onRefresh={() => void refresh()} onToggleAddress={() => setAddingAddress(value => !value)} onSelectAddress={setAddressChoice}
    onSaveAddress={(event) => {
      const details = fields(event);
      void run(async () => {
        const address = await mutate("command", "address-save", details);
        setAddressChoice(address.id);
        setAddingAddress(false);
      });
    }}
    onCheckout={(event) => {
      const data = fields(event);
      void run(async () => {
        if (!summary || blocked || !summary.shipping.enabled) throw new Error("Giỏ chưa đủ điều kiện đặt hàng.");
        const order = await mutate("commerce", "checkout", {
          ...data,
          ...(selectedAddress ? { addressId: selectedAddress.id } : {}),
          cartToken: summary.cartToken,
          shippingRevision: summary.shipping.revision,
        });
        router.push(`/account/orders?order=${order.id}`);
      });
    }}
  />;
}

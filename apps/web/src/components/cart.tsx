"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CartView } from "./cart-view";
import { CheckoutView } from "./checkout-view";
import { CheckoutPayment } from "./checkout-payment";
import { RecommendationRail } from "./recommendation-rail";
import { api, ApiError, fields, type Row, useStore } from "@/lib/store";
import type { CartSummary } from "@/lib/discounts";
export function Cart({ checkout = false }: { checkout?: boolean }) {
  const { state, loading, busy, run, mutate } = useStore(),
    router = useRouter();
  const [summary, setSummary] = useState<CartSummary | null>(null),
    [error, setError] = useState(""),
    [fetching, setFetching] = useState(false);
  const [addressChoice, setAddressChoice] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [placedVietQrOrder, setPlacedVietQrOrder] = useState<Row | null>(null);
  const [reviewedTotal, setReviewedTotal] = useState<number | null>(null);

  const receiveSummary = useCallback((quote: CartSummary) => {
    setSummary(quote);
    if (checkout) setReviewedTotal((reviewed) => reviewed ?? quote.total);
  }, [checkout]);

  async function refresh() {
    setFetching(true);
    try {
      receiveSummary(await api("cart/summary"));
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
            receiveSummary(s);
            setError("");
          }
        })
        .catch((e) => {
          if (live) setError(e.message);
        })
        .finally(() => {
          if (live) setFetching(false);
        });
    } else {
      setSummary(null);
      setReviewedTotal(null);
    }
    });
    return () => {
      live = false;
    };
  }, [state, receiveSummary]);
  const isCustomer = state?.user.role === "CUSTOMER";
  const nextPriceChangeAt = summary?.nextPriceChangeAt;
  const pricedAt = summary?.pricedAt;
  useEffect(() => {
    if (!isCustomer || busy || fetching || placedVietQrOrder) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let request = 0;
    async function reprice() {
      clearTimeout(timer);
      const id = ++request;
      try {
        const quote: CartSummary = await api("cart/summary");
        if (active && id === request) receiveSummary(quote);
      } catch {
        // The checkout command still verifies prices if the background refresh fails.
      } finally {
        if (active && id === request) timer = setTimeout(reprice, 15_000);
      }
    }
    const boundary = nextPriceChangeAt && pricedAt
      ? Date.parse(nextPriceChangeAt) - Date.parse(pricedAt)
      : Infinity;
    timer = setTimeout(reprice, Math.min(15_000, Math.max(100, boundary)));
    window.addEventListener("focus", reprice);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener("focus", reprice);
    };
  }, [isCustomer, busy, fetching, nextPriceChangeAt, pricedAt, placedVietQrOrder, receiveSummary]);

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
  const totalChanged = checkout && summary !== null && reviewedTotal !== null && summary.total !== reviewedTotal;
  const disabled = busy || fetching;
  async function update(action: string, b: Record<string, unknown> = {}) {
    if (!summary) return;
    try {
      await mutate("commerce", action, {
        ...b,
        cartToken: summary.cartToken,
        ...(action === "cart-refresh" ? { priceToken: summary.priceToken } : {}),
      });
      if (checkout && action === "cart-refresh") setReviewedTotal(summary.total);
      await refresh();
    } catch (problem) {
      if (!(problem instanceof ApiError) || problem.status !== 409) throw problem;
      await refresh();
      setError(problem.message);
    }
  }
  if (!checkout) {
    return <CartView summary={summary} fetching={fetching} error={error} disabled={disabled} blocked={blocked}
      refresh={() => void refresh()} update={(action, data) => void run(() => update(action, data))}
      checkout={() => router.push("/checkout")} recommendations={<RecommendationRail surface="cart" refreshKey={summary?.cartToken} />} />;
  }
  if (placedVietQrOrder) {
    const order = state.orders.find(({ id }) => id === placedVietQrOrder.id) ?? placedVietQrOrder;
    return <CheckoutPayment key={order.id} order={order} />;
  }
  return <CheckoutView
    summary={summary} user={state.user} addresses={state.addresses} selectedAddress={selectedAddress}
    fetching={fetching} error={error} busy={busy} disabled={disabled} blocked={blocked || totalChanged} addingAddress={addingAddress}
    previousTotal={totalChanged ? reviewedTotal : null}
    onRefresh={() => void refresh()}
    onAcceptPrices={() => void run(() => update("cart-refresh"))}
    onAcceptTotal={() => { if (summary) setReviewedTotal(summary.total); }}
    onToggleAddress={() => setAddingAddress(value => !value)} onSelectAddress={setAddressChoice}
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
        if (!summary || blocked || totalChanged || !summary.shipping.enabled) throw new Error("Giỏ chưa đủ điều kiện đặt hàng.");
        try {
          const order = await mutate("commerce", "checkout", {
            ...data,
            ...(selectedAddress ? { addressId: selectedAddress.id } : {}),
            cartToken: summary.cartToken,
            quoteToken: summary.quoteToken,
            shippingRevision: summary.shipping.revision,
          });
          if (order.paymentMethod === "VIETQR") {
            setPlacedVietQrOrder(order);
            return;
          }
          router.push(`/account/orders?order=${encodeURIComponent(order.id)}`);
        } catch (problem) {
          if (!(problem instanceof ApiError) || problem.status !== 409) throw problem;
          await refresh();
          setError(problem.message);
        }
      });
    }}
  />;
}

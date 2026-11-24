"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CartView } from "./cart-view";
import { CheckoutView } from "./checkout-view";
import { CheckoutPayment } from "./checkout-payment";
import { RecommendationRail } from "./recommendation-rail";
import { Button } from "@/shared/ui";
import { api, ApiError, fields, type Row, useStore } from "@/lib/store";
import type { CartSummary } from "@/lib/discounts";
import { guestOrderPath } from "@/lib/guest-order";
import checkoutStyles from "./checkout-view.module.css";
import { trackEvent } from "@/lib/analytics";
import { quoteParams } from "@/lib/analytics-commerce";

export function Cart({ checkout = false }: { checkout?: boolean }) {
  const { state, loading } = useStore();
  if (loading) return <main className="store-page" role="status">Đang tải giỏ hàng…</main>;
  if (state?.user.role === "ADMIN")
    return (
      <main className="store-page">
        <h1>Giỏ hàng dành cho khách hàng</h1>
        <Link href="/admin">Về quản trị cửa hàng</Link>
      </main>
    );
  return <CartJourney key={state?.user.id ?? "guest"} checkout={checkout} />;
}

function reviewedQuote(summary: CartSummary) {
  return { total: summary.total, token: summary.quoteToken, shipping: summary.shipping.revision };
}

function CartJourney({ checkout }: { checkout: boolean }) {
  const { state, guestCart, refreshGuestCart, busy, run, mutate } = useStore(),
    router = useRouter();
  const prefix = state ? "" : "guest/";
  const summaryPath = `${prefix}cart/summary`;
  const addressBook = state?.addresses ?? [];
  const submitting = useRef(false);
  const [summary, setSummary] = useState<CartSummary | null>(null),
    [error, setError] = useState(""),
    [fetching, setFetching] = useState(false);
  const [addressChoice, setAddressChoice] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [placedVietQrOrder, setPlacedVietQrOrder] = useState<Row | null>(null);
  const [reviewed, setReviewed] = useState<ReturnType<typeof reviewedQuote> | null>(null);

  const receiveSummary = useCallback((quote: CartSummary) => {
    setSummary(quote);
    if (checkout) setReviewed((current) => quote.items.length ? current ?? reviewedQuote(quote) : null);
  }, [checkout]);

  async function refresh() {
    setFetching(true);
    try {
      receiveSummary(await api(summaryPath));
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
      setFetching(true);
      void api(summaryPath)
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
    });
    return () => {
      live = false;
    };
  }, [state, summaryPath, receiveSummary]);
  const nextPriceChangeAt = summary?.nextPriceChangeAt;
  const pricedAt = summary?.pricedAt;
  const journeyRecorded = useRef(false);
  useEffect(() => {
    if (journeyRecorded.current || !summary?.measurement || !summary.items.length || placedVietQrOrder || fetching) return;
    try {
      if (trackEvent(checkout ? "begin_checkout" : "view_cart", { ...quoteParams(summary.measurement), checkout_type: state ? "account" : "guest" })) journeyRecorded.current = true;
    } catch { /* Missing/invalid analytics data must not affect the cart. */ }
  }, [summary, checkout, fetching, placedVietQrOrder, state]);
  useEffect(() => {
    if (busy || fetching || placedVietQrOrder) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let request = 0;
    async function reprice() {
      clearTimeout(timer);
      const id = ++request;
      try {
        const quote: CartSummary = await api(summaryPath);
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
  }, [summaryPath, busy, fetching, nextPriceChangeAt, pricedAt, placedVietQrOrder, receiveSummary]);

  const selectedAddress = addressBook.find((entry) => entry.id === (addressChoice ?? (checkout && addressBook.length === 1 ? addressBook[0].id : "")));
  const rows = summary?.items ?? [],
    blocked = rows.some(
      (l) =>
        !l.available || l.priceChanged || Number(l.quantity) > Number(l.stock),
    );
  const quoteChanged = Boolean(checkout && summary && reviewed && (
    summary.total !== reviewed.total || summary.quoteToken !== reviewed.token ||
    summary.shipping.revision !== reviewed.shipping
  ));
  const disabled = busy || fetching;
  async function update(action: string, b: Record<string, unknown> = {}) {
    if (!summary) return;
    try {
      await mutate(`${prefix}commerce`, action, {
        ...b,
        cartToken: summary.cartToken,
        ...(action === "cart-refresh" ? { priceToken: summary.priceToken } : {}),
      });
      if (checkout && action === "cart-refresh") setReviewed(reviewedQuote(summary));
      await refresh();
    } catch (problem) {
      if (!(problem instanceof ApiError) || problem.status !== 409) throw problem;
      await refresh();
      setError(problem.message);
    }
  }
  const mergeNotice = state && guestCart && guestCart.count > 0 ? (
    <div className={checkoutStyles.guestNotice}>
      <div><strong>Bạn có {guestCart.count} sản phẩm trong giỏ khách</strong>
        <p>Gộp vào giỏ tài khoản để tiếp tục với giá và tồn kho hiện tại.</p></div>
      <Button size="small" variant="secondary" disabled={disabled || !summary} onClick={() => void run(async () => {
        if (!summary) return;
        try {
          await mutate("guest/cart/merge", "cart-merge", { cartToken: guestCart.token, customerCartToken: summary.cartToken });
          await refresh();
        } catch (problem) {
          if (!(problem instanceof ApiError) || ![409, 422].includes(problem.status)) throw problem;
          await Promise.allSettled([refresh(), refreshGuestCart()]);
          setError(problem.message);
        }
      })}>Gộp giỏ hàng</Button>
    </div>
  ) : undefined;
  if (!checkout) {
    return <CartView guest={!state} mergeNotice={mergeNotice} summary={summary} fetching={fetching} error={error} disabled={disabled} blocked={blocked}
      refresh={() => void refresh()} update={(action, data) => void run(() => update(action, data))}
      checkout={() => router.push("/checkout")} recommendations={<RecommendationRail surface={state ? "cart" : "home"} refreshKey={summary?.cartToken} />} />;
  }
  if (placedVietQrOrder) {
    const order = state?.orders.find(({ id }) => id === placedVietQrOrder.id) ?? placedVietQrOrder;
    return <CheckoutPayment key={order.id} order={order} />;
  }
  return <CheckoutView
    summary={summary} user={state?.user} addresses={addressBook} selectedAddress={selectedAddress} mergeNotice={mergeNotice}
    fetching={fetching} error={error} busy={busy} disabled={disabled} blocked={blocked || quoteChanged} addingAddress={addingAddress}
    quoteChanged={quoteChanged} previousTotal={quoteChanged && reviewed?.total !== summary?.total ? reviewed?.total ?? null : null}
    onRefresh={() => void refresh()}
    onAcceptPrices={() => void run(() => update("cart-refresh"))}
    onAcceptTotal={() => { if (summary) setReviewed(reviewedQuote(summary)); }}
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
      if (submitting.current) return;
      submitting.current = true;
      void run(async () => {
        try {
          if (!summary || blocked || quoteChanged || !summary.shipping.enabled) throw new Error("Giỏ chưa đủ điều kiện đặt hàng.");
          const order = await mutate(`${prefix}commerce`, "checkout", {
            ...data,
            ...(selectedAddress ? { addressId: selectedAddress.id } : {}),
            cartToken: summary.cartToken,
            quoteToken: summary.quoteToken,
            shippingRevision: summary.shipping.revision,
          }, "checkout");
          if (!state) {
            router.push(guestOrderPath(String(order.number), true));
            return;
          }
          if (order.paymentMethod === "VIETQR") {
            setPlacedVietQrOrder(order);
            return;
          }
          router.push(`/account/orders?order=${encodeURIComponent(order.id)}`);
        } catch (problem) {
          if (!(problem instanceof ApiError) || problem.status !== 409) throw problem;
          await refresh();
          setError(problem.message);
        } finally {
          submitting.current = false;
        }
      });
    }}
  />;
}

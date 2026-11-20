"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  discountCondition,
  discountHeadline,
  discountValue,
  offerLink,
  type CartSummary,
  type Offer,
} from "@/lib/discounts";
import { money } from "@/lib/store";
import styles from "./offer-display.module.css";
import { usePublicOfferFeed } from "./use-public-offers";

const animatedOffers = new Set<string>();

export function StoreFeaturedOffer() {
  const pathname = usePathname();
  const { offers, clockOffset } = usePublicOfferFeed();
  const [clock, setClock] = useState(Date.now);
  const [selection, setSelection] = useState<{
    pathname: string;
    id: string;
  } | null>(null);
  const isStorefront = pathname !== "/admin" && !pathname.startsWith("/admin/");
  const hasOffers = isStorefront && offers.length > 0;

  useEffect(() => {
    if (!hasOffers) return;
    const update = () => setClock(Date.now());
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [hasOffers]);

  if (!isStorefront) return null;
  const now = clock + clockOffset;
  const active = offers
    .filter((entry) => Date.parse(entry.endsAt) > now)
    .sort((first, second) => Number(second.featured) - Number(first.featured));
  const selectedIndex =
    selection?.pathname === pathname
      ? active.findIndex((entry) => entry.id === selection.id)
      : -1;
  const index = Math.max(0, selectedIndex);
  const offer = active[index];

  if (!offer) return null;
  const remaining = Math.ceil((Date.parse(offer.endsAt) - now) / 1000);
  return (
    <FeaturedOffer
      key={pathname}
      offer={offer}
      defaultExpanded={pathname === "/"}
      selectedByCustomer={selectedIndex >= 0}
      remaining={remaining}
      nextOffer={
        active.length > 1
          ? () => {
              setSelection({
                pathname,
                id: active[(index + 1) % active.length].id,
              });
            }
          : undefined
      }
      offerPosition={`${index + 1} / ${active.length}`}
    />
  );
}

function FeaturedOffer({
  offer,
  defaultExpanded,
  selectedByCustomer,
  remaining,
  nextOffer,
  offerPosition,
}: {
  offer: Offer;
  defaultExpanded: boolean;
  selectedByCustomer: boolean;
  remaining: number;
  nextOffer?: () => void;
  offerPosition: string;
}) {
  const [presentation, setPresentation] = useState<{
    collapsed: boolean;
    animate: boolean;
  } | null>(null);
  const collapsed = presentation?.collapsed;
  const toggle = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);
  const storageKey = `goihue:featured-offer:${offer.id}`;
  const introKey = `${storageKey}:intro`;

  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      if (selectedByCustomer) {
        setPresentation({ collapsed: false, animate: false });
        return;
      }
      let collapsed = !defaultExpanded;
      let animate = defaultExpanded && !animatedOffers.has(offer.id);
      try {
        collapsed ||= sessionStorage.getItem(storageKey) === "collapsed";
        animate =
          animate && !collapsed && sessionStorage.getItem(introKey) !== "shown";
        if (animate) sessionStorage.setItem(introKey, "shown");
      } catch {
        animate = animate && !collapsed;
      }
      if (animate) animatedOffers.add(offer.id);
      setPresentation({ collapsed, animate });
    });
    return () => {
      live = false;
    };
  }, [defaultExpanded, introKey, offer.id, selectedByCustomer, storageKey]);

  useEffect(() => {
    if (moveFocus.current) {
      moveFocus.current = false;
      toggle.current?.focus();
    }
  }, [collapsed]);

  function change(value: boolean) {
    moveFocus.current = true;
    setPresentation({ collapsed: value, animate: false });
    try {
      if (value) sessionStorage.setItem(storageKey, "collapsed");
      else if (defaultExpanded) sessionStorage.removeItem(storageKey);
    } catch {
      // The card stays usable when storage is unavailable.
    }
  }

  if (!presentation) return null;
  const days = Math.floor(remaining / 86400);
  const clock = [
    Math.floor(remaining / 3600) % 24,
    Math.floor(remaining / 60) % 60,
    remaining % 60,
  ]
    .map((unit) => String(unit).padStart(2, "0"))
    .join(":");
  const countdown = (
    <span className={styles.countdown}>
      Còn {days > 0 && `${days} ngày · `}
      {clock}
    </span>
  );

  return (
    <aside className={styles.featured} aria-label="Ưu đãi Gói Huế">
      {collapsed ? (
        <button
          ref={toggle}
          className={styles.reopen}
          type="button"
          aria-expanded={false}
          aria-label={discountHeadline(offer)}
          onClick={() => change(false)}
        >
          <span>
            Giảm đến <strong>{discountValue(offer)}</strong>
          </span>
          {countdown}
        </button>
      ) : (
        <div
          className={styles.flyout}
          data-intro={presentation.animate ? "true" : undefined}
        >
          <button
            ref={toggle}
            type="button"
            className={styles.close}
            aria-label="Thu gọn ưu đãi"
            aria-expanded
            onClick={() => change(true)}
          >
            ×
          </button>
          <span className={styles.kicker}>Ưu đãi Gói Huế</span>
          <h2 className={styles.savings} aria-label={discountHeadline(offer)}>
            <span className={styles.savingsLabel}>Giảm đến</span>{" "}
            <span className={styles.savingsValue} data-method={offer.method}>
              {discountValue(offer)}
            </span>
          </h2>
          <p className={styles.condition}>
            {discountCondition(offer, offer.productName)}
          </p>
          {offer.message && <p className={styles.message}>{offer.message}</p>}
          <div
            className={styles.deadline}
            role="timer"
            aria-label="Thời gian ưu đãi còn lại"
          >
            {countdown}
          </div>
          <Link className={styles.action} href={offerLink(offer)}>
            {offer.scope === "PRODUCTS"
              ? "Xem nhóm sản phẩm"
              : offer.productSlug
                ? "Xem sản phẩm"
                : "Xem bộ sưu tập"}{" "}
            <span className={styles.arrow} aria-hidden="true">
              →
            </span>
          </Link>
          {nextOffer && (
            <div className={styles.offerNavigation}>
              <span aria-live="polite">Ưu đãi {offerPosition}</span>
              <button type="button" onClick={nextOffer}>
                Xem ưu đãi khác →
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

export function ProductOffer({ offer }: { offer?: Offer }) {
  if (!offer) return null;
  return (
    <span className={styles.badge}>
      {discountHeadline(offer)} ·{" "}
      {offer.condition === "QUANTITY"
        ? `Mua từ ${offer.minimum}`
        : `Mua từ ${money(offer.minimum)}`}
      {offer.scope === "PRODUCTS" && " trong nhóm"}
    </span>
  );
}

export function DiscountPriceRow({ summary }: { summary: CartSummary }) {
  if (!summary.discount || summary.discountAmount <= 0) return null;
  return (
    <div className={styles.discountPrice}>
      <dt>
        Ưu đãi <small>{summary.discount.name}</small>
      </dt>
      <dd>−{money(summary.discountAmount)}</dd>
    </div>
  );
}

export function CartOfferHint({ hint }: { hint: CartSummary["offerHint"] }) {
  if (!hint) return null;
  const { offer, remainingQuantity, remainingAmount } = hint;
  const scope =
    offer.scope === "PRODUCTS"
      ? " thuộc nhóm ưu đãi"
      : offer.productName
        ? ` ${offer.productName}`
        : "";
  return (
    <p className={styles.hint}>
      {remainingQuantity
        ? `Thêm ${remainingQuantity} sản phẩm${scope}`
        : `Thêm ${money(remainingAmount)} tiền hàng${scope}`}{" "}
      để nhận ưu đãi {discountHeadline(offer).toLocaleLowerCase("vi")}.{" "}
      <Link href={offerLink(offer)}>Mua thêm →</Link>
    </p>
  );
}

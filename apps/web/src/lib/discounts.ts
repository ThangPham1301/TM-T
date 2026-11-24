import { money, type Row } from "./store";
import type { Measurement } from "./analytics-commerce";

export type OfferRule = {
  scope: "PRODUCT" | "PRODUCTS" | "CART";
  condition: "QUANTITY" | "SUBTOTAL";
  minimum: number;
  method: "PERCENT" | "FIXED";
  value: number;
};

export type Offer = OfferRule & {
  id: string;
  revision: number;
  name: string;
  productId: string;
  productIds?: string[];
  productName: string;
  productSlug: string;
  startsAt: string;
  endsAt: string;
  featured: boolean;
  priority: number;
  message: string;
};

export type CartSummary = {
  measurement?: Measurement;
  items: Row[];
  cartToken: string;
  quoteToken: string;
  priceToken: string;
  nextPriceChangeAt?: string | null;
  pricedAt?: string;
  subtotal: number;
  discountAmount: number;
  netSubtotal: number;
  shippingFee: number;
  total: number;
  shipping: Row;
  discount?: Pick<Offer, "id" | "revision" | "name">;
  offerHint?: {
    offer: Offer;
    remainingQuantity: number;
    remainingAmount: number;
  };
};

export function discountValue(rule: OfferRule) {
  return rule.method === "PERCENT" ? `${rule.value}%` : money(rule.value);
}

export function discountHeadline(rule: OfferRule) {
  return `Giảm đến ${discountValue(rule)}`;
}

export function discountCondition(rule: OfferRule, productName = "") {
  if (rule.scope === "PRODUCTS") {
    return rule.condition === "QUANTITY"
      ? `Khi mua từ ${rule.minimum} sản phẩm thuộc nhóm ưu đãi`
      : `Khi tiền hàng thuộc nhóm ưu đãi từ ${money(rule.minimum)}`;
  }
  if (rule.condition === "QUANTITY") {
    return `Khi mua từ ${rule.minimum} ${productName ? `đơn vị ${productName}` : "sản phẩm trong giỏ"}`;
  }
  return productName
    ? `Khi mua từ ${money(rule.minimum)} tiền hàng ${productName}`
    : `Khi tiền hàng từ ${money(rule.minimum)}`;
}

export function offerLink(offer: Offer) {
  if (offer.scope === "PRODUCTS")
    return `/products?discount=${encodeURIComponent(offer.id)}`;
  return offer.productSlug ? `/products/${offer.productSlug}` : "/products";
}

export function offerForProduct(offers: Offer[], id: string) {
  return offers.find(
    (offer) =>
      (offer.scope === "PRODUCT" && offer.productId === id) ||
      (offer.scope === "PRODUCTS" && offer.productIds?.includes(id)),
  );
}

import type { Row } from "./store";

export type RuleType = "SCHEDULE" | "STOCK" | "DEMAND";

export type Price = {
  amount: number;
  basePrice: number;
  source: RuleType | "BASE";
  ruleId?: string | null;
  name?: string | null;
  endsAt?: string | null;
};

export type PricingFeed = {
  asOf: string;
  hasScheduledPrices?: boolean;
  nextChangeAt?: string | null;
  prices: Record<string, Price>;
};

export const priceLabels = {
  SCHEDULE: "Giá giờ vàng",
  STOCK: "Giá theo tồn kho",
  DEMAND: "Giá theo sức mua",
  BASE: "Giá thường",
} satisfies Record<Price["source"], string>;

export const vietnamTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  dateStyle: "short",
  timeStyle: "short",
});

export function priceSource(row: Row, field = "pricing"): Price | undefined {
  return row[field] as Price | undefined;
}

export function applyPricing(product: Row, feed: PricingFeed | null): Row {
  if (!feed || product.basePrice === undefined) return product;
  const pricing = Object.hasOwn(feed.prices, product.id)
    ? feed.prices[product.id]
    : undefined;
  return {
    ...product,
    price: pricing?.amount ?? product.basePrice,
    basePrice: pricing?.basePrice ?? product.basePrice,
    pricing,
  };
}

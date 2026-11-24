export type PriceSource = "BASE" | "SCHEDULE" | "STOCK" | "DEMAND";
export type MeasurementItem = {
  productId: string; name: string; categoryCode: string; quantity: number;
  unitPrice: number; priceSource: PriceSource; lineDiscountAmount: number; lineNetTotal: number;
};
export type Measurement = {
  schemaVersion: 1; currency: "VND"; transactionId?: string; paymentMethod?: "COD" | "VIETQR";
  subtotal: number; discountAmount: number; netSubtotal: number; shippingFee: number; total: number;
  discount?: { id: string; revision: number; name: string }; items: MeasurementItem[];
};
export type GaItem = {
  item_id: string; item_name: string; item_category: string; price: number; quantity: number;
  discount?: number; price_source?: string; item_list_id?: string; item_list_name?: string; index?: number;
};
export type GaParams = Record<string, string | number | boolean | GaItem[]>;
export type CommerceEvent = { name: string; params: GaParams; dedup?: string };
export type MutationMeasurement = { schemaVersion: 1; operationId: string; changes: {
  productId: string; name: string; categoryCode: string; previousQuantity: number;
  newQuantity: number; effectiveUnitPrice: number; priceSource: PriceSource;
}[] };
const priceSources = new Set(["BASE", "SCHEDULE", "STOCK", "DEMAND"]);
const integer = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const identifier = (s: unknown): s is string => typeof s === "string" && s.length > 0 && s.length <= 100;

/** Split whole-VND remainders across units without changing totals or inventing another product. */
export function measurementItems(snapshot: Measurement): GaItem[] {
  if (snapshot.schemaVersion !== 1 || snapshot.currency !== "VND" || !Array.isArray(snapshot.items)) throw Error("measurement schema");
  const money = [snapshot.subtotal, snapshot.discountAmount, snapshot.netSubtotal, snapshot.shippingFee, snapshot.total];
  if (!money.every(integer) || snapshot.subtotal - snapshot.discountAmount !== snapshot.netSubtotal || snapshot.netSubtotal + snapshot.shippingFee !== snapshot.total) throw Error("measurement totals");
  let net = 0, reduction = 0, subtotal = 0;
  const items: GaItem[] = [];
  for (const line of snapshot.items) {
    if (!identifier(line.productId) || typeof line.name !== "string" || !line.categoryCode || !priceSources.has(line.priceSource) ||
        ![line.unitPrice, line.quantity, line.lineDiscountAmount, line.lineNetTotal].every(integer) || !line.quantity ||
        line.unitPrice * line.quantity - line.lineDiscountAmount !== line.lineNetTotal) throw Error("measurement line");
    net += line.lineNetTotal; reduction += line.lineDiscountAmount; subtotal += line.unitPrice * line.quantity;
    const base = Math.floor(line.lineDiscountAmount / line.quantity), remainder = line.lineDiscountAmount % line.quantity;
    for (const [quantity, discount] of [[line.quantity - remainder, base], [remainder, base + 1]]) {
      if (!quantity) continue;
      if (line.unitPrice < discount) throw Error("negative item price");
      items.push({ item_id: line.productId, item_name: line.name, item_category: line.categoryCode,
        price: line.unitPrice - discount, discount, quantity, price_source: line.priceSource });
    }
  }
  if (subtotal !== snapshot.subtotal || net !== snapshot.netSubtotal || reduction !== snapshot.discountAmount || items.length > 200) throw Error("measurement allocation");
  if (snapshot.discountAmount > 0 && !identifier(snapshot.discount?.id)) throw Error("missing offer");
  return items;
}

export function quoteParams(snapshot: Measurement): GaParams {
  return { currency: "VND", value: snapshot.netSubtotal, items: measurementItems(snapshot),
    has_auto_discount: snapshot.discountAmount > 0 ? "yes" : "no",
    ...(snapshot.discountAmount > 0 && snapshot.discount ? { offer_id: snapshot.discount.id, offer_name: snapshot.discount.name } : {}) };
}

/** Only explicit safe DTOs are read. A raw order must never be spread into a GA payload. */
export function mutationEvents(action: string, result: { measurement?: Measurement; measurementMutation?: MutationMeasurement },
                               checkoutType: "guest" | "account", source: string): CommerceEvent[] {
  if (action === "checkout") {
    const s = result.measurement;
    if (!s || !identifier(s.transactionId) || !["COD", "VIETQR"].includes(s.paymentMethod ?? "") || !s.items.length) throw Error("missing purchase snapshot");
    return [{ name: "purchase", params: { ...quoteParams(s), transaction_id: s.transactionId!, shipping: s.shippingFee,
      payment_method: s.paymentMethod!, checkout_type: checkoutType, source_surface: source }, dedup: `purchase:${s.transactionId}` }];
  }
  if (!["cart-set", "cart-clear"].includes(action)) return [];
  const mutation = result.measurementMutation;
  if (!mutation || mutation.schemaVersion !== 1 || !identifier(mutation.operationId) || !Array.isArray(mutation.changes)) throw Error("missing cart measurement");
  return mutation.changes.flatMap((c, index) => {
    if (![c.previousQuantity, c.newQuantity, c.effectiveUnitPrice].every(integer) || !identifier(c.productId) || !c.categoryCode || !priceSources.has(c.priceSource)) throw Error("cart measurement line");
    const delta = c.newQuantity - c.previousQuantity;
    if (!delta) return [];
    const item: GaItem = { item_id: c.productId, item_name: c.name, item_category: c.categoryCode,
      price: c.effectiveUnitPrice, quantity: Math.abs(delta), price_source: c.priceSource };
    return [{ name: delta > 0 ? "add_to_cart" : "remove_from_cart", params: { currency: "VND", value: item.price * item.quantity,
      items: [item], source_surface: source }, dedup: `cart:${mutation.operationId}:${index}` }];
  });
}

export function productItem(product: Record<string, unknown>): GaItem {
  const pricing = product.pricing as { source?: string } | undefined;
  return { item_id: String(product.id ?? product.productId ?? ""), item_name: String(product.name ?? ""),
    item_category: String(product.category ?? ""), price: Number(product.price), quantity: 1,
    price_source: pricing?.source ?? "BASE" };
}

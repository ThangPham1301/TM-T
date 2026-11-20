import { priceLabels, priceSource, vietnamTime } from "@/lib/pricing";
import { money, type Row } from "@/lib/store";
import styles from "./price-display.module.css";

export function ProductPrice({
  product,
  detail = false,
}: {
  product: Row;
  detail?: boolean;
}) {
  const pricing = priceSource(product);
  return (
    <span className={styles.price}>
      <strong>{money(product.price)}</strong>
      {pricing && pricing.amount < pricing.basePrice && (
        <del aria-label={`Giá thường ${money(pricing.basePrice)}`}>
          {money(pricing.basePrice)}
        </del>
      )}
      {pricing && pricing.source !== "BASE" && (
        <span className={styles.label}>{priceLabels[pricing.source]}</span>
      )}
      {detail && pricing?.endsAt && (
        <time className={styles.detail} dateTime={pricing.endsAt}>
          Áp dụng đến {vietnamTime.format(new Date(pricing.endsAt))}
        </time>
      )}
    </span>
  );
}

export function CartPricing({ line }: { line: Row }) {
  const pricing = priceSource(line, "currentPricing");
  if (!line.priceChanged && (!pricing || pricing.source === "BASE"))
    return null;
  return (
    <span className={styles.cartPricing}>
      {Boolean(line.priceChanged) && (
        <span>
          Đơn giá: <del>{money(line.price)}</del> →{" "}
          <strong>{money(line.currentPrice)}</strong>
        </span>
      )}
      {pricing && pricing.source !== "BASE" && (
        <span>
          {priceLabels[pricing.source]} · Giá này không cộng thêm ưu đãi giỏ hàng
        </span>
      )}
    </span>
  );
}

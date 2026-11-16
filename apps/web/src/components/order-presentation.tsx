import { StatusBadge } from "@/shared/ui";
import { label, type Row } from "@/lib/store";
import styles from "./journey.module.css";

type Tone = "neutral" | "success" | "warning" | "errorTone";

/** Semantic tone mapping for the two independent status axes.
 *  Presentation only — the underlying status values are unchanged. */
const ORDER_TONES: Record<string, Tone> = {
  PLACED: "neutral",
  CONFIRMED: "neutral",
  PACKED: "warning",
  SHIPPED: "warning",
  DELIVERED: "success",
  DELIVERY_FAILED: "warning",
  RETURNED: "neutral",
  CANCELLED: "errorTone",
};
const PAYMENT_TONES: Record<string, Tone> = {
  UNPAID: "neutral",
  PENDING: "warning",
  PAID: "success",
  REVIEW: "warning",
  REFUNDED: "success",
  RESOLVED_PAID: "success",
  EXPIRED: "errorTone",
};

/** Order status and payment status as two independent badges. */
export function OrderBadges({ order }: { order: Row }) {
  return (
    <span className={styles.badges}>
      <StatusBadge tone={ORDER_TONES[String(order.status)] ?? "neutral"}>
        {label(order.status)}
      </StatusBadge>
      {order.paymentStatus != null && (
        <StatusBadge
          tone={PAYMENT_TONES[String(order.paymentStatus)] ?? "neutral"}
        >
          {label(order.paymentStatus)}
        </StatusBadge>
      )}
    </span>
  );
}

const MAIN_STEPS = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"];
const STEP_CAPTIONS: Record<string, string> = {
  PLACED: "Cửa hàng đã nhận đơn và đang chờ xác nhận.",
  CONFIRMED: "Đơn đã được xác nhận và đang chờ đóng gói.",
  PACKED: "Đơn đang được đóng gói.",
  SHIPPED: "Đơn đang trên đường giao đến người nhận.",
  DELIVERED: "Đơn đã giao thành công.",
};
/** Exception states are NOT steps of the normal journey: they get an
 *  explanation block instead of a half-filled stepper (hybrid timeline). */
const EXCEPTION_NOTES: Record<string, string> = {
  CANCELLED:
    "Đơn hàng đã bị hủy và không tiếp tục quy trình xử lý thông thường.",
  DELIVERY_FAILED:
    "Lần giao gần nhất không thành công; đơn chưa tới tay người nhận.",
  RETURNED: "Hàng của đơn này đã được hoàn về kho của cửa hàng.",
};

export function OrderTimeline({ order }: { order: Row }) {
  const status = String(order.status);
  const note = EXCEPTION_NOTES[status];
  if (note) {
    return (
      <div className={styles.exception}>
        <p>{note}</p>
      </div>
    );
  }
  const idx = MAIN_STEPS.indexOf(status);
  if (idx < 0) return null;
  return (
    <div className={styles.timelineWrap}>
      <ol className={styles.timeline} aria-label="Tiến trình đơn hàng">
        {MAIN_STEPS.map((s, i) => (
          <li
            key={s}
            className={[
              styles.tlStep,
              i < idx ? styles.tlDone : "",
              i === idx ? styles.tlCurrent : "",
            ].join(" ")}
            aria-current={i === idx ? "step" : undefined}
          >
            <span className={styles.tlDot} />
            <span className={styles.tlLabel}>{label(s)}</span>
          </li>
        ))}
      </ol>
      <p className={styles.tlCaption}>{STEP_CAPTIONS[status]}</p>
    </div>
  );
}

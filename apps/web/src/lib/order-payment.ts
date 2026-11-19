import type { Row } from "./store";

export function isCodOrder(order: Row) {
  return order.paymentMethod == null || order.paymentMethod === "COD";
}

export function codAmountDue(order: Row) {
  return Number(order.codDueAmount ?? order.total ?? 0);
}

export function codDisplayAmount(order: Row) {
  return order.paymentStatus === "PAID" ? Number(order.codCollectedAmount ?? codAmountDue(order)) : codAmountDue(order);
}

export function codHasNoCollection(order: Row) {
  return order.paymentStatus !== "PAID" && ["CANCELLED", "RETURNED"].includes(String(order.status));
}

export function codNeedsReceipt(order: Row) {
  return isCodOrder(order) && order.status === "DELIVERED" && orderPaymentStatus(order) === "UNPAID";
}

export type ExtraPayment = {
  transactionId: string;
  status: "REVIEW" | "REFUNDED";
  amount?: number;
  receivedAt?: string;
  refundReference?: string;
  refundedAt?: string;
};

export function paymentDetails(order: Row) {
  return (order.payment ?? null) as Row | null;
}

export function legacyExtraPayment(order: Row) {
  const payment = paymentDetails(order);
  return order.paymentStatus === "REVIEW" && Boolean(payment?.paidAt && payment.transactionId)
    && typeof payment?.extraTransactionId === "string" && payment.extraTransactionId.trim()
    ? payment.extraTransactionId
    : null;
}

export function extraPayments(order: Row): ExtraPayment[] {
  const extras = paymentDetails(order)?.extraPayments;
  const legacy = legacyExtraPayment(order);
  return [
    ...(Array.isArray(extras) ? extras as ExtraPayment[] : []),
    ...(legacy ? [{ transactionId: legacy, status: "REVIEW" } as const] : []),
  ];
}

export function orderPaymentStatus(order: Row) {
  if (legacyExtraPayment(order)) return "PAID";
  const status = String(order.paymentStatus ?? "UNPAID");
  if (order.paymentMethod !== "VIETQR" || status !== "UNPAID") return status;
  if (paymentDetails(order)?.status === "EXPIRED") return "EXPIRED";
  if (order.status === "CANCELLED" || order.status === "RETURNED") return "CANCELLED";
  return "PENDING";
}

export function orderPaymentLabel(order: Row) {
  const status = orderPaymentStatus(order);
  if (isCodOrder(order)) {
    if (status === "PAID") return "COD · Đã ghi nhận thu tiền";
    if (status === "UNPAID") {
      if (codHasNoCollection(order)) return "COD · Không thu tiền";
      if (codNeedsReceipt(order)) return "COD · Chưa ghi nhận thu";
      return "COD · Trả khi nhận hàng";
    }
  }
  const method = order.paymentMethod === "VIETQR" ? "VietQR" : "COD";
  const text: Record<string, string> = {
    PAID: "Đã thanh toán",
    PENDING: "Chờ chuyển khoản",
    REVIEW: "Cần đối soát",
    EXPIRED: "Hết hạn",
    REFUNDED: "Đã hoàn tiền",
    CANCELLED: "Đã hủy",
    UNPAID: "Chưa thu tiền",
  };
  return `${method} · ${text[status] ?? status}`;
}

export function needsPaymentReview(order: Row) {
  return orderPaymentStatus(order) === "REVIEW" || extraPayments(order).some((receipt) => receipt.status === "REVIEW");
}

export function matchesPaymentFilter(order: Row, filter: string) {
  if (!filter) return true;
  if (filter === "REVIEW") return needsPaymentReview(order);
  if (filter === "COD_UNRECORDED") return codNeedsReceipt(order);
  const status = orderPaymentStatus(order);
  return status === filter || (filter === "UNPAID" && status === "PENDING");
}

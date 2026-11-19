"use client";

import { useState } from "react";
import { date, fields, money, type Row } from "@/lib/store";
import { codDisplayAmount, codHasNoCollection, codNeedsReceipt, extraPayments, orderPaymentLabel, orderPaymentStatus, paymentDetails } from "@/lib/order-payment";
import { Button } from "@/shared/ui";
import styles from "./admin-order-payment.module.css";

export function AdminCodPayment({ order }: { order: Row }) {
  const paid = orderPaymentStatus(order) === "PAID";
  const closed = codHasNoCollection(order);
  return (
    <section className={styles.panel} aria-label="Thanh toán COD">
      <h3>Thanh toán COD</h3>
      <dl className={styles.entries}>
        {!closed && <div><dt>{paid ? "Số tiền đã thu" : "Số tiền phải thu"}</dt><dd>{money(codDisplayAmount(order))}</dd></div>}
        <div><dt>Trạng thái</dt><dd>{orderPaymentLabel(order)}</dd></div>
        {paid && Boolean(order.paidAt) && <div><dt>Ghi nhận lúc</dt><dd>{date(order.paidAt)}</dd></div>}
        {paid && Boolean(order.paymentReference) && <div><dt>Chứng từ thu COD</dt><dd>{String(order.paymentReference)}</dd></div>}
      </dl>
      {codNeedsReceipt(order) && <p className={styles.codNotice}>Đơn đã giao. Bổ sung chứng từ hoặc hoàn tất điều chỉnh khoản phải thu trong hồ sơ đổi trả trước khi ghi nhận COD.</p>}
    </section>
  );
}

export function AdminOrderPayment({ order, busy, onResolve }: {
  order: Row;
  busy: boolean;
  onResolve: (data: Record<string, unknown>) => void;
}) {
  const payment = paymentDetails(order);
  const status = orderPaymentStatus(order);
  const extras = extraPayments(order);
  const unresolved = extras.filter((receipt) => receipt.status === "REVIEW");
  const reviewingPrimary = status === "REVIEW";
  const [selection, setSelection] = useState(reviewingPrimary ? "" : unresolved[0]?.transactionId ?? "");
  const canRecordPaid = reviewingPrimary && !payment?.reviewReason
    && !["CANCELLED", "RETURNED"].includes(String(order.status));
  const hasReview = reviewingPrimary || unresolved.length > 0;
  const processedAt = payment?.refundedAt ?? payment?.paidAt ?? order.paidAt;
  const entries = [
    ["Số tiền phải thu", money(order.total)],
    ["Trạng thái", orderPaymentLabel(order)],
    [processedAt ? "Thời điểm xử lý" : status === "PENDING" || status === "EXPIRED" ? "Hạn chuyển khoản" : "Thời điểm tiếp nhận", date(processedAt ?? (status === "PENDING" || status === "EXPIRED" ? payment?.expiresAt : payment?.receivedAt))],
    ["Mã giao dịch", String(payment?.transactionId ?? "")],
    ["Số tiền đã nhận", payment?.receivedAmount != null ? money(payment.receivedAmount) : ""],
    ["Chứng từ", String(order.paymentReference ?? "")],
  ];

  return (
    <section className={styles.panel} aria-label="Thanh toán VietQR">
      <h3>Thanh toán VietQR</h3>
      <dl className={styles.entries}>
        {entries.filter(([, value]) => value).map(([name, value]) => (
          <div key={name}><dt>{name}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      {payment?.reviewReason === "AMOUNT" && <p>Số tiền nhận được khác tổng đơn.</p>}
      {payment?.reviewReason === "LATE" && <p>Giao dịch đến sau khi hết hạn hoặc đơn đã đóng.</p>}
      {extras.length > 0 && (
        <ul className={styles.receipts} aria-label="Giao dịch bổ sung">
          {extras.map((receipt) => (
            <li key={receipt.transactionId}>
              <strong>{receipt.transactionId}</strong>
              {receipt.amount != null && <span>{money(receipt.amount)}</span>}
              {receipt.receivedAt && <span>{date(receipt.receivedAt)}</span>}
              <span>{receipt.status === "REVIEW" ? "Cần đối soát" : "Đã ghi nhận hoàn khoản bổ sung"}</span>
              {receipt.refundReference && <span>Chứng từ {receipt.refundReference}</span>}
            </li>
          ))}
        </ul>
      )}
      {hasReview && (
        <details>
          <summary>Xử lý đối soát</summary>
          <form className="store-form" onSubmit={(event) => {
            const data = fields(event);
            onResolve(selection ? { ...data, resolution: "EXTRA_REFUNDED", transactionId: selection } : data);
          }}>
            {unresolved.length > 0 && (
              <label>Giao dịch cần xử lý
                <select value={selection} onChange={(event) => setSelection(event.target.value)}>
                  {reviewingPrimary && <option value="">Khoản chuyển chính</option>}
                  {unresolved.map((receipt) => <option key={receipt.transactionId} value={receipt.transactionId}>Khoản bổ sung · {receipt.transactionId}</option>)}
                </select>
              </label>
            )}
            {selection ? <p>Ghi nhận đã hoàn khoản chuyển bổ sung qua kênh ngoài hệ thống.</p> : (
              <label>Kết quả đối soát
                <select name="resolution" key={selection} required defaultValue={canRecordPaid ? "" : "REFUNDED"}>
                  {canRecordPaid && <option value="" disabled>Chọn kết quả</option>}
                  {canRecordPaid && <option value="PAID_RECORDED">Ghi nhận đã thu tiền</option>}
                  <option value="REFUNDED">Ghi nhận đã hoàn tiền qua kênh ngoài hệ thống</option>
                </select>
              </label>
            )}
            <label>Mã chứng từ <input name="reference" required maxLength={200} /></label>
            <label>Ghi chú <textarea name="note" required maxLength={2000} rows={2} /></label>
            <Button type="submit" loading={busy}>Lưu kết quả đối soát</Button>
          </form>
        </details>
      )}
    </section>
  );
}

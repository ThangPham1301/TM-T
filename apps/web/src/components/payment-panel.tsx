"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { date, label, money, type Row } from "@/lib/store";
import { legacyExtraPayment, orderPaymentStatus, paymentDetails } from "@/lib/order-payment";
import { Button } from "@/shared/ui";
import styles from "./journey.module.css";

/**
 * VietQR payment block for checkout and order details. The payload comes from the
 * backend (EMVCo string with the exact amount and the order number as the
 * transfer content). The panel is driven by store state, so when the IPN
 * lands and the websocket pushes the new state, the panel flips from the
 * QR/countdown to the paid/review outcome without a page reload.
 */
export function PaymentPanel({ order, showQr = true }: { order: Row; showQr?: boolean }) {
  const payment = paymentDetails(order);
  const [qr, setQr] = useState<{ payload: string; url: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const payload = payment ? String(payment.payload ?? "") : "";
  const pStatus = legacyExtraPayment(order) ? "PAID" : String(payment?.status ?? "");
  const status = orderPaymentStatus(order);
  const pending = pStatus === "PENDING" && status === "PENDING";
  const deadline = Date.parse(String(payment?.expiresAt ?? ""));
  const canShowQr = showQr && pending && (Number.isNaN(deadline) || (secondsLeft !== null && secondsLeft > 0));
  useEffect(() => {
    if (!canShowQr || !payload) return;
    let active = true;
    // Render an image so it can be dragged into the SePay simulation tab.
    void QRCode.toDataURL(payload, { width: 432, margin: 1 })
      .then((url) => { if (active) setQr({ payload, url }); })
      .catch(() => { if (active) setQr({ payload, url: "" }); });
    return () => { active = false; };
  }, [payload, canShowQr]);
  useEffect(() => {
    if (!pending || Number.isNaN(deadline)) return;
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [pending, deadline]);
  const expired = pending && !Number.isNaN(deadline) && secondsLeft === 0;
  const qrResult = qr?.payload === payload ? qr : null;
  const remain = !Number.isNaN(deadline) && secondsLeft !== null && secondsLeft > 0
    ? `Còn ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")} để chuyển khoản.`
    : "";
  if (String(order.paymentMethod) !== "VIETQR" || !payment)
    return (
      <p>
        Thanh toán {label(order.paymentMethod)}: {label(order.paymentStatus)}
      </p>
    );
  const paymentHeading = (
    <div className={styles.paymentHeading}>
      <p><strong>VietQR — Không chuyển tiền vào mã này</strong> · {label(status)}</p>
      {canShowQr && remain && <p className={styles.paymentDeadline}>{remain}</p>}
    </div>
  );

  if (canShowQr) {
    const content = String(payment.content ?? "");
    return (
      <section className={`store-payment ${styles.paymentPanel}`} aria-label="Thông tin thanh toán VietQR">
        <div className={styles.paymentLayout}>
          <div className={styles.paymentCode}>
            {qrResult?.url ? (
              <div className={styles.qrFrame}>
                <Image
                  src={qrResult.url}
                  width={160}
                  height={160}
                  alt="Mã VietQR của đơn hàng"
                  unoptimized
                  draggable
                />
              </div>
            ) : !payload || qrResult ? (
              <p className="store-warning" role="status">Không hiển thị được mã VietQR. Vui lòng liên hệ cửa hàng để được hỗ trợ.</p>
            ) : <p role="status">Đang tạo mã VietQR…</p>}
          </div>
          <div className={styles.paymentBody}>
            {paymentHeading}
            <dl className={styles.paymentDetails}>
              <div><dt>Số tiền hiển thị</dt><dd>{money(payment.amount)}</dd></div>
              <div><dt>Nội dung chuyển khoản</dt><dd>{content}</dd></div>
              <div><dt>Tài khoản nhận</dt><dd>{String(payment.bankAccount)}{payment.bankName ? ` · ${String(payment.bankName)}` : ""}</dd></div>
            </dl>
            {(content || qrResult?.url) && (
              <div className={styles.paymentTools}>
                {content && <Button variant="secondary" size="small" onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(content);
                    setCopyStatus("Đã sao chép nội dung chuyển khoản.");
                  } catch {
                    setCopyStatus("Hãy chọn và sao chép nội dung chuyển khoản thủ công.");
                  }
                }}>Sao chép nội dung</Button>}
                {qrResult?.url && (
                  <a className={styles.qrDownload} href={qrResult.url} download={`vietqr-${order.number}.png`}>
                    Lưu mã QR
                  </a>
                )}
                <span role="status">{copyStatus}</span>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="store-payment">
      {paymentHeading}
      {expired && <p role="status">Phiên VietQR đã hết hạn. Hệ thống đang cập nhật trạng thái đơn hàng.</p>}
      {pending && !expired && !showQr && <p>{remain}</p>}
      {pStatus === "PENDING" && !pending && <p>{order.paymentStatus === "PAID" ? "Đơn hàng đã được ghi nhận thanh toán." : "Đơn hàng không còn chờ thanh toán."}</p>}
      {pStatus === "PAID" && (
        <p>
          Đã thanh toán{payment.paidAt ? ` lúc ${date(payment.paidAt)}` : ""}
          {payment.transactionId ? ` · Mã giao dịch ${String(payment.transactionId)}` : ""}
        </p>
      )}
      {pStatus === "REVIEW" && (
        <p className="store-warning">
          Cửa hàng đang đối soát khoản chuyển khoản. Vui lòng không chuyển thêm.
        </p>
      )}
      {pStatus === "EXPIRED" && (
        <p>
          Phiên thanh toán đã hết hạn; đơn đã bị hủy và tồn kho đã được hoàn.
          Hãy đặt một đơn mới.
        </p>
      )}
      {pStatus === "RESOLVED_PAID" && (
        <p>Đã đối soát xong: cửa hàng đã ghi nhận khoản thanh toán này.</p>
      )}
      {pStatus === "REFUNDED" && (
        <p>Đã đối soát xong: khoản thanh toán đã được hoàn cho khách.</p>
      )}
    </div>
  );
}

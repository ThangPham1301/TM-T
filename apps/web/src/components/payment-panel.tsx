"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { date, label, money, type Row } from "@/lib/store";
import styles from "./journey.module.css";

/**
 * VietQR payment block on the order detail. The QR payload comes from the
 * backend (EMVCo string with the exact amount and the order number as the
 * transfer content). The panel is driven by store state, so when the IPN
 * lands and the websocket pushes the new state, the panel flips from the
 * QR/countdown to the paid/review outcome without a page reload.
 */
export function PaymentPanel({ order }: { order: Row }) {
  const payment = (order.payment ?? null) as Row | null;
  const [qrUrl, setQrUrl] = useState("");
  const [remain, setRemain] = useState("");
  const payload = payment ? String(payment.payload ?? "") : "";
  const pStatus = payment ? String(payment.status ?? "") : "";
  const expiresAt = payment ? String(payment.expiresAt ?? "") : "";
  useEffect(() => {
    if (payload && pStatus === "PENDING") {
      // Render as a real <img> (not a canvas) so the QR can be dragged
      // straight into the SePay simulation tab, which parses the image.
      void QRCode.toDataURL(payload, { width: 432, margin: 1 }).then(setQrUrl);
    }
  }, [payload, pStatus]);
  useEffect(() => {
    if (!payment || pStatus !== "PENDING" || !expiresAt) return;
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0)
        setRemain("Đã hết hạn — hệ thống đang hủy phiên và hoàn tồn kho.");
      else {
        const s = Math.floor(ms / 1000);
        setRemain(
          `Còn ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} để chuyển khoản.`,
        );
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [payment, pStatus, expiresAt]);
  if (String(order.paymentMethod) !== "VIETQR" || !payment)
    return (
      <p>
        Thanh toán {label(order.paymentMethod)}: {label(order.paymentStatus)}
      </p>
    );
  return (
    <div className="store-payment">
      <p>
        <strong>Thanh toán VietQR</strong> · {label(order.paymentStatus)}
      </p>
      {pStatus === "PENDING" && (
        <>
          {qrUrl && (
            <div className={styles.qrFrame}>
              <img
                src={qrUrl}
                width={216}
                height={216}
                alt="Mã VietQR của đơn hàng"
                draggable
              />
            </div>
          )}
          <p>
            Quét bằng ứng dụng ngân hàng: <strong>{money(payment.amount)}</strong>
            <br />
            Nội dung chuyển khoản: <strong>{String(payment.content)}</strong>{" "}
            (giữ nguyên để hệ thống khớp đúng đơn)
            <br />
            Tài khoản nhận: {String(payment.bankAccount)} · {remain}
          </p>
          <p className="store-subtle">
            Trang tự cập nhật khi tiền về — không cần tải lại. Nếu chuyển sai
            số tiền hoặc tiền đến sau khi hết hạn, đơn chuyển sang đối soát
            (REVIEW) để cửa hàng xử lý; tiền không bị mất.
          </p>
        </>
      )}
      {pStatus === "PAID" && (
        <p>
          Đã thanh toán lúc {date(payment.paidAt)} · Mã giao dịch{" "}
          {String(payment.transactionId)}
        </p>
      )}
      {pStatus === "REVIEW" && (
        <p className="store-warning">
          Khoản thanh toán đang được đối soát (sai lệch số tiền hoặc đến
          muộn). Cửa hàng sẽ xử lý: ghi nhận đơn hoặc hoàn tiền theo chính
          sách.
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

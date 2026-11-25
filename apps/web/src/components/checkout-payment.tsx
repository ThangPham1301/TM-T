"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { money, type Row } from "@/lib/store";
import { Button, Dialog } from "@/shared/ui";
import { PaymentPanel } from "./payment-panel";
import styles from "./checkout-payment.module.css";

export function CheckoutPayment({ order }: { order: Row }) {
  const [open, setOpen] = useState(true);
  const receiptHeading = useRef<HTMLHeadingElement>(null);
  const orderDetails = `/account/orders?order=${encodeURIComponent(order.id)}`;
  const close = () => setOpen(false);
  useEffect(() => {
    if (!open) receiptHeading.current?.focus();
  }, [open]);

  return (
    <main className={styles.page}>
      <section className={styles.receipt} aria-labelledby="checkout-receipt-title">
        <span className={`material-symbols-outlined ${styles.icon}`} aria-hidden="true">task_alt</span>
        <h1 id="checkout-receipt-title" tabIndex={-1} ref={receiptHeading}>Đặt hàng thành công</h1>
        <p>Đơn <strong>{String(order.number)}</strong> · {money(order.total)}</p>
        <p>Bạn có thể xem trạng thái và mở lại VietQR trong chi tiết đơn hàng.</p>
        <div className={styles.actions}>
          <Link className={styles.primaryLink} href={orderDetails} replace>Xem chi tiết đơn hàng</Link>
          <Link className={styles.secondaryLink} href="/products">Tiếp tục mua sắm</Link>
        </div>
      </section>

      <VietQrDialog order={order} open={open} onClose={close} orderDetails={orderDetails} />
    </main>
  );
}

export function VietQrDialog({ order, open, onClose, orderDetails }: {
  order: Row;
  open: boolean;
  onClose: () => void;
  orderDetails?: string;
}) {
  return (
    <Dialog open={open} title="Mã VietQR" onClose={onClose} className={styles.dialog}>
      <p className={styles.orderNumber}>Mã đơn hàng <strong>{String(order.number)}</strong></p>
      {open && <PaymentPanel order={order} />}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onClose}>Đóng mã QR</Button>
        {orderDetails && <Link className={styles.primaryLink} href={orderDetails} replace>Xem chi tiết đơn hàng</Link>}
      </div>
    </Dialog>
  );
}

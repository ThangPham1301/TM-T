"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, date, fields, label, money } from "@/lib/store";
import { guestLookupPath, guestOrderPath } from "@/lib/guest-order";
import { codAmountDue, codHasNoCollection, orderPaymentLabel } from "@/lib/order-payment";
import { Button, TextField } from "@/shared/ui";
import { VietQrDialog } from "./checkout-payment";
import { PaymentPanel } from "./payment-panel";
import { GuestSupport } from "./guest-support";
import { ProductImage } from "./product/product-image";
import styles from "./guest-order.module.css";

type GuestOrder = {
  number: string;
  lookupCode?: string;
  createdAt: string;
  status: string;
  paymentMethod: "COD" | "VIETQR";
  paymentStatus: string;
  payment?: { status: string; expiresAt?: string; payload?: string };
  trackingReference?: string;
  items: { productId: string; image?: string; name: string; quantity: number; price: number; netTotal?: number }[];
  history: { status: string; at: string }[];
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  total: number;
  codDueAmount?: number;
};

export function GuestOrderPage({ number, confirmation }: { number: string; confirmation: boolean }) {
  const router = useRouter();
  const [order, setOrder] = useState<GuestOrder | null>(null);
  const [recent, setRecent] = useState("");
  const [loading, setLoading] = useState(Boolean(number));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [dismissedQr, setDismissedQr] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (number) return;
    let active = true;
    void api("guest/orders/latest").then((result) => {
      if (active && result.number) setRecent(result.number);
    }).catch(() => {});
    return () => { active = false; };
  }, [number]);

  useEffect(() => {
    if (!number) return;
    let active = true;
    let request = 0;
    let timer: ReturnType<typeof setTimeout>;
    function update() {
      const id = ++request;
      clearTimeout(timer);
      void api(`guest/orders/${number}`).then((result) => {
        if (!active || id !== request) return;
        setOrder(result);
        setMessage("");
        if (!["DELIVERED", "CANCELLED", "RETURNED"].includes(result.status) || result.paymentStatus === "REVIEW")
          timer = setTimeout(update, 10_000);
      }).catch((error) => {
        if (!active || id !== request) return;
        if (error instanceof ApiError && error.status === 404) setOrder(null);
        else setMessage(error instanceof Error ? error.message : "Chưa tải được đơn hàng.");
      }).finally(() => {
        if (active && id === request) setLoading(false);
      });
    }
    update();
    window.addEventListener("focus", update);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener("focus", update);
    };
  }, [number, refresh]);

  const viewedNumber = order?.number;
  useEffect(() => {
    if (viewedNumber && window.location.hash === "#ho-tro-don-hang")
      document.getElementById("ho-tro-don-hang")?.scrollIntoView({ block: "start" });
  }, [viewedNumber]);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    const input = fields(event);
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result: GuestOrder = await api("guest/orders/lookup", "POST", input);
      setOrder(result);
      setRefresh((value) => value + 1);
      router.replace(guestOrderPath(result.number) + (window.location.hash === "#ho-tro-don-hang" ? "#ho-tro-don-hang" : ""));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa tra cứu được đơn hàng.");
    } finally {
      setBusy(false);
    }
  }

  function closeQr() {
    setDismissedQr(true);
    router.replace(guestOrderPath(number), { scroll: false });
  }

  const accessCode = order?.lookupCode?.match(/.{1,8}/gu)?.join("-") ?? "";
  async function copyLookupDetails() {
    if (!order || !accessCode) return;
    try {
      await navigator.clipboard.writeText(
        `Gói Huế\nMã đơn hàng: ${order.number}\nMã tra cứu: ${accessCode}\nTra cứu: ${location.origin}${guestLookupPath}`,
      );
      setCopied("Đã sao chép thông tin tra cứu.");
    } catch {
      setCopied("Bạn có thể chọn và sao chép hai mã ở trên.");
    }
  }

  if (loading) return <main className={styles.page}><div className={styles.wrap} role="status">Đang tải đơn hàng…</div></main>;
  if (!order) {
    return (
      <main className={styles.page}>
        <div className={`gh-frame-plaque ${styles.lookup}`}>
          <span className="gh-kicker">Đơn hàng Gói Huế</span>
          <h1>Tra cứu đơn hàng</h1>
          <p className={styles.muted}>Nhập mã đơn và mã tra cứu trên trang xác nhận để xem tiến trình giao hàng.</p>
          {recent && <Link className={styles.recent} href={guestOrderPath(recent)}>Xem đơn gần nhất · {recent} →</Link>}
          <form className={styles.form} onSubmit={lookup}>
            <TextField label="Mã đơn hàng" name="number" defaultValue={number} placeholder="GH-XXXXXXXX" autoComplete="off" spellCheck={false} required maxLength={20} />
            <TextField label="Mã tra cứu" name="lookupCode" type="password" placeholder="Nhập mã tra cứu của đơn" autoComplete="off" required maxLength={48} />
            {message && <p role="alert" className={styles.error}>{message}</p>}
            <Button type="submit" loading={busy} loadingLabel="Đang tra cứu…">Tra cứu đơn hàng <span aria-hidden="true">→</span></Button>
          </form>
          <p className={styles.muted}>Đã đặt bằng tài khoản? <Link href="/account/orders">Xem đơn hàng của tôi</Link>.</p>
          <p className={styles.muted}>Xem <Link href="/shipping-payment-policy">hướng dẫn tra cứu và theo dõi đơn</Link>.</p>
          <p className={styles.muted} id="ho-tro-don-hang">Để gửi yêu cầu hỗ trợ hoặc theo dõi phản hồi, hãy tra cứu bằng mã đơn và mã tra cứu ở trên.</p>
        </div>
      </main>
    );
  }

  const paymentOrder = { ...order, id: order.number };
  const isQr = order.paymentMethod === "VIETQR";
  const openQr = confirmation && !dismissedQr && Boolean(order.payment?.payload);
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <nav className={styles.breadcrumb} aria-label="Đường dẫn">
          <Link href={guestLookupPath}>Tra cứu đơn hàng</Link><span aria-hidden="true">›</span><span>{order.number}</span>
        </nav>
        <header className={styles.heading}>
          <div>
            <span className="gh-kicker">{confirmation ? "Đã tiếp nhận đơn hàng" : "Tiến trình đơn hàng"}</span>
            <h1>{confirmation ? "Đặt hàng thành công" : `Đơn hàng ${order.number}`}</h1>
            <p className={styles.muted}>{order.number} · {date(order.createdAt)}</p>
          </div>
          <span className={styles.badge}>{label(order.status)}</span>
        </header>
        {message && <p role="status" className={styles.error}>{message} <button type="button" onClick={() => setRefresh((value) => value + 1)}>Tải lại</button></p>}

        {accessCode && <section className={styles.access} aria-labelledby="guest-access">
          <div>
            <h2 id="guest-access">Lưu thông tin tra cứu</h2>
            <p>Dùng hai mã này để mở đơn trên thiết bị khác. Hãy giữ mã tra cứu riêng tư.</p>
            <dl><div><dt>Mã đơn hàng</dt><dd>{order.number}</dd></div><div><dt>Mã tra cứu</dt><dd>{accessCode}</dd></div></dl>
          </div>
          <div className={styles.accessActions}>
            {confirmation && <Link className="gh-btn gh-btn--brown gh-btn--fold" href={guestOrderPath(order.number)} replace>Theo dõi đơn hàng</Link>}
            <Button variant="secondary" onClick={() => void copyLookupDetails()}>Sao chép thông tin tra cứu</Button>
            <span role="status">{copied}</span>
          </div>
        </section>}

        <div className={styles.grid}>
          <section className={styles.card} aria-labelledby="guest-items">
            <h2 id="guest-items">Sản phẩm đã đặt</h2>
            <ul className={styles.items}>{order.items.map((item) => (
              <li key={item.productId}>
                <ProductImage src={item.image} alt="" width={64} height={64} />
                <div><strong>{item.name}</strong><small>Số lượng {item.quantity}</small></div>
                <strong>{money(item.netTotal ?? item.price * item.quantity)}</strong>
              </li>
            ))}</ul>
            <dl className={styles.amounts}>
              <div><dt>Tạm tính</dt><dd>{money(order.subtotal)}</dd></div>
              {order.discountAmount > 0 && <div><dt>Ưu đãi</dt><dd>−{money(order.discountAmount)}</dd></div>}
              <div><dt>Phí giao hàng</dt><dd>{money(order.shippingFee)}</dd></div>
              <div className={styles.total}><dt>Tổng tiền</dt><dd>{money(order.total)}</dd></div>
            </dl>
          </section>
          <div className={styles.progress}>
            <section className={styles.card} aria-labelledby="guest-payment">
              <h2 id="guest-payment">Thanh toán</h2>
              {isQr ? <PaymentPanel order={paymentOrder} showQr={!openQr} /> : <>
                <p>{orderPaymentLabel(paymentOrder)}</p>
                {!codHasNoCollection(paymentOrder) && order.paymentStatus === "UNPAID" && <p>Còn phải trả <strong>{money(codAmountDue(paymentOrder))}</strong></p>}
              </>}
            </section>
            <section className={styles.card} aria-labelledby="guest-shipping">
              <h2 id="guest-shipping">Tiến trình giao hàng</h2>
              {order.trackingReference && <p>Mã vận đơn <strong>{order.trackingReference}</strong></p>}
              <ol className={styles.timeline}>{order.history
                .filter((event, index, history) => index === 0 || history[index - 1].status !== event.status)
                .map((event, index) => <li key={`${event.at}-${index}`}><strong>{label(event.status)}</strong><time dateTime={event.at}>{date(event.at)}</time></li>)}</ol>
            </section>
          </div>
        </div>

        <GuestSupport key={order.number} number={order.number} />
        <p className={styles.muted}>Xem <Link href="/shipping-payment-policy">chính sách đặt hàng và giao hàng</Link> hoặc <Link href="/return-policy">hướng dẫn đổi trả</Link>.</p>
        <Link className={styles.recent} href="/products">Tiếp tục mua sắm →</Link>
        {openQr && <VietQrDialog order={paymentOrder} open onClose={closeQr} orderDetails={guestOrderPath(order.number)} />}
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { money, shippingPauseMessage, type Row } from "@/lib/store";
import type { CartSummary } from "@/lib/discounts";
import { CartPricing } from "./pricing/price-display";
import { DiscountPriceRow } from "./discounts/offer-display";
import { AddressFields } from "./account-settings";
import { ProductImage } from "./product/product-image";
import styles from "./checkout-view.module.css";

type CheckoutViewProps = {
  reorderSource?: Row; cartHref?: string;
  summary: CartSummary | null; user?: Row; addresses: Row[]; selectedAddress?: Row;
  mergeNotice?: React.ReactNode;
  quoteChanged: boolean;
  fetching: boolean; error: string; busy: boolean; disabled: boolean; blocked: boolean; addingAddress: boolean;
  previousTotal: number | null;
  onAcceptPrices: () => void;
  onAcceptTotal: () => void;
  onRefresh: () => void; onToggleAddress: () => void; onSelectAddress: (id: string) => void;
  onSaveAddress: (event: FormEvent<HTMLFormElement>) => void; onCheckout: (event: FormEvent<HTMLFormElement>) => void;
};
function Icon({ name }: { name: string }) { return <span className={`material-symbols-outlined ${styles.icon}`} aria-hidden="true">{name}</span>; }

export function CheckoutView({ summary, reorderSource, cartHref = "/cart", user, addresses, selectedAddress, mergeNotice, quoteChanged, fetching, error, busy, disabled, blocked, addingAddress, previousTotal, onRefresh, onAcceptPrices, onAcceptTotal, onToggleAddress, onSelectAddress, onSaveAddress, onCheckout }: CheckoutViewProps) {
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "VIETQR">("COD");
  const rows = summary?.items ?? [];
  const pricesChanged = rows.some((line) => line.priceChanged);
  const unavailable = rows.some((line) => !line.available || Number(line.quantity) > Number(line.stock));
  const threshold = Number(summary?.shipping.freeShippingThreshold ?? 0);
  return <main className={styles.page}>
    <div className={styles.breadcrumbBand}><div className={styles.breadcrumb}>
      <nav aria-label="Các bước đặt hàng"><Link href={cartHref}><Icon name="shopping_bag" />Giỏ hàng</Link><span aria-hidden="true">›</span><strong><Icon name="local_shipping" />Thanh toán đơn hàng</strong></nav>
      <span className={styles.motto}>● &nbsp; Gói trọn hương vị Cố Đô</span>
    </div></div>
    <div className={styles.container}>
      {mergeNotice}
      {reorderSource && <div className={styles.guestNotice} role="status"><div><strong>Mua lại từ đơn #{String(reorderSource.number)}</strong>
        <p>Thông tin người nhận từ đơn trước đã được điền sẵn. Hãy kiểm tra hoặc chọn địa chỉ khác; thay đổi ở đây không cập nhật hồ sơ của bạn.</p></div></div>}
      {fetching && <p role="status">Đang tải giỏ hàng…</p>}
      {error && <div className={styles.warning} role="alert">{error} <button type="button" onClick={onRefresh} disabled={disabled}>Thử lại</button></div>}
      {!fetching && summary && !rows.length && <section className={styles.empty}><h1>Giỏ hàng đang trống</h1><p>Hãy chọn thức quà trước khi đặt hàng.</p><Link href="/products">Khám phá bộ sưu tập →</Link></section>}
      {summary && rows.length > 0 && <div className={styles.grid}>
        <section className={styles.details}>
          <header className={styles.intro}><span className={styles.kicker}>Tiến trình xác nhận quà</span><h1>Địa chỉ gửi gắm &amp; Thông tin người nhận</h1><p>Vui lòng kiểm tra thông tin nhận hàng để Gói Huế chuẩn bị đơn chu đáo.</p></header>
          {unavailable && <p className={styles.warning} role="alert">Số lượng hoặc tình trạng hàng đã thay đổi. <Link href={cartHref}>Về giỏ hàng để điều chỉnh.</Link></p>}
          {!summary.shipping.enabled && <p className={styles.warning} role="status">{shippingPauseMessage(summary.shipping)}</p>}
          {user ? <section className={styles.card}>
            <div className={styles.cardHeading}><span className={styles.number}>1</span><h2>Địa chỉ giao nhận đặc sản</h2><button type="button" className={styles.textButton} disabled={busy} onClick={onToggleAddress}>{addingAddress ? "Đóng" : "+ Thêm địa chỉ"}</button></div>
            {addresses.length > 0 && <fieldset className={styles.addressChoices}><legend>Chọn nơi nhận hàng</legend>
              {addresses.map(address => <label key={address.id} className={styles.addressOption}><input type="radio" name="addressChoice" checked={selectedAddress?.id === address.id} onChange={() => onSelectAddress(address.id)} /><span><strong>{String(address.label)} · {String(address.recipient)}</strong><small>{String(address.phone)} · {String(address.address)}</small></span></label>)}
              <label className={styles.addressOption}><input type="radio" name="addressChoice" checked={!selectedAddress} onChange={() => onSelectAddress("")} /><span>Nhập địa chỉ cho đơn này</span></label>
            </fieldset>}
            {addingAddress && <form className={styles.addressForm} onSubmit={onSaveAddress}><h3>Thêm địa chỉ mới</h3><AddressFields /><button type="submit" className={styles.secondary} disabled={busy}>Lưu và chọn địa chỉ</button></form>}
            {!addresses.length && !addingAddress && <p className={styles.hint}>Nhập thông tin người nhận bên dưới, hoặc thêm địa chỉ để sử dụng cho những lần sau.</p>}
          </section> : <div className={styles.guestNotice}>
            <div><strong>Mua không cần tài khoản</strong><p>Sau khi đặt, hãy lưu mã đơn và mã tra cứu để theo dõi đơn trên thiết bị khác.</p></div>
            <Link href="/login?returnUrl=%2Fcheckout">Đăng nhập để dùng địa chỉ đã lưu</Link>
          </div>}
          {!addingAddress && <form id="goihue-checkout" className={styles.checkoutForm} onSubmit={onCheckout}>
            {!selectedAddress && <section className={styles.card}><div className={styles.cardHeading}><span className={styles.number}>{user ? "2" : "1"}</span><h2>Thông tin người nhận</h2><span className={styles.required}>* Bắt buộc nhập</span></div>
              <div className={styles.fields}>
                <label>Họ và tên người nhận <span>*</span><input name="recipient" autoComplete="name" defaultValue={String(reorderSource?.recipient ?? user?.name ?? "")} required maxLength={100} /></label>
                <label>Số điện thoại nhận hàng <span>*</span><input name="phone" type="tel" autoComplete="tel" defaultValue={String(reorderSource?.phone ?? user?.phone ?? "")} required minLength={8} maxLength={30} /></label>
                <label>Địa chỉ giao hàng <span>*</span><textarea name="address" autoComplete="street-address" defaultValue={String(reorderSource?.address ?? user?.address ?? "")} required maxLength={400} rows={3} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" /></label>
              </div>
            </section>}
            <fieldset className={styles.card}><legend className={styles.visuallyHidden}>Phương thức thanh toán</legend><div className={styles.cardHeading}><span className={styles.number}>{!user || selectedAddress ? "2" : "3"}</span><h2>Phương thức thanh toán</h2></div>
              <div className={styles.payments}>
                <label className={styles.payment}><input type="radio" name="paymentMethod" value="COD" checked={paymentMethod === "COD"} onChange={() => setPaymentMethod("COD")} /><span><strong>Tiền mặt khi nhận hàng (COD)</strong><small>Thanh toán cho người giao khi nhận đơn.</small></span><Icon name="payments" /></label>
                <label className={styles.payment}><input type="radio" name="paymentMethod" value="VIETQR" checked={paymentMethod === "VIETQR"} onChange={() => setPaymentMethod("VIETQR")} /><span><strong>VietQR (xem trước)</strong><small>Xem mã sau khi đặt. Không chuyển tiền vào mã này.</small></span><Icon name="qr_code_2" /></label>
              </div>
            </fieldset>
          </form>}
        </section>
        <aside className={styles.summary}>
          <header className={styles.summaryHeading}><div><span className={styles.kicker}>Tóm lược kiện quà</span><h2>Đơn hàng của bạn ({rows.length} món)</h2></div><Link href={cartHref}>Sửa ✎</Link></header>
          {(pricesChanged || quoteChanged) && <div className={styles.warning}>
            <p role="status">{previousTotal !== null
              ? <>Tổng tiền đã đổi từ <del>{money(previousTotal)}</del> thành <strong>{money(summary.total)}</strong>. Vui lòng xác nhận trước khi đặt hàng.</>
              : pricesChanged ? "Đơn giá đã đổi. Kiểm tra giá cũ, giá mới và tổng tiền trước khi đặt."
              : "Ưu đãi hoặc phí giao đã thay đổi. Vui lòng kiểm tra và xác nhận lại."}</p>
            <button type="button" className={styles.secondary} disabled={disabled || unavailable}
              onClick={pricesChanged ? onAcceptPrices : onAcceptTotal}>
              {quoteChanged ? "Xác nhận tổng mới" : "Xác nhận giá mới"}
            </button>
          </div>}
          <div className={styles.items}>{rows.map(item => <article className={styles.item} key={item.id}>
            <ProductImage src={String(item.image ?? "")} alt={String(item.name)} width={64} height={64} className={styles.itemImage} />
            <div className={styles.itemInfo}><strong>{String(item.name)}</strong><small>Số lượng: {String(item.quantity)}</small>
              <CartPricing line={item} />
              {!item.available ? <span className={styles.itemWarning}>Sản phẩm không còn bán.</span> : Number(item.quantity) > Number(item.stock) && <span className={styles.itemWarning}>Chỉ còn {String(item.stock)} sản phẩm.</span>}
            </div>
            <div className={styles.itemPrice}><strong>{money(Number(item.currentPrice ?? item.price) * Number(item.quantity))}</strong><small>{money(item.currentPrice ?? item.price)} / sản phẩm</small></div>
          </article>)}</div>
          <dl className={styles.prices}><div><dt>Tạm tính ({rows.length} món)</dt><dd>{money(summary.subtotal)}</dd></div><DiscountPriceRow summary={summary} /><div><dt>Phí vận chuyển</dt><dd>{money(summary.shippingFee)}</dd></div></dl>
          {threshold > 0 && <p className={styles.shipping}>{summary.netSubtotal >= threshold ? "Đơn hàng đủ điều kiện miễn phí giao hàng." : `Còn ${money(threshold - summary.netSubtotal)} nữa để được miễn phí giao hàng.`}</p>}
          <div className={styles.total}>
            <div>
              <strong>{paymentMethod === "COD" ? "Trả khi nhận hàng" : "Tổng thanh toán"}</strong>
              <small>{paymentMethod === "COD" ? "Tiền mặt · Đã gồm phí giao hàng" : "Giá và phí được kiểm tra khi đặt hàng"}</small>
            </div>
            <strong aria-live="polite">{money(summary.total)}</strong>
          </div>
          <button type="submit" form="goihue-checkout" className={styles.primary} disabled={disabled || blocked || !summary.shipping.enabled || addingAddress}><Icon name={paymentMethod === "VIETQR" ? "qr_code_2" : "verified"} />{paymentMethod === "VIETQR" ? "Đặt hàng & mở VietQR" : "Xác nhận đặt hàng"}</button>
          <p className={styles.policy}>
            Chính sách mở trong thẻ mới:{" "}
            <Link href="/shipping-payment-policy" target="_blank" rel="noopener">Đặt hàng, thanh toán và giao hàng</Link>
            {" · "}<Link href="/return-policy" target="_blank" rel="noopener">Đổi trả và hoàn tiền</Link>
            {" · "}<Link href="/privacy-policy" target="_blank" rel="noopener">Quyền riêng tư</Link>.
          </p>
          <button type="button" className={styles.refresh} disabled={disabled} onClick={onRefresh}><Icon name="refresh" /> Tải lại giỏ &amp; phí giao</button>
        </aside>
      </div>}
    </div>
  </main>;
}

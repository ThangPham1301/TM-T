"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { money, shippingPauseMessage, type Row } from "@/lib/store";
import { AddressFields } from "./account-settings";
import { ProductImage } from "./product/product-image";
import styles from "./checkout-view.module.css";

type CheckoutSummary = { items: Row[]; subtotal: number; shippingFee: number; total: number; shipping: Row };
type CheckoutViewProps = {
  summary: CheckoutSummary | null; user: Row; addresses: Row[]; selectedAddress?: Row;
  fetching: boolean; error: string; busy: boolean; disabled: boolean; blocked: boolean; addingAddress: boolean;
  onRefresh: () => void; onToggleAddress: () => void; onSelectAddress: (id: string) => void;
  onSaveAddress: (event: FormEvent<HTMLFormElement>) => void; onCheckout: (event: FormEvent<HTMLFormElement>) => void;
};
function Icon({ name }: { name: string }) { return <span className={`material-symbols-outlined ${styles.icon}`} aria-hidden="true">{name}</span>; }

export function CheckoutView({ summary, user, addresses, selectedAddress, fetching, error, busy, disabled, blocked, addingAddress, onRefresh, onToggleAddress, onSelectAddress, onSaveAddress, onCheckout }: CheckoutViewProps) {
  const rows = summary?.items ?? [];
  const threshold = Number(summary?.shipping.freeShippingThreshold ?? 0);
  return <main className={styles.page}>
    <div className={styles.breadcrumbBand}><div className={styles.breadcrumb}>
      <nav aria-label="Các bước đặt hàng"><Link href="/cart"><Icon name="shopping_bag" />Giỏ hàng</Link><span aria-hidden="true">›</span><strong><Icon name="local_shipping" />Thanh toán đơn hàng</strong></nav>
      <span className={styles.motto}>● &nbsp; Gói trọn hương vị Cố Đô</span>
    </div></div>
    <div className={styles.container}>
      {fetching && <p role="status">Đang tải giỏ hàng…</p>}
      {error && <div className={styles.warning} role="alert">{error} <button type="button" onClick={onRefresh} disabled={disabled}>Thử lại</button></div>}
      {!fetching && summary && !rows.length && <section className={styles.empty}><h1>Giỏ hàng đang trống</h1><p>Hãy chọn thức quà trước khi đặt hàng.</p><Link href="/products">Khám phá bộ sưu tập →</Link></section>}
      {summary && rows.length > 0 && <div className={styles.grid}>
        <section className={styles.details}>
          <header className={styles.intro}><span className={styles.kicker}>Tiến trình xác nhận quà</span><h1>Địa chỉ gửi gắm &amp; Thông tin người nhận</h1><p>Vui lòng kiểm tra thông tin nhận hàng để Gói Huế chuẩn bị đơn chu đáo.</p></header>
          {blocked && <p className={styles.warning} role="alert">Giỏ có thông tin thay đổi; vui lòng <Link href="/cart">quay lại giỏ hàng</Link> để xử lý trước khi đặt.</p>}
          {!summary.shipping.enabled && <p className={styles.warning} role="status">{shippingPauseMessage(summary.shipping)}</p>}
          <section className={styles.card}>
            <div className={styles.cardHeading}><span className={styles.number}>1</span><h2>Địa chỉ giao nhận đặc sản</h2><button type="button" className={styles.textButton} disabled={busy} onClick={onToggleAddress}>{addingAddress ? "Đóng" : "+ Thêm địa chỉ"}</button></div>
            {addresses.length > 0 && <fieldset className={styles.addressChoices}><legend>Chọn nơi nhận hàng</legend>
              {addresses.map(address => <label key={address.id} className={styles.addressOption}><input type="radio" name="addressChoice" checked={selectedAddress?.id === address.id} onChange={() => onSelectAddress(address.id)} /><span><strong>{String(address.label)} · {String(address.recipient)}</strong><small>{String(address.phone)} · {String(address.address)}</small></span></label>)}
              <label className={styles.addressOption}><input type="radio" name="addressChoice" checked={!selectedAddress} onChange={() => onSelectAddress("")} /><span>Nhập địa chỉ cho đơn này</span></label>
            </fieldset>}
            {addingAddress && <form className={styles.addressForm} onSubmit={onSaveAddress}><h3>Thêm địa chỉ mới</h3><AddressFields /><button type="submit" className={styles.secondary} disabled={busy}>Lưu và chọn địa chỉ</button></form>}
            {!addresses.length && !addingAddress && <p className={styles.hint}>Nhập thông tin người nhận bên dưới, hoặc thêm địa chỉ để sử dụng cho những lần sau.</p>}
          </section>
          {!addingAddress && <form id="goihue-checkout" className={styles.checkoutForm} onSubmit={onCheckout}>
            {!selectedAddress && <section className={styles.card}><div className={styles.cardHeading}><span className={styles.number}>2</span><h2>Thông tin người nhận</h2><span className={styles.required}>* Bắt buộc nhập</span></div>
              <div className={styles.fields}>
                <label>Họ và tên người nhận <span>*</span><input name="recipient" autoComplete="name" defaultValue={String(user.name)} required maxLength={100} /></label>
                <label>Số điện thoại nhận hàng <span>*</span><input name="phone" type="tel" autoComplete="tel" defaultValue={String(user.phone ?? "")} required minLength={8} maxLength={30} /></label>
                <label>Địa chỉ giao hàng <span>*</span><textarea name="address" autoComplete="street-address" defaultValue={String(user.address ?? "")} required maxLength={400} rows={3} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" /></label>
              </div>
            </section>}
            <fieldset className={styles.card}><legend className={styles.visuallyHidden}>Phương thức thanh toán</legend><div className={styles.cardHeading}><span className={styles.number}>{selectedAddress ? "2" : "3"}</span><h2>Phương thức thanh toán</h2></div>
              <div className={styles.payments}>
                <label className={styles.payment}><input type="radio" name="paymentMethod" value="COD" defaultChecked /><span><strong>Thanh toán khi nhận hàng (COD)</strong><small>Trả tiền mặt khi đơn được giao.</small></span><Icon name="payments" /></label>
                <label className={styles.payment}><input type="radio" name="paymentMethod" value="VIETQR" /><span><strong>VietQR (demo)</strong><small>Chỉ phục vụ thử nghiệm; không chuyển tiền thật. Thông báo thanh toán demo cần được cấu hình riêng.</small></span><Icon name="qr_code_2" /></label>
              </div>
              <div className={styles.paymentInfo}><Icon name="info" /><span>Vui lòng kiểm tra thông tin nhận hàng và phương thức thanh toán trước khi xác nhận.</span></div>
            </fieldset>
          </form>}
        </section>
        <aside className={styles.summary}>
          <header className={styles.summaryHeading}><div><span className={styles.kicker}>Tóm lược kiện quà</span><h2>Đơn hàng của bạn ({rows.length} món)</h2></div><Link href="/cart">Sửa ✎</Link></header>
          <div className={styles.items}>{rows.map(item => <article className={styles.item} key={item.id}>
            <ProductImage src={String(item.image ?? "")} alt={String(item.name)} width={64} height={64} className={styles.itemImage} />
            <div className={styles.itemInfo}><strong>{String(item.name)}</strong><small>Số lượng: {String(item.quantity)}</small>
              {Boolean(item.priceChanged) && <span className={styles.itemWarning}>Giá mới: {money(item.currentPrice)}. Cập nhật trong giỏ.</span>}
              {!item.available ? <span className={styles.itemWarning}>Sản phẩm không còn bán.</span> : Number(item.quantity) > Number(item.stock) && <span className={styles.itemWarning}>Chỉ còn {String(item.stock)} sản phẩm.</span>}
            </div>
            <div className={styles.itemPrice}><strong>{money(Number(item.price) * Number(item.quantity))}</strong><small>{money(item.price)} / sản phẩm</small></div>
          </article>)}</div>
          <dl className={styles.prices}><div><dt>Tạm tính ({rows.length} món)</dt><dd>{money(summary.subtotal)}</dd></div><div><dt>Phí vận chuyển</dt><dd>{money(summary.shippingFee)}</dd></div></dl>
          {threshold > 0 && <p className={styles.shipping}>{summary.subtotal >= threshold ? "Đơn hàng đủ điều kiện miễn phí giao hàng." : `Còn ${money(threshold - summary.subtotal)} nữa để được miễn phí giao hàng.`}</p>}
          <div className={styles.total}><div><strong>Tổng thanh toán</strong><small>Giá và phí được kiểm tra khi đặt hàng</small></div><strong>{money(summary.total)}</strong></div>
          <button type="submit" form="goihue-checkout" className={styles.primary} disabled={disabled || blocked || !summary.shipping.enabled || addingAddress}><Icon name="verified" /> Xác nhận đặt hàng</button>
          <p className={styles.policy}>Xem <Link href="/privacy-policy">Chính sách bảo mật</Link> và <Link href="/return-policy">Chính sách đổi trả</Link> trước khi đặt hàng.</p>
          <div className={styles.assurances}><span><Icon name="local_shipping" /> Giao hàng theo thông tin đã chọn</span><Link href="/return-policy">Chính sách đổi trả</Link></div>
          <button type="button" className={styles.refresh} disabled={disabled} onClick={onRefresh}><Icon name="refresh" /> Tải lại giỏ &amp; phí giao</button>
        </aside>
      </div>}
    </div>
  </main>;
}

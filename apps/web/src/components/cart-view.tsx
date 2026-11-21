"use client";

import Link from "next/link";
import { useState } from "react";
import { money, shippingPauseMessage } from "@/lib/store";
import { CartPricing } from "./pricing/price-display";
import type { CartSummary } from "@/lib/discounts";
import { CartOfferHint, DiscountPriceRow } from "./discounts/offer-display";
import { Button, Dialog } from "@/shared/ui";
import { ProductImage } from "./product/product-image";
import styles from "./cart-view.module.css";

type CartViewProps = {
  recommendations?: React.ReactNode;
  mergeNotice?: React.ReactNode;
  guest: boolean;
  summary: CartSummary | null;
  fetching: boolean;
  error: string;
  disabled: boolean;
  blocked: boolean;
  refresh: () => void;
  update: (action: string, data?: Record<string, unknown>) => void;
  checkout: () => void;
};
function Icon({ name }: { name: string }) {
  return <span className={`material-symbols-outlined ${styles.icon}`} aria-hidden="true">{name}</span>;
}
export function CartView({ summary, fetching, error, disabled, blocked, refresh, update, checkout, recommendations, mergeNotice, guest }: CartViewProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const rows = summary?.items ?? [];
  const threshold = Number(summary?.shipping.freeShippingThreshold ?? 0);
  const canCheckout = Boolean(summary && rows.length && !disabled && !blocked && summary.shipping.enabled);
  return <main className={styles.page}>
    <div className={styles.breadcrumbBand}><div className={styles.breadcrumbInner}>
      <nav aria-label="Đường dẫn"><Link href="/"><Icon name="home" /> Trang chủ</Link><span aria-hidden="true">/</span><strong>Giỏ hàng của bạn</strong></nav>
      <span className={styles.motto}>● &nbsp; Ngự phẩm đất Cố Đô · Gói trọn yêu thương</span>
    </div></div>
    <section className={styles.container}>
      <header className={styles.heading}><div><span className={styles.kicker}>Gói trọn ân tình</span><h1>Giỏ Hàng Cố Đô</h1></div>
        {summary && <span className={styles.count}><Icon name="inventory_2" /> Hiện có <strong>{rows.length} thức quà</strong> trong giỏ</span>}
      </header>
      {mergeNotice}
      {fetching && <p role="status" aria-live="polite">Đang tải giỏ hàng…</p>}
      {error && <div className={styles.error} role="alert">{error} <button type="button" onClick={refresh} disabled={disabled}>Thử lại</button></div>}
      {!fetching && summary && rows.length === 0 && <section className={styles.empty}><Icon name="shopping_bag" /><h2>Giỏ hàng đang trống</h2><p>Hãy chọn một thức quà mang hương vị Huế.</p><Link href="/products" className={styles.primary}>Khám phá bộ sưu tập →</Link></section>}
      {summary && rows.length > 0 && <div className={styles.grid}>
        <div className={styles.cartColumn}>
          <div className={styles.tableHeader} aria-hidden="true"><span>Sản phẩm &amp; Quy cách</span><span>Đơn giá</span><span>Số lượng</span><span>Thành tiền</span></div>
          <div className={styles.lines}>{rows.map(line => {
            const quantity = Number(line.quantity);
            const stock = Number(line.stock);
            return <article className={styles.line} key={line.id}>
              <div className={styles.product}>
                <div className={styles.image}><ProductImage src={String(line.image ?? "")} alt={String(line.name)} width={96} height={96} /></div>
                <div className={styles.productInfo}><span className={styles.productTag}>Thức quà Cố Đô</span>
                  <strong>{String(line.name)}</strong>
                  <CartPricing line={line} />
                  {!line.available ? <p className={styles.warning}>Sản phẩm hoặc danh mục đã ngừng bán. Hãy xóa khỏi giỏ.</p> : quantity > stock && <p className={styles.warning}>Chỉ còn {String(line.stock)} sản phẩm. Hãy giảm số lượng hoặc xóa.</p>}
                </div>
              </div>
              <div className={styles.unitPrice}><span>Đơn giá</span>{money(line.currentPrice ?? line.price)}</div>
              <div className={styles.quantity}><span className={styles.mobileLabel}>Số lượng</span><div className={styles.stepper}>
                <button type="button" aria-label={`Giảm số lượng ${line.name}`} disabled={disabled || quantity <= 1} onClick={() => update("cart-set", { productId: line.productId, quantity: quantity - 1 })}>−</button>
                <input key={line.id + String(line.quantity) + String(line.version)} aria-label={`Số lượng ${line.name}`} type="number" min={1} max={100} defaultValue={quantity} disabled={disabled} onBlur={event => { const value = Number(event.currentTarget.value); if (value !== quantity) update("cart-set", { productId: line.productId, quantity: value }); }} />
                <button type="button" aria-label={`Tăng số lượng ${line.name}`} disabled={disabled || quantity >= Math.min(100, stock)} onClick={() => update("cart-set", { productId: line.productId, quantity: quantity + 1 })}>+</button>
              </div></div>
              <div className={styles.lineTotal}><span className={styles.mobileLabel}>Thành tiền</span><strong>{money(Number(line.currentPrice ?? line.price) * quantity)}</strong>
                <button type="button" className={styles.remove} aria-label={`Xóa ${line.name} khỏi giỏ`} title="Xóa sản phẩm" disabled={disabled} onClick={() => update("cart-set", { productId: line.productId, quantity: 0 })}><Icon name="delete" /></button>
              </div>
            </article>;
          })}</div>
          {blocked && <p className={styles.warning} role="status">Giỏ có thông tin thay đổi; vui lòng xử lý các sản phẩm được đánh dấu trước khi đặt hàng.</p>}
          {!summary.shipping.enabled && <p className={styles.warning} role="status">{shippingPauseMessage(summary.shipping)}</p>}
          <div className={styles.actions}><Link href="/products">← &nbsp; Tiếp tục chọn đặc sản</Link><div>
            <button type="button" disabled={disabled} onClick={refresh}><Icon name="refresh" /> Làm mới giỏ hàng</button>
            <button type="button" disabled={disabled || !rows.some((line) => line.priceChanged)} onClick={() => update("cart-refresh")}><Icon name="sync" /> Xác nhận giá mới</button>
            <button type="button" className={styles.clear} disabled={disabled} onClick={() => setConfirmClear(true)}><Icon name="delete_sweep" /> Xóa tất cả</button>
          </div></div>
          <aside className={styles.packing}><span className={styles.packingIcon}><Icon name="verified" /></span><div><h2>Quy chuẩn đóng gói Cố Đô</h2><p>Đặc sản được chuẩn bị cẩn thận để gửi đến bạn và người thân.</p></div></aside>
        </div>
        <aside className={styles.summary}><header><h2>Tóm tắt đơn hàng</h2><Icon name="receipt_long" /></header>
          <dl><div><dt>Tạm tính ({rows.length} món)</dt><dd>{money(summary.subtotal)}</dd></div><DiscountPriceRow summary={summary} /><div><dt>Phí vận chuyển ước tính</dt><dd>{money(summary.shippingFee)}</dd></div></dl>
          <CartOfferHint hint={summary.offerHint} />
          {threshold > 0 && <div className={styles.shipping}>{summary.netSubtotal >= threshold ? "Đơn hàng đủ điều kiện miễn phí giao hàng." : `Còn ${money(threshold - summary.netSubtotal)} nữa để được miễn phí giao hàng.`}</div>}
          <div className={styles.divider} aria-hidden="true"><span>✥</span></div>
          <div className={styles.total}><strong>Tổng cộng</strong><strong>{money(summary.total)}</strong></div>
          <p className={styles.summaryNote}>Giá, ưu đãi và phí giao hàng được kiểm tra lại khi xác nhận.</p>
          <button type="button" className={styles.primary} disabled={!canCheckout} onClick={checkout}>Tiến hành đặt hàng <span aria-hidden="true">→</span></button>
          <ul className={styles.benefits}><li><Icon name="payments" />Thanh toán khi nhận hàng (COD)</li><li><Icon name="package_2" />{guest ? "Theo dõi đơn hàng bằng mã tra cứu" : "Theo dõi đơn hàng trong tài khoản"}</li><li><Icon name="support_agent" />Hỗ trợ sau bán hàng</li></ul>
        </aside>
      </div>}
    </section>
    {summary && rows.length > 0 && <div className={styles.mobileBar}><div><small>Tổng thanh toán</small><strong>{money(summary.total)}</strong></div><button type="button" className={styles.primary} disabled={!canCheckout} onClick={checkout}>Tiến hành đặt hàng →</button></div>}
    {summary && recommendations}
    <Dialog open={confirmClear} title="Xóa tất cả sản phẩm?" closeLabel="Đóng" onClose={() => setConfirmClear(false)}>
      <p>Bạn có chắc muốn xóa toàn bộ {rows.length} sản phẩm khỏi giỏ hàng?</p>
      <p className={styles.dialogHint}>Bạn có thể thêm lại sản phẩm từ bộ sưu tập.</p>
      <div className={styles.dialogActions}><Button variant="secondary" onClick={() => setConfirmClear(false)}>Giữ giỏ hàng</Button><Button variant="danger" disabled={disabled} onClick={() => { setConfirmClear(false); update("cart-clear"); }}>Xóa tất cả</Button></div>
    </Dialog>
  </main>;
}

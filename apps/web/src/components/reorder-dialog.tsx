"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, money, type Row, useStore } from "@/lib/store";
import { Button, Dialog } from "@/shared/ui";
import { ProductImage } from "./product/product-image";
import styles from "./reorder-dialog.module.css";

type ReorderLine = {
  productId: string; name: string; image: string; originalQuantity: number; quantity: number;
  previousPrice: number; currentPrice: number | null; priceChanged: boolean;
  stock: number; available: boolean; code: string;
};
type Selection = { productId: string; quantity: number }[];
type Preview = {
  sourceOrderId: string; sourceOrderNumber: string;
  recipient: { recipient: string; phone: string; address: string };
  lines: ReorderLine[]; ready: boolean; issues: string[]; previewToken: string; cartToken: string; cartCount: number;
  quote: { subtotal: number; discountAmount: number; netSubtotal: number; shippingFee: number; total: number } | null;
};

export function ReorderDialog({ order, onClose }: { order: Row; onClose: () => void }) {
  const router = useRouter();
  const { busy, run, mutate } = useStore();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [reviewValid, setReviewValid] = useState(false);
  const [error, setError] = useState("");
  const [acceptedReplacement, setAcceptedReplacement] = useState(false);
  const sending = useRef(false);
  const live = useRef(true);
  const path = `orders/${encodeURIComponent(order.id)}/reorder`;

  useEffect(() => {
    live.current = true;
    let active = true;
    void api(`${path}/preview`, "POST", {}).then((data: Preview) => {
      if (!active) return;
      setPreview(data);
      setReviewValid(true);
      setQuantities(Object.fromEntries(data.lines.map(line => [line.productId, line.quantity])));
    }).catch(problem => {
      if (active) setError(problem instanceof Error ? problem.message : "Không tải được thông tin mua lại.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; live.current = false; };
  }, [path]);

  const items: Selection = Object.entries(quantities).filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({ productId, quantity }));
  const invalid = Object.values(quantities).some(quantity => !Number.isInteger(quantity) || quantity < 0 || quantity > 100);
  const dirty = Boolean(preview && preview.lines.some(line => line.quantity !== (quantities[line.productId] ?? 0)));
  const disabled = loading || busy;
  const ready = preview?.ready && reviewValid && !dirty && !invalid && (!preview.cartCount || acceptedReplacement);

  async function refresh() {
    if (invalid) { setError("Số lượng mỗi món phải là số nguyên từ 1 đến 100, hoặc bỏ chọn món đó."); return; }
    setLoading(true);
    setReviewValid(false);
    try {
      const data: Preview = await api(`${path}/preview`, "POST", preview ? { items } : {});
      if (!live.current) return;
      if (preview?.cartToken !== data.cartToken) setAcceptedReplacement(false);
      setPreview(data);
      setReviewValid(true);
      setQuantities(Object.fromEntries(data.lines.map(line => [line.productId, line.quantity])));
      setError("");
    } catch (problem) {
      if (live.current) setError(problem instanceof Error ? problem.message : "Không cập nhật được báo giá.");
    } finally { if (live.current) setLoading(false); }
  }

  function confirm() {
    if (!preview || !ready || sending.current) return;
    sending.current = true;
    void run(async () => {
      try {
        const result = await mutate(path, "reorder", { items, previewToken: preview.previewToken, cartToken: preview.cartToken }, "reorder");
        router.push(`/checkout?reorder=${encodeURIComponent(String(result.sourceOrderId))}`);
      } catch (problem) {
        if (problem instanceof ApiError && problem.status === 409) {
          await refresh();
          setError("Thông tin đơn, giá hoặc giỏ hàng vừa thay đổi. Hãy kiểm tra báo giá mới rồi xác nhận lại.");
        } else {
          setReviewValid(false);
          setError(problem instanceof Error ? problem.message : "Chưa thể chuẩn bị đơn mua lại.");
        }
      } finally { sending.current = false; }
    });
  }

  return <Dialog open title={`Mua lại từ đơn #${String(order.number)}`} className={styles.dialog}
    onClose={() => { if (!sending.current) onClose(); }}>
    <p className={styles.intro}>Kiểm tra số lượng, người nhận và giá hiện tại. Đơn mới chỉ được tạo khi bạn xác nhận tại bước thanh toán.</p>
    {loading && <p role="status">Đang kiểm tra giá và tình trạng hàng…</p>}
    {error && <div className={styles.warning} role="alert">{error}</div>}
    {preview && <>
      <div className={styles.lines}>{preview.lines.map(line => {
        const quantity = quantities[line.productId] ?? 0;
        return <div className={styles.line} key={line.productId}>
          <label className={styles.choice}><input type="checkbox" aria-label={`Chọn ${line.name}`} checked={quantity !== 0}
            disabled={disabled} onChange={event => setQuantities(current => ({ ...current, [line.productId]: event.target.checked ? line.originalQuantity : 0 }))} />
            <ProductImage src={line.image} alt={line.name} width={56} height={56} />
          </label>
          <div className={styles.info}><strong>{line.name}</strong>
            <span>{line.currentPrice === null ? "Không còn bán" : `${money(line.currentPrice)} / sản phẩm`}</span>
            {line.priceChanged && <small>Đơn giá ở đơn cũ: {money(line.previousPrice)} (trước giảm giá).</small>}
            {line.code !== "AVAILABLE" && <p className={styles.lineIssue}>{line.code === "UNAVAILABLE" ? "Sản phẩm đã ngừng bán. Hãy bỏ chọn để tiếp tục."
              : line.stock === 0 ? "Sản phẩm hiện hết hàng. Hãy bỏ chọn hoặc mua vào dịp khác."
              : `Chỉ còn ${line.stock} sản phẩm. Bạn có thể chỉnh số lượng hoặc bỏ chọn.`}</p>}
          </div>
          <label className={styles.quantity}>Số lượng<input aria-label={`Số lượng mua lại ${line.name}`} type="number" min={1} max={100} step={1}
            disabled={disabled || quantity === 0} value={quantity || ""} onChange={event => {
              const value = event.target.value === "" ? NaN : Number(event.target.value);
              setQuantities(current => ({ ...current, [line.productId]: value }));
            }} /></label>
        </div>;
      })}</div>
      <div className={styles.recipient}><strong>Người nhận từ đơn trước</strong>
        <p>{preview.recipient.recipient || "Chưa có tên người nhận"} · {preview.recipient.phone || "Chưa có số điện thoại"}</p>
        <p>{preview.recipient.address || "Chưa có địa chỉ"}</p><small>Bạn có thể chỉnh hoặc chọn địa chỉ khác khi thanh toán.</small>
      </div>
      {dirty || invalid ? <p className={styles.warning}>Bạn vừa thay đổi lựa chọn. Bấm “Cập nhật báo giá” để kiểm tra lại trước khi tiếp tục.</p>
        : preview.issues.length > 0 && <ul className={styles.warning}>{preview.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
      {preview.quote && !dirty && !invalid && <dl className={styles.quote}>
        <div><dt>Tiền hàng</dt><dd>{money(preview.quote.subtotal)}</dd></div>
        {preview.quote.discountAmount > 0 && <div><dt>Ưu đãi hiện tại</dt><dd>−{money(preview.quote.discountAmount)}</dd></div>}
        <div><dt>Phí giao hàng</dt><dd>{money(preview.quote.shippingFee)}</dd></div>
        <div><dt>Tổng dự kiến</dt><dd>{money(preview.quote.total)}</dd></div>
      </dl>}
      {preview.cartCount > 0 && <label className={styles.replace}><input type="checkbox" disabled={disabled} checked={acceptedReplacement}
        onChange={event => setAcceptedReplacement(event.target.checked)} /><span>Tôi đồng ý thay {preview.cartCount} dòng sản phẩm đang có trong giỏ bằng lựa chọn mua lại này.</span></label>}
    </>}
    <div className={styles.actions}>
      <Button variant="secondary" disabled={disabled} onClick={() => void refresh()}>{preview ? "Cập nhật báo giá" : "Thử lại"}</Button>
      <Button disabled={disabled || !ready} onClick={confirm}>Tiếp tục thanh toán</Button>
    </div>
    <p className={styles.footnote}>Giá, ưu đãi và tồn kho được kiểm tra lại khi đặt hàng. Phương thức và trạng thái thanh toán của đơn cũ không được sao chép.</p>
  </Dialog>;
}

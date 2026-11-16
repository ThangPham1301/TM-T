"use client";

import { useRef, useState } from "react";
import { type Row } from "@/lib/store";
import { ProductImage } from "./product/product-image";

const reasons = [
  ["DAMAGED", "Bao bì móp méo, rách niêm phong hoặc hư hỏng khi giao"],
  ["UNSAFE", "Thực phẩm có dấu hiệu ẩm mốc hoặc biến chất"],
  ["WRONG_ITEM", "Giao sai sản phẩm"],
  ["MISSING_ITEM", "Thiếu sản phẩm hoặc quà tặng kèm"],
  ["QUALITY", "Hạn sử dụng hoặc chất lượng không đạt cam kết"],
  ["NOT_RECEIVED", "Chưa nhận được sản phẩm"],
  ["CHANGE_OF_MIND", "Lý do thỏa thuận khác"],
] as const;

type DraftLine = {
  lineId: string;
  quantity: number;
  reason: string;
  description: string;
  resolution: string;
};

export function getReturnableProducts(order: Row, returns: Row[]) {
  return ((order.items as Row[] | undefined) ?? []).map((item) => {
    const claims = returns.filter((row) =>
      row.orderId === order.id && row.lineId === item.productId &&
      !["REJECTED", "WITHDRAWN"].includes(String(row.status)),
    );
    const reserved = claims.reduce((sum, row) => sum + Number(row.approvedQuantity ?? row.quantity), 0);
    return {
      item,
      remaining: Math.max(0, Number(item.quantity) - reserved),
      pending: claims.some((row) => row.status !== "RESOLVED"),
    };
  });
}

export function ReturnRequestForm({
  order,
  returns,
  busy,
  onSubmit,
  onReset,
}: {
  order: Row;
  returns: Row[];
  busy: boolean;
  onReset: () => void;
  onSubmit: (items: DraftLine[], photos: File[]) => void;
}) {
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const late = Date.now() - Date.parse(String(order.deliveredAt)) > 7 * 86400000;
  const availableReasons = late ? reasons.filter(([code]) => code === "UNSAFE" || code === "QUALITY") : reasons;
  const products = getReturnableProducts(order, returns);
  const hasAvailableProducts = products.some(({ remaining }) => remaining > 0);

  function update(lineId: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => line.lineId === lineId ? { ...line, ...patch } : line));
  }

  function selectPhotos(files: File[]) {
    const invalid = files.length > 5 || files.some((file) => !["image/png", "image/jpeg"].includes(file.type) || file.size > 5 * 1024 * 1024);
    setFileError(invalid ? "Chọn tối đa 5 ảnh PNG hoặc JPEG, mỗi ảnh tối đa 5 MB." : "");
    setPhotos(invalid ? [] : files);
  }

  return (
    <form className="store-form b07-return-form" onSubmit={(event) => {
      event.preventDefault();
      if (!lines.length || busy || fileError) return;
      if (window.confirm(`Gửi yêu cầu đổi trả cho ${lines.length} dòng hàng?`)) onSubmit(lines, photos);
    }}>
      <fieldset className="b07-products">
        <legend>2. Chọn sản phẩm yêu cầu hỗ trợ</legend>
        {products.map(({ item, remaining, pending }) => {
          const id = String(item.productId);
          const line = lines.find((entry) => entry.lineId === id);
          return (
            <div key={id} className="b07-product" data-selected={Boolean(line)}>
              <label>
                <input type="checkbox" checked={Boolean(line)} disabled={!remaining || busy} onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setLines((current) => checked
                    ? [...current, { lineId: id, quantity: 1, reason: late ? "QUALITY" : "DAMAGED", description: "", resolution: "REPLACEMENT" }]
                    : current.filter((entry) => entry.lineId !== id));
                }} />
                {typeof item.image === "string" && <ProductImage src={item.image} alt="" width={42} height={42} />}
                <span><strong>{String(item.name)}</strong><small>{remaining > 0
                  ? `Còn quyền đổi ${remaining} sản phẩm`
                  : pending
                    ? "Số lượng đã được giữ trong hồ sơ đang xử lý"
                    : "Số lượng đã được xử lý đổi trả"}</small></span>
              </label>
              {line && <input type="number" aria-label={`Số lượng ${String(item.name)}`} min={1} max={remaining} required value={line.quantity}
                onChange={(event) => update(id, { quantity: Number(event.target.value) })} />}
            </div>
          );
        })}
      </fieldset>
      {!hasAvailableProducts && (
        <p className="store-warning">
          Đơn này không còn sản phẩm có thể gửi yêu cầu mới. Xem hồ sơ đổi trả hiện có hoặc chọn một đơn đã giao khác.
        </p>
      )}
      {lines.length > 0 && (
        <>
          <fieldset className="b07-fields">
            <legend>3. Chọn lý do đổi trả</legend>
            {lines.map((line) => (
              <label key={line.lineId}>
                {products.find(({ item }) => item.productId === line.lineId)?.item.name as string}
                <select value={line.reason} onChange={(event) => {
                  const reason = event.target.value;
                  const missing = reason === "MISSING_ITEM" || reason === "NOT_RECEIVED";
                  update(line.lineId, { reason, resolution: line.resolution === "REFUND" ? "REFUND" : missing ? "MAKE_UP" : "REPLACEMENT" });
                }}>
                  {availableReasons.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                </select>
              </label>
            ))}
          </fieldset>
          <fieldset className="b07-fields">
            <legend>4. Mô tả chi tiết vấn đề</legend>
            {lines.map((line) => (
              <label key={line.lineId}>
                {products.find(({ item }) => item.productId === line.lineId)?.item.name as string}
                <textarea required maxLength={2000} value={line.description} placeholder="Mô tả tình trạng sản phẩm khi nhận…"
                  onChange={(event) => update(line.lineId, { description: event.target.value })} />
              </label>
            ))}
          </fieldset>
          <fieldset className="b07-fields">
            <legend>5. Tải ảnh chứng minh</legend>
            <label className="b07-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
              event.preventDefault();
              if (input.current) input.current.value = "";
              selectPhotos(Array.from(event.dataTransfer.files));
            }}>
              <strong>Bấm để tải ảnh hoặc kéo thả vào khung</strong>
              <small>PNG/JPEG · Tối đa 5 ảnh, 5 MB/ảnh</small>
              <input ref={input} type="file" accept="image/png,image/jpeg" multiple onChange={(event) => {
                selectPhotos(Array.from(event.target.files ?? []));
              }} />
            </label>
            {fileError && <p className="store-error" role="alert">{fileError}</p>}
            {photos.length > 0 && <small>{photos.map((photo) => photo.name).join(", ")}</small>}
          </fieldset>
          <fieldset className="b07-fields">
            <legend>6. Chọn phương án giải quyết mong muốn</legend>
            {lines.map((line) => {
              const missing = line.reason === "MISSING_ITEM" || line.reason === "NOT_RECEIVED";
              return (
                <fieldset className="returns-resolution" key={line.lineId}>
                  <legend>{products.find(({ item }) => item.productId === line.lineId)?.item.name as string}</legend>
                  <label>
                    <input type="radio" name={`resolution-${line.lineId}`} checked={line.resolution !== "REFUND"}
                      onChange={() => update(line.lineId, { resolution: missing ? "MAKE_UP" : "REPLACEMENT" })} />
                    {missing ? "Giao bù hàng thiếu" : "Đổi sản phẩm mới"}
                  </label>
                  <label>
                    <input type="radio" name={`resolution-${line.lineId}`} checked={line.resolution === "REFUND"}
                      onChange={() => update(line.lineId, { resolution: "REFUND" })} />
                    Hoàn tiền
                  </label>
                </fieldset>
              );
            })}
          </fieldset>
        </>
      )}
      <div className="b07-buttons">
        <button disabled={busy || !lines.length || Boolean(fileError)}>Gửi yêu cầu đổi trả</button>
        <button type="button" className="store-btn-secondary" disabled={busy} onClick={onReset}>Làm mới</button>
      </div>
    </form>
  );
}

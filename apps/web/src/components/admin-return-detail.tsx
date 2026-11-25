"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cleanText, date, label, money, type Row } from "@/lib/store";
import { Button, StatusBadge } from "@/shared/ui";
import { EvidencePreview } from "./operations";
import { ProductImage } from "./product/product-image";
import workbench from "./admin-workbench.module.css";
import styles from "./admin-returns.module.css";

const views = [
  ["action", "Xử lý"],
  ["details", "Thông tin và ảnh"],
  ["history", "Lịch sử"],
] as const;
const closedStatuses = new Set(["RESOLVED", "REJECTED", "WITHDRAWN"]);

export function AdminReturnDetail({ row, order, lines, action, busy, onSelect, onClose }: {
  row: Row;
  order?: Row;
  lines: Row[];
  action: ReactNode;
  busy: boolean;
  onSelect: (line: Row) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<(typeof views)[number][0]>("action");
  const status = String(row.status);
  const history = (row.history as Row[] | undefined) ?? [];
  const evidence = (row.evidenceIds as string[] | undefined) ?? [];
  const closed = closedStatuses.has(status);
  const product = (order?.items as Row[] | undefined)?.find((item) => item.productId === row.lineId);
  const facts = [
    ["Đơn giá", row.unitPrice != null ? money(row.unitPrice) : ""],
    ["Phương án", row.resolution ? label(row.resolution) : ""],
    ["Thu hồi hàng", row.goods ? label(row.goods) : ""],
    ["Thực hiện", row.fulfillment ? label(row.fulfillment) : ""],
    ["Số tiền COD còn phải thu", row.codDueAfterAmount != null ? money(row.codDueAfterAmount) : ""],
    ["Tham chiếu hoàn tiền", cleanText(row.refundReference)],
    ["Đơn đổi hàng", cleanText(row.replacementOrderNumber)],
    ["Vận đơn gửi hàng", cleanText(row.replacementTracking)],
    ["Biên bản nhận hàng", cleanText(row.intakeReference)],
    ["Mã chứng từ xử lý", cleanText(row.operationReference)],
    ["Lý do quyết định", cleanText(row.decisionReason)],
    ["Kết quả xử lý", cleanText(row.result)],
  ].filter(([, value]) => value);

  return (
    <section id="admin-return-detail" className={`${workbench.pane} ${styles.detail}`} aria-labelledby="return-detail-title">
      <header className={workbench.paneHead}>
        <div>
          <h2 id="return-detail-title">Yêu cầu #{String(row.caseId || row.id).slice(0, 8)}</h2>
          <p className={workbench.quiet}>
            {row.orderId ? <Link href={`/admin/orders?order=${encodeURIComponent(String(row.orderId))}`}>Đơn {cleanText(row.orderNumber)} ↗</Link> : cleanText(row.orderNumber)}
            {" · "}{date(row.createdAt)}
          </p>
        </div>
        <div className={workbench.row}>
          <StatusBadge tone={status === "RESOLVED" ? "success" : status === "EVIDENCE_REQUIRED" ? "warning" : "neutral"} className={workbench.badge}>{label(status)}</StatusBadge>
          <Button size="small" variant="secondary" onClick={onClose}>Đóng chi tiết</Button>
        </div>
      </header>
      <div className={styles.caseSummary}>
        {lines.length > 1 ? (
          <label className={styles.lineSelect}>Dòng hàng cần xử lý
            <select aria-label="Dòng hàng cần xử lý" value={row.id} disabled={busy} onChange={(event) => {
              const line = lines.find((item) => item.id === event.target.value);
              if (line) onSelect(line);
            }}>
              {lines.map((item) => <option key={item.id} value={item.id}>{cleanText(item.product)} · {label(item.status)}</option>)}
            </select>
          </label>
        ) : <div><span>Sản phẩm</span><strong>{cleanText(row.product) || "—"}</strong></div>}
        <div><span>Số lượng yêu cầu</span><strong>{String(row.quantity ?? "—")}</strong></div>
        <div><span>Số lượng duyệt</span><strong>{String(row.approvedQuantity ?? "—")}</strong></div>
        <div><span>Giá trị xử lý</span><strong>{row.amount != null ? money(row.amount) : "—"}</strong></div>
      </div>
      <div className={styles.viewBar}>
        <div className={workbench.switcher} role="group" aria-label="Nội dung hồ sơ">
          {views.map(([id, name]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
              {name}{id === "details" && evidence.length > 0 && ` (${evidence.length} ảnh)`}{id === "history" && history.length > 0 && ` (${history.length})`}
            </button>
          ))}
        </div>
      </div>
      <div hidden={view !== "action"}>
        <div className={`${workbench.body} ${styles.action}`}>
          {closed ? <p>Hồ sơ đã đóng. Bạn có thể mở thông tin hoặc lịch sử để xem lại.</p> : (
            <>
              {status === "EVIDENCE_REQUIRED" && <p className="store-subtle">Đang chờ khách hàng gửi bổ sung.</p>}
              {action}
            </>
          )}
        </div>
      </div>
      <div hidden={view !== "details"}>
        <div className={`${workbench.body} ${styles.reader}`} tabIndex={0} role="region" aria-label="Thông tin và bằng chứng">
          <div className={styles.product}>
            {typeof product?.image === "string" && <ProductImage src={product.image} alt="" width={56} height={56} />}
            <div><h3>{cleanText(row.product) || "Sản phẩm đổi trả"}</h3><p>{label(row.reason)}</p></div>
          </div>
          {row.description != null && <p className={styles.longText}>{cleanText(row.description)}</p>}
          {evidence.length > 0 && (
            <div>
              <h3>Ảnh bằng chứng</h3>
              <div className={styles.photos}>{evidence.map((id) => <EvidencePreview key={id} id={id} />)}</div>
            </div>
          )}
          {order?.recipient != null && (
            <details className={styles.recipient}>
              <summary>Thông tin người nhận</summary>
              <p>{cleanText(order.recipient)}{order.phone != null && ` · ${cleanText(order.phone)}`}</p>
              {order.address != null && <p>{cleanText(order.address)}</p>}
            </details>
          )}
          {facts.length > 0 && <dl className={styles.facts}>{facts.map(([key, value]) => (
            <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
          ))}</dl>}
        </div>
      </div>
      <div hidden={view !== "history"}>
        <div className={`${workbench.body} ${styles.reader}`} tabIndex={0} role="region" aria-label="Lịch sử xử lý">
          {history.length === 0 ? <p>Chưa có cập nhật cho dòng hàng này.</p> :
            <ol className="store-timeline">{history.slice().reverse().map((entry, index) => (
              <li key={index}>
                <strong>{entry.transition === "RESUME" && "Tiếp tục xử lý · "}{label(entry.status)}</strong>
                <small>{date(entry.at)}</small>
                {entry.note != null && <p className={styles.longText}>{cleanText(entry.note)}</p>}
              </li>
            ))}</ol>}
        </div>
      </div>
    </section>
  );
}

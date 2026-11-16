"use client";

import { useState } from "react";
import { date, fields, label, type Row } from "@/lib/store";
import { Pagination } from "./workspace-nav";

const pageSize = 8;

const returnFilters = [
  { id: "review", label: "Chờ duyệt", statuses: ["REQUESTED", "REVIEWING"] },
  { id: "evidence", label: "Cần bổ sung bằng chứng", statuses: ["EVIDENCE_REQUIRED"] },
  { id: "approved", label: "Đã duyệt", statuses: ["APPROVED"] },
  { id: "progress", label: "Đang hoàn hàng", statuses: ["RECEIVED", "INSPECTED", "PROCESSING", "REPLACEMENT_SENT"] },
  { id: "hold", label: "Đang chờ", statuses: ["CUSTOMER_CONFIRMATION", "WAITING_STOCK", "PAYMENT_REVIEW", "EXCEPTION"] },
  { id: "complete", label: "Đã hoàn tất", statuses: ["RESOLVED"] },
  { id: "closed", label: "Đã từ chối / đã rút", statuses: ["REJECTED", "WITHDRAWN"] },
];

function matchesReturnFilter(group: Row[], statuses: string[]) {
  return group.some((row) => statuses.includes(String(row.status)));
}

export function ReturnQueue({
  rows,
  onSelect,
  orders = [],
  admin = false,
}: {
  rows: Row[];
  onSelect: (row: Row) => void;
  orders?: Row[];
  admin?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = String(row.caseId || row.id);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  const allCases = [...groups.values()];
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const filters = returnFilters.map((filter) => ({
    ...filter,
    count: allCases.filter((group) => matchesReturnFilter(group, filter.statuses)).length,
  }));
  const currentFilter = filters.find((filter) => filter.id === status);
  const cases = allCases.filter((group) =>
    group.some((row) =>
      [row.orderNumber, row.product, row.caseId, row.id, orderById.get(String(row.orderId))?.recipient].some((value) =>
        String(value ?? "").toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")),
      ),
    ) && (!currentFilter || matchesReturnFilter(group, currentFilter.statuses)),
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(cases.length / pageSize)));
  const visibleCases = cases
    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
    .map((group) => {
      const [row] = group;
      const closed = group.every((line) => ["RESOLVED", "REJECTED", "WITHDRAWN"].includes(String(line.status)));
      const resolved = group.filter((line) => line.status === "RESOLVED");
      const partial = resolved.length > 0 && (
        resolved.length < group.length ||
        resolved.some((line) => Number(line.approvedQuantity ?? line.quantity) < Number(line.quantity))
      );
      const caseStatus = closed && partial
        ? "Hoàn tất một phần"
        : group.every((line) => line.status === row.status)
          ? label(row.status)
          : closed ? "Đã đóng hồ sơ" : "Đang xử lý";
      const quantity = group.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
      const evidence = new Set(group.flatMap((line) => (line.evidenceIds as string[] | undefined) ?? []));
      return {
        row,
        caseStatus,
        quantity,
        evidenceCount: evidence.size,
        products: group.length > 1 ? `${group.length} dòng hàng` : String(row.product),
        reasons: [...new Set(group.map((line) => label(line.reason)))].join(", "),
      };
    });


  return (
    <div className={admin ? "returns-queue-admin" : "operations-list"}>
      {admin && (
        <div className="returns-summary" aria-label="Tổng quan yêu cầu đổi trả">
          {filters.slice(0, 3).map((filter) => (
            <button type="button" key={filter.id} onClick={() => {
              setStatus(filter.id);
              setPage(1);
            }}>
              <small>{filter.label}</small>
              <strong>{filter.count}</strong>
            </button>
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <div className="returns-filters">
          <label>
            Tìm yêu cầu
            <input type="search" value={query} placeholder="Mã đơn, mã yêu cầu hoặc sản phẩm" onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }} />
          </label>
          {admin && (
            <div className="returns-filter-buttons" role="group" aria-label="Trạng thái yêu cầu">
              {[{ id: "", label: "Tất cả", count: allCases.length }, ...filters].map((filter) => (
                <button
                  type="button"
                  key={filter.id}
                  aria-pressed={status === filter.id}
                  onClick={() => {
                    setStatus(filter.id);
                    setPage(1);
                  }}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!cases.length && (
        <p className="store-empty">{rows.length ? "Không tìm thấy yêu cầu phù hợp." : "Chưa có yêu cầu đổi trả."}</p>
      )}
      {admin && visibleCases.length > 0 && (
        <div className="operations-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Mã yêu cầu / đơn gốc</th>
                <th scope="col">Người nhận</th>
                <th scope="col">Sản phẩm và lý do</th>
                <th scope="col">Bằng chứng</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visibleCases.map(({ row, products, reasons, quantity, evidenceCount, caseStatus }) => (
                <tr key={row.id}>
                  <td>
                    <strong>#{String(row.caseId || row.id).slice(0, 8)}</strong><br />
                    {String(row.orderNumber)}<br /><small>{date(row.createdAt)}</small>
                  </td>
                  <td>{String(orderById.get(String(row.orderId))?.recipient ?? "—")}</td>
                  <td>{products} · {quantity} sản phẩm<br /><small>{reasons}</small></td>
                  <td>{evidenceCount} ảnh</td>
                  <td><span className="store-status-chip">{caseStatus}</span></td>
                  <td>
                    <button
                      type="button"
                      className="store-btn-text"
                      aria-label={`Xem yêu cầu của đơn ${String(row.orderNumber)}`}
                      onClick={() => onSelect(row)}
                    >
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!admin && visibleCases.map(({ row, products, reasons, quantity, caseStatus }) => (
        <button type="button" className="store-row returns-customer-row" key={row.id} onClick={() => onSelect(row)}>
          <strong>{String(row.orderNumber)} · {products}</strong>
          <span>{reasons} · {quantity} sản phẩm</span>
          <span className="store-status-chip">{caseStatus}</span>
          <small>{date(row.createdAt)}</small>
        </button>
      ))}
      {cases.length > pageSize && <Pagination page={currentPage} total={cases.length} pageSize={pageSize} onChange={setPage} />}
    </div>
  );
}

export function PolicyEditor({
  policy,
  versions,
  busy,
  onSave,
}: {
  policy: Row;
  versions: Row[];
  busy: boolean;
  onSave: (draft: Record<string, FormDataEntryValue>) => void;
}) {
  const [version, setVersion] = useState("");
  const [content, setContent] = useState(String(policy.content ?? ""));
  return (
    <div className="store-two">
      <section className="store-card">
        <h2>Quản lý chính sách bảo mật</h2>
        <form className="store-form" onSubmit={(event) => onSave(fields(event))}>
          <label>
            Mã phiên bản
            <input name="version" placeholder="1.1-draft" required maxLength={40} value={version} onChange={(event) => setVersion(event.target.value)} />
          </label>
          <label>
            Nội dung
            <textarea name="content" rows={16} required maxLength={16000} value={content} onChange={(event) => setContent(event.target.value)} />
          </label>
          <small>{content.length}/16.000 ký tự</small>
          <button disabled={busy}>Lưu bản thảo mới</button>
        </form>
        <h3>Lịch sử phiên bản</h3>
        {versions.map((entry) => (
          <details key={entry.id}>
            <summary>{String(entry.version)} · {date(entry.createdAt)}</summary>
            <div className="store-policy">{String(entry.content)}</div>
          </details>
        ))}
      </section>
      <section className="store-card">
        <h2>Xem trước chính sách</h2>
        <p className="store-status-chip">Dự thảo{version.trim() && ` · ${version.trim()}`}</p>
        <h3>{String(policy.title)}</h3>
        <div className="store-policy">{content || "Nhập nội dung để xem trước."}</div>
      </section>
    </div>
  );
}

export function AuditLog({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const filtered = rows.filter((row) =>
    (!action || row.action === action) &&
    [row.subject, row.action, row.actorName].some((value) => String(value ?? "").toLowerCase().includes(query.trim().toLowerCase())),
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));

  return (
    <section className="store-card">
      <h2>Nhật ký hoạt động quản trị</h2>
      <div className="store-filters">
        <label>
          Tìm theo tác nhân, hành động hoặc đối tượng
          <input type="search" value={query} onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }} />
        </label>
        <label>
          Hành động
          <select value={action} onChange={(event) => {
            setAction(event.target.value);
            setPage(1);
          }}>
            <option value="">Tất cả hành động</option>
            {[...new Set(rows.map((row) => String(row.action)))].sort().map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      {filtered.length ? (
        <div className="operations-table">
          <table>
            <thead><tr><th scope="col">Thời gian</th><th scope="col">Tác nhân</th><th scope="col">Hành động</th><th scope="col">Đối tượng</th></tr></thead>
            <tbody>
              {filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row) => (
                <tr key={row.id}>
                  <td>{date(row.at)}</td>
                  <td>{String(row.actorName ?? "—")}{row.actorRole ? ` · ${String(row.actorRole)}` : ""}</td>
                  <td><span className="store-status-chip">{String(row.action)}</span></td>
                  <td>{String(row.subject || "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="store-empty">{rows.length ? "Không tìm thấy sự kiện phù hợp." : "Chưa có hoạt động."}</p>}
      {filtered.length > pageSize && <Pagination page={currentPage} total={filtered.length} pageSize={pageSize} onChange={setPage} />}
    </section>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { date, fields, label, type Row } from "@/lib/store";
import { Pagination, WorkspaceNav } from "./workspace-nav";

export function OperationsWorkspace({
  section,
  title,
  description,
  userName,
  onLogout,
  children,
}: {
  section: string;
  title: string;
  description: string;
  userName: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="admin-returns">
      <aside className="returns-admin-sidebar">
        <header>
          <Image className="operations-brand-mark" src="/images/stitch/asset-08.png" width={48} height={38} alt="" />
          <div><strong>Quản trị Gói Huế</strong><small>Quản lý cửa hàng</small></div>
        </header>
        <WorkspaceNav admin section={section} />
        <div className="returns-admin-links">
          <Link href="/">Xem cửa hàng →</Link>
          <small>{userName}</small>
          <button type="button" onClick={onLogout}>Đăng xuất</button>
        </div>
      </aside>
      <main className="returns-admin-main">
        <div className="returns-admin-topbar">
          <span>Quản trị › {title}</span>
          <Link href="/">Xem cửa hàng</Link>
        </div>
        <header className="returns-heading returns-admin-heading">
          <div><h1>{title}</h1><p>{description}</p></div>
        </header>
        {children}
      </main>
    </div>
  );
}

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
  const [viewedId, setViewedId] = useState("");
  const viewed = versions.find((entry) => entry.id === viewedId);
  return (
    <>
      <aside className="operations-notice">
        <span className="operations-notice-mark" aria-hidden="true">!</span>
        <div><h2>Chế độ bản thảo</h2><p>Phiên bản lưu trong hệ thống đang ở trạng thái dự thảo. Xem trước nội dung trước khi lưu phiên bản mới.</p></div>
      </aside>
      <div className="operations-policy-grid">
        <section className="store-card operations-history">
          <div className="store-list-heading">
            <h2>Lịch sử phiên bản chính sách</h2>
            <span className="store-status-chip">{versions.length} bản ghi</span>
          </div>
          {!versions.length && <p className="store-empty">Chưa có phiên bản đã lưu.</p>}
          {versions.map((entry) => (
            <div className="operations-history-item" key={entry.id}>
              <strong>{String(entry.version)}</strong>
              <span className="store-status-chip">Dự thảo</span>
              <small>{date(entry.createdAt)}</small>
              <button type="button" aria-pressed={viewedId === entry.id} onClick={() => setViewedId(entry.id)}>Xem nội dung</button>
            </div>
          ))}
        </section>
        <section className="store-card operations-editor">
          <h2>Trình biên tập nội dung</h2>
          <form className="store-form" id="policy-editor" onSubmit={(event) => onSave(fields(event))}>
            <label>
              Mã phiên bản
              <input name="version" placeholder="1.1-draft" required maxLength={40} value={version} onChange={(event) => setVersion(event.target.value)} />
            </label>
            <label>
              Tiêu đề chính sách
              <input value={String(policy.title ?? "Chính sách bảo mật Gói Huế")} readOnly />
            </label>
            <label>
              Nội dung
              <textarea name="content" rows={16} required maxLength={16000} value={content} onChange={(event) => {
                setContent(event.target.value);
                setViewedId("");
              }} />
            </label>
            <small>{content.length}/16.000 ký tự</small>
            <button disabled={busy}>Lưu bản thảo mới</button>
          </form>
        </section>
        <section className="store-card operations-preview">
          <div className="store-list-heading">
            <h2>Khung xem trước chính sách</h2>
            <Link href="/privacy-policy">Xem trang cửa hàng ↗</Link>
          </div>
          <article>
            <p className="store-status-chip">Dự thảo{(viewed?.version || version.trim()) && ` · ${String(viewed?.version || version.trim())}`}</p>
            <h3>{String(viewed?.title ?? policy.title)}</h3>
            <div className="store-policy">{String(viewed?.content ?? content) || "Nhập nội dung để xem trước."}</div>
          </article>
          {viewed && <button type="button" className="store-btn-secondary" onClick={() => setViewedId("")}>Quay lại bản đang soạn</button>}
        </section>
      </div>
    </>
  );
}

export function AuditLog({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const actors = [...new Set(rows.flatMap((row) => typeof row.actorName === "string" ? [row.actorName] : []))].sort();
  const [page, setPage] = useState(1);
  const filtered = rows.filter((row) =>
    (!action || row.action === action) &&
    (!actor || row.actorName === actor) &&
    (!from || new Date(String(row.at)).getTime() >= new Date(`${from}T00:00:00`).getTime()) &&
    [row.subject, row.action, row.actorName].some((value) => String(value ?? "").toLowerCase().includes(query.trim().toLowerCase())),
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));

  return (
    <div className="operations-audit">
      <aside className="operations-notice">
        <span className="operations-notice-mark" aria-hidden="true">i</span>
        <div><h2>Bản ghi kiểm toán chỉ đọc</h2><p>Tra cứu các hoạt động gần nhất theo thời gian, tác nhân và đối tượng.</p></div>
      </aside>
      <section className="store-card operations-audit-filters">
        <div className="store-list-heading">
          <h2>Bộ lọc truy vết sự kiện</h2>
          <button type="button" onClick={() => {
            setQuery(""); setActor(""); setAction(""); setFrom(""); setPage(1);
          }}>Đặt lại tiêu chí</button>
        </div>
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
          <label>
            Tác nhân
            <select value={actor} onChange={(event) => { setActor(event.target.value); setPage(1); }}>
              <option value="">Tất cả tác nhân</option>
              {actors.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <label>
            Từ ngày
            <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
          </label>
        </div>
      </section>
      <section className="store-card operations-audit-stream">
        <div className="store-list-heading"><h2>Sổ bản ghi kiểm toán hệ thống</h2><span className="store-status-chip">{filtered.length} bản ghi</span></div>
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
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { date, fields, label, type Row } from "@/lib/store";
import { PolicyPreview } from "./policy-preview";
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
  const [collapsed, setCollapsed] = useState(false);
  const area = section === "returns" ? "Chăm sóc khách hàng"
    : section === "settings" ? "Thiết lập hệ thống"
    : section === "policies" ? "Quản lý nội dung" : "Giám sát hệ thống";
  return (
    <div className="admin-returns" data-sidebar-collapsed={collapsed}>
      <aside className="returns-admin-sidebar" id="operations-sidebar">
        <header>
          <Image className="operations-brand-mark" src="/images/stitch/asset-08.png" width={48} height={38} alt="" />
          <div><strong>Quản trị Gói Huế</strong><small>Quản lý cửa hàng</small></div>
        </header>
        <WorkspaceNav admin section={section} showIcons />
        <div className="returns-admin-links">
          <Link href="/">Xem cửa hàng →</Link>
          <div className="operations-admin-profile">
            <span aria-hidden="true">{userName.trim().split(/\s+/).slice(-2).map((word) => word[0]).join("")}</span>
            <div><strong>{userName}</strong><small>Quản trị viên</small></div>
          </div>
          <button type="button" onClick={onLogout}>Đăng xuất</button>
        </div>
      </aside>
      <main className="returns-admin-main">
        <div className="returns-admin-topbar">
          <button className="operations-toggle-sidebar" type="button" aria-controls="operations-sidebar" aria-expanded={!collapsed}
            onClick={() => setCollapsed((current) => !current)}>
            {collapsed ? "Mở menu" : "Thu gọn menu"}
          </button>
          <span className="operations-breadcrumb">Quản trị › {area} › {title}</span>
          <Link href="/">Xem cửa hàng</Link>
          <span className="store-status-chip">{userName}</span>
        </div>
        <header className="returns-heading returns-admin-heading">
          <div><h1>{title}</h1><p>{description}</p></div>
        </header>
        {children}
      </main>
    </div>
  );
}

export function EvidencePreview({ id, compact = false }: { id: string; compact?: boolean }) {
  const [missing, setMissing] = useState(false);
  const url = `/api/store/evidence/${encodeURIComponent(id)}/content`;
  return missing ? (
    <span className="returns-evidence-missing" data-compact={compact}>Ảnh không khả dụng</span>
  ) : (
    <a className="returns-evidence-preview" data-compact={compact} href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Xem ảnh bằng chứng" loading="lazy" onError={() => setMissing(true)} />
    </a>
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
        evidenceIds: [...evidence],
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
              {visibleCases.map(({ row, products, reasons, quantity, evidenceIds, caseStatus }) => (
                <tr key={row.id}>
                  <td>
                    <strong>#{String(row.caseId || row.id).slice(0, 8)}</strong><br />
                    {String(row.orderNumber)}<br /><small>{date(row.createdAt)}</small>
                  </td>
                  <td>{String(orderById.get(String(row.orderId))?.recipient ?? "—")}</td>
                  <td>{products} · {quantity} sản phẩm<br /><small>{reasons}</small></td>
                  <td>
                    <div className="returns-evidence-cell">
                      {evidenceIds.slice(0, 2).map((id) => <EvidencePreview key={id} id={id} compact />)}
                    </div>
                    <small>{evidenceIds.length} ảnh</small>
                  </td>
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
  const editor = useRef<HTMLTextAreaElement>(null);

  function format(prefix: string, suffix = "", linePrefix = false) {
    const input = editor.current;
    if (!input) return;
    const selectionStart = linePrefix ? content.lastIndexOf("\n", input.selectionStart - 1) + 1 : input.selectionStart;
    const selectionEnd = input.selectionEnd;
    const selection = content.slice(selectionStart, selectionEnd);
    const replacement = linePrefix
      ? selection.split("\n").map((line) => prefix + line).join("\n")
      : prefix + selection + suffix;
    const next = content.slice(0, selectionStart) + replacement + content.slice(selectionEnd);
    if (next.length > input.maxLength) return;
    setViewedId("");
    setContent(next);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(selectionStart + prefix.length, selectionStart + replacement.length - suffix.length);
    });
  }

  return (
    <>
      <aside className="operations-notice">
        <span className="operations-notice-mark" aria-hidden="true">!</span>
        <div><h2>Phạm vi áp dụng chính sách</h2><p>Trình biên tập lưu bản thảo chính sách bảo mật. Xem trước nội dung trước khi lưu phiên bản mới.</p></div>
        <span className="store-status-chip">Phiên bản {String(policy.version ?? "—")}</span>
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
            <div className="operations-markdown-toolbar" role="group" aria-label="Định dạng Markdown">
              <button type="button" aria-label="In đậm" onClick={() => format("**", "**")}><strong>B</strong></button>
              <button type="button" aria-label="In nghiêng" onClick={() => format("*", "*")}><em>I</em></button>
              <button type="button" aria-label="Tiêu đề cấp 3" onClick={() => format("### ", "", true)}>H3</button>
              <button type="button" aria-label="Danh sách" onClick={() => format("- ", "", true)}>List</button>
            </div>
            <label>
              Nội dung Markdown
              <textarea ref={editor} name="content" rows={16} required maxLength={16000} value={content} onChange={(event) => {
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
            <small className="eyebrow">Storefront preview</small>
            <p className="store-status-chip">Dự thảo{(viewed?.version || version.trim()) && ` · ${String(viewed?.version || version.trim())}`}</p>
            <h3>{String(viewed?.title ?? policy.title)}</h3>
            <PolicyPreview content={String(viewed?.content ?? content) || "Nhập nội dung để xem trước."} />
          </article>
          {viewed && <button type="button" className="store-btn-secondary" onClick={() => setViewedId("")}>Quay lại bản đang soạn</button>}
        </section>
      </div>
    </>
  );
}

const auditActions: Record<string, [string, string]> = {
  LOGIN: ["Tài khoản", "Đăng nhập"],
  PASSWORD_CHANGED: ["Tài khoản", "Đổi mật khẩu"],
  profile: ["Tài khoản", "Cập nhật hồ sơ"],
  "address-save": ["Tài khoản", "Lưu địa chỉ"],
  "address-delete": ["Tài khoản", "Xóa địa chỉ"],
  consent: ["Quyền riêng tư", "Cập nhật đồng ý"],
  "privacy-create": ["Quyền riêng tư", "Gửi yêu cầu về dữ liệu"],
  "privacy-update": ["Quyền riêng tư", "Xử lý yêu cầu về dữ liệu"],
  "privacy-supplement": ["Quyền riêng tư", "Bổ sung yêu cầu về dữ liệu"],
  policy: ["Chính sách", "Lưu bản thảo"],
  "shipping-save": ["Cấu hình", "Lưu cấu hình bán hàng"],
  "return-create": ["Đổi trả", "Tạo yêu cầu đổi trả"],
  "return-submit": ["Đổi trả", "Gửi yêu cầu đổi trả"],
  "return-update": ["Đổi trả", "Cập nhật hồ sơ đổi trả"],
  "return-supplement": ["Đổi trả", "Bổ sung bằng chứng"],
  "return-withdraw": ["Đổi trả", "Rút yêu cầu"],
  "return-confirm": ["Đổi trả", "Xác nhận phương án"],
  EVIDENCE_STORED_UNSCANNED: ["Đổi trả", "Lưu ảnh bằng chứng"],
  checkout: ["Đơn hàng", "Tạo đơn hàng"],
  "order-status": ["Đơn hàng", "Cập nhật trạng thái đơn"],
  "order-paid": ["Đơn hàng", "Ghi nhận đã thu tiền"],
  "order-cancel": ["Đơn hàng", "Hủy đơn hàng"],
  "order-recipient": ["Đơn hàng", "Cập nhật người nhận"],
  "payment-resolve": ["Đơn hàng", "Đối soát thanh toán"],
  "cart-set": ["Giỏ hàng", "Cập nhật giỏ"],
  "cart-clear": ["Giỏ hàng", "Xóa giỏ hàng"],
  "cart-refresh": ["Giỏ hàng", "Làm mới giỏ hàng"],
  "product-save": ["Danh mục và sản phẩm", "Lưu sản phẩm"],
  "product-delete": ["Danh mục và sản phẩm", "Xóa sản phẩm"],
  "category-save": ["Danh mục và sản phẩm", "Lưu danh mục"],
  "category-delete": ["Danh mục và sản phẩm", "Xóa danh mục"],
  "catalog-toggle": ["Danh mục và sản phẩm", "Cập nhật hiển thị"],
  "catalog-image-intent": ["Danh mục và sản phẩm", "Chuẩn bị tải ảnh"],
  CATALOG_IMAGE_UPLOADED: ["Danh mục và sản phẩm", "Tải ảnh sản phẩm"],
};

function auditAction(action: unknown) {
  const code = String(action ?? "");
  return auditActions[code] ?? ["Khác", code || "—"];
}

export function AuditLog({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [module, setModule] = useState("");
  const [period, setPeriod] = useState("");
  const [jump, setJump] = useState("");
  const modules = [...new Set(rows.map((row) => auditAction(row.action)[0]))].sort();
  const periodStart = new Date();
  periodStart.setHours(0, 0, 0, 0);
  if (period) periodStart.setDate(periodStart.getDate() - Number(period) + 1);
  const [from, setFrom] = useState("");
  const actors = [...new Set(rows.flatMap((row) => typeof row.actorName === "string" ? [row.actorName] : []))].sort();
  const [page, setPage] = useState(1);
  const filtered = rows.filter((row) =>
    (!action || row.action === action) &&
    (!actor || row.actorName === actor) &&
    (!module || auditAction(row.action)[0] === module) &&
    (!period || new Date(String(row.at)).getTime() >= periodStart.getTime()) &&
    (!from || new Date(String(row.at)).getTime() >= new Date(`${from}T00:00:00`).getTime()) &&
    [row.subject, row.subjectLabel, row.action, auditAction(row.action)[1], row.actorName].some((value) => String(value ?? "").toLowerCase().includes(query.trim().toLowerCase())),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);

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
            setQuery(""); setActor(""); setAction(""); setModule(""); setPeriod(""); setFrom(""); setJump(""); setPage(1);
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
                <option key={value} value={value}>{auditAction(value)[1]}</option>
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
            Phân hệ hoạt động
            <select value={module} onChange={(event) => { setModule(event.target.value); setPage(1); }}>
              <option value="">Tất cả phân hệ</option>
              {modules.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <label>
            Khoảng thời gian
            <select value={period} onChange={(event) => { setPeriod(event.target.value); setFrom(""); setPage(1); }}>
              <option value="">Tất cả thời gian</option>
              <option value="1">Hôm nay</option>
              <option value="7">7 ngày</option>
              <option value="30">30 ngày</option>
            </select>
          </label>
          <label>
            Từ ngày
            <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPeriod(""); setPage(1); }} />
          </label>
        </div>
      </section>
      <section className="store-card operations-audit-stream">
        <div className="store-list-heading"><h2>Sổ bản ghi kiểm toán hệ thống</h2><span className="store-status-chip">{filtered.length} bản ghi</span></div>
        {filtered.length ? (
          <div className="operations-table">
            <table>
              <thead><tr><th scope="col">Thời gian</th><th scope="col">Tác nhân</th><th scope="col">Hành động</th><th scope="col">Đối tượng</th><th scope="col">Mô tả nghiệp vụ</th><th scope="col">Chi tiết bản ghi</th></tr></thead>
              <tbody>
                {filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row) => (
                  <tr key={row.id}>
                    <td>{date(row.at)}</td>
                    <td>{String(row.actorName ?? "—")}{row.actorRole ? ` · ${String(row.actorRole)}` : ""}</td>
                    <td><span className="store-status-chip">{auditAction(row.action)[1]}</span></td>
                    <td>{row.subjectLabel ? String(row.subjectLabel) : row.subject ? `#${String(row.subject).slice(0, 8)}` : "—"}</td>
                    <td>{auditAction(row.action)[0]} · {auditAction(row.action)[1]}</td>
                    <td>
                      <details>
                        <summary>Xem chi tiết</summary>
                        <dl className="audit-record-details">
                          <dt>Mã sự kiện</dt><dd>{String(row.id)}</dd>
                          <dt>Mã hành động</dt><dd>{String(row.action)}</dd>
                          <dt>Đối tượng</dt><dd>{String(row.subject || "—")}</dd>
                          {row.subjectKind != null && <><dt>Loại đối tượng</dt><dd>{String(row.subjectKind)}</dd></>}
                        </dl>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="store-empty">{rows.length ? "Không tìm thấy sự kiện phù hợp." : "Chưa có hoạt động."}</p>}
        {pages > 1 && (
          <div className="operations-pagination">
            <Pagination page={currentPage} total={filtered.length} pageSize={pageSize} onChange={setPage} />
            <form onSubmit={(event) => {
              event.preventDefault();
              const targetPage = Number(jump);
              if (targetPage >= 1 && targetPage <= pages) setPage(targetPage);
            }}>
              <label>Đến trang <input type="number" min={1} max={pages} required value={jump}
                onChange={(event) => setJump(event.target.value)} /></label>
              <button>Đi</button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}

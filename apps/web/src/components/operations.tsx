"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { date, label, type Row } from "@/lib/store";
import { StatusBadge } from "@/shared/ui";
import { Pagination } from "./workspace-nav";
import { LanAdminShell } from "./lan-admin-shell";
import styles from "./admin-operations.module.css";
import workbench from "./admin-workbench.module.css";
import returnsStyles from "./admin-returns.module.css";

export function OperationsWorkspace({
  section,
  title,
  description,
  children,
}: {
  section: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return <LanAdminShell section={section}>
      <main className={`store-page lan-page lan-admin ${styles.workspace}`}>
        <header className={styles.heading}>
          <span className="eyebrow">Khu vực điều hành</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        {children}
      </main>
    </LanAdminShell>;
}

export function EvidencePreview({ id, compact = false }: { id: string; compact?: boolean }) {
  const [missing, setMissing] = useState(false);
  const url = `/api/store/evidence/${encodeURIComponent(id)}/content`;
  return missing ? (
    <span className="returns-evidence-missing" data-compact={compact}>Ảnh không khả dụng</span>
  ) : (
    <a className="returns-evidence-preview" data-compact={compact} href={url} target="_blank" rel="noreferrer">
      <Image src={url} alt="Xem ảnh bằng chứng" width={120} height={120} unoptimized loading="lazy" onError={() => setMissing(true)} />
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
  selected,
}: {
  rows: Row[];
  onSelect: (row: Row) => void;
  orders?: Row[];
  admin?: boolean;
  selected?: Row | null;
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


  if (admin) return (
    <section className={workbench.pane} aria-labelledby="return-queue-title">
      <header className={workbench.paneHead}>
        <div>
          <h2 id="return-queue-title">Hồ sơ đổi trả</h2>
          <p className={workbench.quiet}>{cases.length} hồ sơ</p>
        </div>
      </header>
      <div className={returnsStyles.filters}>
        <label>Tìm hồ sơ
          <input type="search" placeholder="Mã đơn, sản phẩm, người nhận" value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        </label>
        <label>Trạng thái
          <select aria-label="Lọc trạng thái đổi trả" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">Tất cả ({allCases.length})</option>
            {filters.map((filter) => <option key={filter.id} value={filter.id}>{filter.label} ({filter.count})</option>)}
          </select>
        </label>
      </div>
      {cases.length === 0 ? (
        <p className={workbench.empty}>{rows.length ? "Không tìm thấy hồ sơ phù hợp." : "Chưa có yêu cầu đổi trả."}</p>
      ) : (
        <ul className={`${workbench.itemList} ${returnsStyles.queue}`}>
          {visibleCases.map(({ row, products, reasons, quantity, evidenceIds, caseStatus }) => (
            <li key={row.id}>
              <button type="button" className={workbench.item}
                aria-pressed={Boolean(selected && (selected.caseId || selected.id) === (row.caseId || row.id))}
                onClick={() => onSelect(row)}>
                <span className={workbench.row}>
                  <strong>{String(row.orderNumber)}</strong>
                  <StatusBadge tone={row.status === "RESOLVED" ? "success" : "neutral"} className={workbench.badge}>{caseStatus}</StatusBadge>
                </span>
                <span className={returnsStyles.excerpt}>{products} · {quantity} sản phẩm</span>
                <span className={returnsStyles.excerpt}>{reasons}</span>
                <small className={workbench.quiet}>#{String(row.caseId || row.id).slice(0, 8)} · {date(row.createdAt)}{evidenceIds.length > 0 && ` · ${evidenceIds.length} ảnh`}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {cases.length > pageSize && <Pagination page={currentPage} total={cases.length} pageSize={pageSize} onChange={setPage} allowJump />}
    </section>
  );

  return (
    <div className="operations-list">
      {rows.length > 0 && (
        <div className="returns-filters">
          <label>
            Tìm yêu cầu
            <input type="search" value={query} placeholder="Mã đơn, mã yêu cầu hoặc sản phẩm" onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }} />
          </label>
        </div>
      )}
      {!cases.length && (
        <p className="store-empty">{rows.length ? "Không tìm thấy yêu cầu phù hợp." : "Chưa có yêu cầu đổi trả."}</p>
      )}
      {visibleCases.map(({ row, products, reasons, quantity, caseStatus }) => (
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
  "policy-publish": ["Chính sách", "Công bố phiên bản"],
  "guest-support-in_review": ["Hỗ trợ", "Phản hồi yêu cầu vãng lai"],
  "guest-support-resolved": ["Hỗ trợ", "Đóng yêu cầu vãng lai"],
  "shipping-save": ["Cấu hình", "Lưu cấu hình bán hàng"],
  "pricing-save": ["Định giá", "Lưu quy tắc giá"],
  "pricing-toggle": ["Định giá", "Cập nhật trạng thái quy tắc giá"],
  "pricing-floor": ["Định giá", "Cập nhật giá sàn sản phẩm"],
  "discount-save": ["Ưu đãi", "Lưu chương trình ưu đãi"],
  "discount-toggle": ["Ưu đãi", "Cập nhật trạng thái ưu đãi"],
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
  "order-cod-adjust": ["Đơn hàng", "Điều chỉnh khoản phải thu COD"],
  "order-cancel": ["Đơn hàng", "Hủy đơn hàng"],
  "order-recipient": ["Đơn hàng", "Cập nhật người nhận"],
  "payment-resolve": ["Đơn hàng", "Đối soát thanh toán"],
  "cart-set": ["Giỏ hàng", "Cập nhật giỏ"],
  "guest-cart-merge": ["Giỏ hàng", "Gộp giỏ khách vào tài khoản"],
  "guest-checkout": ["Đơn hàng", "Khách vãng lai đặt đơn"],
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
            setQuery(""); setActor(""); setAction(""); setModule(""); setPeriod(""); setFrom(""); setPage(1);
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
          <Pagination page={currentPage} total={filtered.length} pageSize={pageSize} onChange={setPage} allowJump />
        )}
      </section>
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { date, label, type Row } from "@/lib/store";
import { LanAdminShell } from "./lan-admin-shell";
import { Pagination } from "./workspace-nav";
import styles from "./admin-privacy.module.css";

const types = ["ACCESS", "EXPORT", "DELETE", "RESTRICT", "COMPLAINT"];
const statuses = ["SUBMITTED", "REVIEWING", "EVIDENCE_REQUIRED", "COMPLETED", "REJECTED"];

export function AdminPrivacy({ rows, selected, detail, onSelect }: { rows: Row[]; selected: Row | null; detail: ReactNode; onSelect: (row: Row) => void }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const filtered = rows.filter((row) => (!query || `${row.id} ${row.description ?? ""}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"))) && (!type || row.type === type) && (!status || row.status === status));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 8)));
  const metrics = [
    { title: "Yêu cầu mới tiếp nhận", count: rows.filter((row) => row.status === "SUBMITTED").length, caption: "Chờ xem xét", icon: "inbox" },
    { title: "Đang xem xét & bổ sung", count: rows.filter((row) => ["REVIEWING", "EVIDENCE_REQUIRED"].includes(String(row.status))).length, caption: "Hồ sơ đang xử lý", icon: "pending_actions" },
    { title: "Đã có kết luận", count: rows.filter((row) => ["COMPLETED", "REJECTED"].includes(String(row.status))).length, caption: "Đã xử lý hoặc từ chối", icon: "task_alt" },
  ];
  return <LanAdminShell section="privacy"><main className={`store-page lan-page lan-admin ${styles.page}`}>
    <header className={styles.heading}><span className="eyebrow">Quản trị · Quyền riêng tư &amp; dữ liệu</span><h1>Xử lý quyền riêng tư &amp; dữ liệu</h1><p>Tiếp nhận, theo dõi và xử lý các yêu cầu về dữ liệu cá nhân của khách hàng.</p></header>
    <section className={styles.metrics} aria-label="Tổng quan yêu cầu dữ liệu">{metrics.map((metric) => <div key={metric.title} className={styles.metric}><div><span>{metric.title}</span><strong>{metric.count}</strong><small>{metric.caption}</small></div><span className={`material-symbols-outlined ${styles.metricIcon}`} aria-hidden="true">{metric.icon}</span></div>)}</section>
    <aside className={styles.notice}><span className="material-symbols-outlined" aria-hidden="true">shield</span><div><h2>Nguyên tắc xử lý dữ liệu cá nhân</h2><p>Xem xét phạm vi và căn cứ xử lý của từng yêu cầu; đối chiếu chính sách hiện hành trước khi đưa ra quyết định.</p></div></aside>
    <div className={styles.layout}><section className={styles.list} aria-label="Danh sách yêu cầu dữ liệu"><div className={styles.listHeading}><div><h2>Danh sách yêu cầu dữ liệu</h2><p>Tra cứu và theo dõi các yêu cầu của khách hàng.</p></div><span>{filtered.length} hồ sơ</span></div>
      <div className={styles.filters}><label><span>Tìm yêu cầu</span><input type="search" value={query} placeholder="Mã hồ sơ hoặc nội dung" onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></label><label><span>Loại yêu cầu</span><select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="">Tất cả loại</option>{types.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><label><span>Trạng thái</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>{statuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label></div>
      <div className={styles.tableWrap}><table><thead><tr><th>Mã yêu cầu</th><th>Loại yêu cầu</th><th>Ngày gửi</th><th>Trạng thái</th><th><span className={styles.srOnly}>Thao tác</span></th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 8, currentPage * 8).map((row) => <tr key={row.id} className={selected?.id === row.id ? styles.active : undefined}><td><strong>{row.id.slice(0, 8)}</strong></td><td>{label(row.type)}</td><td>{date(row.createdAt)}</td><td><span className={styles.badge}>{label(row.status)}</span></td><td><button type="button" onClick={() => onSelect(row)} aria-label={`Xem chi tiết yêu cầu ${row.id.slice(0, 8)}`}>Chi tiết →</button></td></tr>)}</tbody></table></div>
      {filtered.length === 0 && <p className={styles.empty}>{rows.length ? "Không tìm thấy yêu cầu phù hợp." : "Chưa có yêu cầu dữ liệu."}</p>}<Pagination page={currentPage} total={filtered.length} pageSize={8} onChange={setPage} />
    </section><aside className={styles.detail} aria-label="Chi tiết yêu cầu dữ liệu"><div className={styles.detailHeading}><span>HỒ SƠ THỤ LÝ</span><h2>Chi tiết yêu cầu dữ liệu</h2><p>Xem thông tin, xử lý và theo dõi lịch sử hồ sơ.</p></div>{detail ?? <p className={styles.empty}>Chọn một yêu cầu trong danh sách để xem chi tiết và xử lý.</p>}</aside></div>
  </main></LanAdminShell>;
}

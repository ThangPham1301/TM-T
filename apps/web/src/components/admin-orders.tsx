"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cleanText, date, label, money, type Row } from "@/lib/store";
import { LanAdminShell } from "./lan-admin-shell";
import { OrderPaymentBadge, OrderStatusBadge } from "./order-presentation";
import { codNeedsReceipt, needsPaymentReview } from "@/lib/order-payment";
import { Pagination } from "./workspace-nav";
import styles from "./admin-orders.module.css";

type Props = {
  orders: Row[]; filteredOrders: Row[]; query: string; status: string;
  paymentStatus: string; page: number; selected: Row | null; detail: ReactNode;
  onQueryChange: (value: string) => void; onStatusChange: (value: string) => void;
  onPaymentStatusChange: (value: string) => void; onPageChange: (value: number) => void;
  onSelect: (order: Row) => void; onClose: () => void;
};

const statuses = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "DELIVERY_FAILED", "RETURNED", "CANCELLED"];

const customerGroups = [
  { id: "all", label: "Tất cả khách" },
  { id: "account", label: "Khách có tài khoản" },
  { id: "guest", label: "Khách vãng lai" },
] as const;

type CustomerGroup = (typeof customerGroups)[number]["id"];
const pageSize = 8;

function isGuestOrder(order: Row) {
  return order.customerType === "GUEST";
}

function CustomerTypeBadge({ order }: { order: Row }) {
  const guest = isGuestOrder(order);
  return <small className={styles.customerBadge} data-customer-type={guest ? "guest" : "account"}>
    {guest ? "Khách vãng lai" : "Khách có tài khoản"}
  </small>;
}

export function AdminOrders({ orders, filteredOrders, query, status, paymentStatus, page, selected, detail, onQueryChange, onStatusChange, onPaymentStatusChange, onPageChange, onSelect, onClose }: Props) {
  const [customerGroup, setCustomerGroup] = useState<CustomerGroup>("all");
  const drawer = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const selectedId = selected?.id;
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!selectedId) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    drawer.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab" || !drawer.current) return;
      const elements = Array.from(drawer.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])')).filter((element) => element.getClientRects().length > 0);
      if (!elements.length) { event.preventDefault(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === drawer.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [selectedId]);

  const metrics = [
    ["Tổng đơn", orders.length],
    ["Chờ xác nhận", orders.filter((o) => o.status === "PLACED").length],
    ["Đang đóng gói", orders.filter((o) => o.status === "PACKED").length],
    ["Đang giao", orders.filter((o) => o.status === "SHIPPED").length],
    ["Đã giao", orders.filter((o) => o.status === "DELIVERED").length],
  ];
  const guestCount = filteredOrders.filter(isGuestOrder).length;
  const counts = {
    all: filteredOrders.length,
    account: filteredOrders.length - guestCount,
    guest: guestCount,
  };
  const visibleOrders = customerGroup === "all"
    ? filteredOrders
    : filteredOrders.filter((order) => isGuestOrder(order) === (customerGroup === "guest"));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visibleOrders.length / pageSize)));

  return <LanAdminShell section="orders">
    <main className={`store-page lan-page lan-admin ${styles.page}`}>
      <header className={styles.heading}><span className="eyebrow">Khu vực điều hành</span><h1>Quản lý đơn hàng</h1><p>Tiếp nhận đơn hàng, theo dõi vận chuyển và xử lý thanh toán của cửa hàng.</p></header>
      <section className={styles.metrics} aria-label="Tình hình đơn hàng">{metrics.map(([name, count]) => <div className={styles.metric} key={name}><span>{name}</span><strong>{count}</strong></div>)}</section>
      <section className={styles.filters} aria-label="Bộ lọc đơn hàng">
        <div className={styles.customerFilters} role="group" aria-label="Loại khách hàng">
          {customerGroups.map((group) => (
            <button
              className={styles.customerFilter}
              type="button"
              key={group.id}
              aria-pressed={customerGroup === group.id}
              onClick={() => {
                setCustomerGroup(group.id);
                onPageChange(1);
              }}
            >
              {group.label} <span>{counts[group.id]}</span>
            </button>
          ))}
        </div>
        <label><span>Tìm đơn hàng</span><input type="search" value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Mã đơn, người nhận hoặc số điện thoại" /></label>
        <label><span>Trạng thái đơn</span><select value={status} onChange={(e) => onStatusChange(e.target.value)}><option value="">Tất cả trạng thái</option>{statuses.map((s) => <option value={s} key={s}>{label(s)}</option>)}</select></label>
        <label><span>Thanh toán</span>
          <select aria-label="Thanh toán" value={paymentStatus} onChange={(e) => onPaymentStatusChange(e.target.value)}>
            <option value="">Tất cả thanh toán</option>
            <option value="REVIEW">Cần đối soát ({orders.filter(needsPaymentReview).length})</option>
            <option value="COD_UNRECORDED">COD đã giao, thiếu chứng từ ({orders.filter(codNeedsReceipt).length})</option>
            <option value="PENDING">VietQR chờ chuyển khoản</option>
            <option value="UNPAID">Chưa thu tiền</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="EXPIRED">VietQR hết hạn</option>
            <option value="REFUNDED">Đã hoàn tiền</option>
          </select>
        </label>
      </section>
      <section className={styles.list} aria-label="Danh sách đơn hàng">
        <div className={styles.listHeading}><h2>Danh sách đơn hàng</h2><span aria-live="polite">{visibleOrders.length} đơn</span></div>
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Mã đơn hàng</th><th>Thời gian đặt</th><th>Khách hàng / Người nhận</th><th>Giao vận</th><th>Thanh toán</th><th>Tổng tiền</th><th><span className={styles.srOnly}>Thao tác</span></th></tr></thead><tbody>
          {visibleOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((order) => (
            <tr key={order.id} className={selected?.id === order.id ? styles.selectedRow : undefined}>
              <td><strong>{String(order.number)}</strong></td>
              <td>{date(order.createdAt)}</td>
              <td><strong>{cleanText(String(order.recipient ?? ""))}</strong><CustomerTypeBadge order={order} /><small>{String(order.phone ?? "")}</small><small>{cleanText(String(order.address ?? ""))}</small></td>
              <td><OrderStatusBadge order={order} /></td>
              <td><OrderPaymentBadge order={order} /></td>
              <td><strong>{money(order.total)}</strong></td>
              <td><button type="button" className={styles.viewButton} onClick={() => onSelect(order)}>Xem chi tiết <span aria-hidden="true">→</span></button></td>
            </tr>
          ))}
        </tbody></table></div>
        {visibleOrders.length === 0 && <p className={styles.empty}>{orders.length ? "Không có đơn phù hợp bộ lọc." : "Chưa có đơn hàng nào."}</p>}
        <div className={styles.pagination}><Pagination page={currentPage} total={visibleOrders.length} pageSize={pageSize} onChange={onPageChange} /></div>
      </section>
    </main>
    {selected && <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={drawer} className={styles.drawer} role="dialog" aria-modal="true" aria-label={`Chi tiết đơn ${String(selected.number ?? "")}`} tabIndex={-1}>
        <div className={styles.drawerHeading}>
          <div>
            <span>QUẢN LÝ ĐƠN HÀNG</span>
            <h2>Chi tiết đơn {String(selected.number ?? "")}</h2>
            <p>Thời gian đặt: {date(selected.createdAt)}</p>
            <CustomerTypeBadge order={selected} />
          </div>
          <button type="button" aria-label="Đóng chi tiết đơn hàng" onClick={onClose}>×</button>
        </div>
        <div className={styles.drawerContent}>{detail}</div>
      </div>
    </div>}
  </LanAdminShell>;
}

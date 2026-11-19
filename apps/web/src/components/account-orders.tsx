"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type Row, api, cleanText, date, money, useStore } from "@/lib/store";
import { PaymentPanel } from "./payment-panel";
import { VietQrDialog } from "./checkout-payment";
import { codDisplayAmount, codHasNoCollection, codNeedsReceipt, isCodOrder, matchesPaymentFilter, orderPaymentLabel, orderPaymentStatus, paymentDetails } from "@/lib/order-payment";

const EMPTY_ORDERS: Row[] = [];
export function AccountOrders({
  initialOrderId,
}: {
  initialOrderId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkedOrderId = initialOrderId ?? searchParams.get("order");
  const { state, busy, run, mutate } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<
    "ALL" | "PLACED" | "SHIPPED" | "DELIVERED" | "CANCELLED"
  >("ALL");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [payOrderId, setPayOrderId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const openedOrder = useRef<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const orders = state?.orders ?? EMPTY_ORDERS;
  const payingOrder = orders.find((order) => order.id === payOrderId);
  useEffect(() => {
    const id = linkedOrderId;
    if (!orders.length || openedOrder.current === id) return;
    if (!id) return;
    const index = orders.findIndex((order) => order.id === id);
    if (index < 0) return;
    openedOrder.current = id;
    void Promise.resolve().then(() => {
      setExpandedIds((previous) => ({ ...previous, [id]: true }));
      setCurrentPage(Math.floor(index / 4) + 1);
    });
  }, [linkedOrderId, orders]);

  // Tab counts
  const countAll = orders.length;
  const countPlaced = orders.filter((o) =>
    ["PLACED", "CONFIRMED"].includes(String(o.status)),
  ).length;
  const countShipped = orders.filter((o) =>
    ["PACKED", "SHIPPED"].includes(String(o.status)),
  ).length;
  const countDelivered = orders.filter(
    (o) => String(o.status) === "DELIVERED",
  ).length;
  const countCancelled = orders.filter((o) =>
    ["CANCELLED", "DELIVERY_FAILED", "RETURNED"].includes(String(o.status)),
  ).length;

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Status Tab filter
      if (statusTab === "PLACED") {
        if (!["PLACED", "CONFIRMED"].includes(String(order.status))) return false;
      } else if (statusTab === "SHIPPED") {
        if (!["PACKED", "SHIPPED"].includes(String(order.status))) return false;
      } else if (statusTab === "DELIVERED") {
        if (String(order.status) !== "DELIVERED") return false;
      } else if (statusTab === "CANCELLED") {
        if (
          !["CANCELLED", "DELIVERY_FAILED", "RETURNED"].includes(
            String(order.status),
          )
        )
          return false;
      }

      // 2. Payment filter
      if (!matchesPaymentFilter(order, paymentFilter)) return false;

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = String(order.number || "").toLowerCase();
        const recip = cleanText(String(order.recipient || "")).toLowerCase();
        const ph = String(order.phone || "").toLowerCase();
        const items = (order.items as Row[] | undefined) || [];
        const itemNames = items
          .map((i) => cleanText(String(i.name || "")).toLowerCase())
          .join(" ");

        if (
          !num.includes(q) &&
          !recip.includes(q) &&
          !ph.includes(q) &&
          !itemNames.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [orders, statusTab, paymentFilter, searchQuery]);

  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedOrders = filteredOrders.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );

  const toggleDetails = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? (id === linkedOrderId)),
    }));
  };

  const handleCancelOrder = async (order: Row) => {
    if (
      !window.confirm(
        `Quý khách có chắc chắn muốn hủy đơn hàng #${order.number} này?`,
      )
    ) {
      return;
    }

    void run(async () => {
      await mutate("commerce", "order-cancel", {
        id: order.id,
        revision: order.revision,
        note: "Hủy theo yêu cầu của khách hàng qua không gian tài khoản",
      });
      setToastMessage(
        `Yêu cầu hủy đơn hàng #${order.number} đã được thực hiện thành công.`,
      );
    });
  };

  const handleReorder = async (order: Row) => {
    const items = (order.items as Row[] | undefined) || [];
    if (!items.length) return;

    void run(async () => {
      let summary = await api("cart/summary");
      if (summary.items && summary.items.length > 0) {
        if (!window.confirm("Giỏ hàng đang có sản phẩm. Bạn muốn thay bằng các món từ đơn này?")) return;
        await mutate("commerce", "cart-clear", {
          cartToken: summary.cartToken,
        });
        summary = await api("cart/summary");
      }
      for (const item of items) {
        const pId = String(item.productId || item.id || "");
        if (!pId) continue;
        const qty = Number(item.quantity) || 1;
        await mutate("commerce", "cart-set", {
          productId: pId,
          quantity: qty,
          cartToken: summary.cartToken,
        });
        summary = await api("cart/summary");
      }
      setToastMessage(
        `Đã tạo phiên đặt hàng mới từ đơn #${order.number}. Đang chuyển đến trang đặt hàng...`,
      );
      router.push("/checkout");
    });
  };

  return (
    <div style={{ maxWidth: "1120px", width: "100%", margin: "0 auto" }}>
      {/* Top Heritage Breadcrumb & Heading Block */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          paddingBottom: "2rem",
        }}
      >
        <div className="account-hero-eyebrow">
          <span className="account-hero-dot" />
          <span>Lịch sử bưu phẩm Cố Đô</span>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div>
            <h1 className="account-hero-title">Đơn hàng của tôi</h1>
            <p className="account-hero-subtitle">
              Theo dõi tiến trình và lịch sử đặt bưu phẩm đặc sản Gói Huế.
            </p>
          </div>

          {/* Quick Summary Counter */}
          <div className="orders-summary-card">
            <span className="material-symbols-outlined">local_shipping</span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="orders-summary-label">Bưu kiện lưu chuyển</span>
              <span className="orders-summary-val">
                {countShipped > 0
                  ? `${countShipped.toString().padStart(2, "0")} kiện đang tới`
                  : "Chưa có kiện lưu chuyển"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Success / Action Toast Banner */}
      {toastMessage && (
        <div
          className="heritage-toast-banner"
          role="status"
          style={{ marginBottom: "1.5rem" }}
        >
          <div className="icon-box">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 className="title">Thông báo hệ thống</h4>
            <p className="desc">{toastMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--af-outline)",
              padding: "4px",
            }}
            title="Đóng thông báo"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "18px" }}
            >
              close
            </span>
          </button>
          <div className="accent-bar" />
        </div>
      )}

      {/* Search & Filter Bar (Heritage Editorial Toolbar) */}
      <div className="orders-filter-container">
        {/* Search Input Row */}
        <div className="orders-search-wrapper">
          <span className="material-symbols-outlined search-icon">search</span>
          <input
            className="orders-search-input"
            type="text"
            placeholder="Tìm theo mã đơn (vd: GH-2025-8821), tên người nhận..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
          <div className="orders-search-kbd">Phím tắt ⌘K</div>
        </div>

        {/* Filter Tabs & Payment Filter Row */}
        <div className="orders-filter-row">
          {/* Status Tabs */}
          <div className="orders-tabs-group">
            <button
              type="button"
              className={`orders-tab-btn ${statusTab === "ALL" ? "active" : ""}`}
              onClick={() => {
                setStatusTab("ALL");
                setCurrentPage(1);
              }}
            >
              <span>Tất cả</span>
              <span className="orders-tab-badge">{countAll}</span>
            </button>

            <button
              type="button"
              className={`orders-tab-btn ${statusTab === "PLACED" ? "active" : ""}`}
              onClick={() => {
                setStatusTab("PLACED");
                setCurrentPage(1);
              }}
            >
              <span>Chờ xác nhận</span>
              <span className="orders-tab-badge">{countPlaced}</span>
            </button>

            <button
              type="button"
              className={`orders-tab-btn ${statusTab === "SHIPPED" ? "active" : ""}`}
              onClick={() => {
                setStatusTab("SHIPPED");
                setCurrentPage(1);
              }}
            >
              <span>Đang vận chuyển</span>
              <span className="orders-tab-badge">{countShipped}</span>
            </button>

            <button
              type="button"
              className={`orders-tab-btn ${statusTab === "DELIVERED" ? "active" : ""}`}
              onClick={() => {
                setStatusTab("DELIVERED");
                setCurrentPage(1);
              }}
            >
              <span>Đã giao hàng</span>
              <span className="orders-tab-badge">{countDelivered}</span>
            </button>

            <button
              type="button"
              className={`orders-tab-btn ${statusTab === "CANCELLED" ? "active" : ""}`}
              onClick={() => {
                setStatusTab("CANCELLED");
                setCurrentPage(1);
              }}
            >
              <span>Đã hủy</span>
              <span className="orders-tab-badge">{countCancelled}</span>
            </button>
          </div>

          {/* Payment Method Filter */}
          <div className="orders-payment-filter">
            <span className="material-symbols-outlined">payments</span>
            <select
              className="orders-payment-select"
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Tất cả thanh toán</option>
              <option value="UNPAID">Chưa thanh toán</option>
              <option value="PAID">Đã thanh toán</option>
              <option value="REVIEW">Chờ đối soát thanh toán</option>
              <option value="EXPIRED">VietQR hết hạn</option>
              <option value="REFUNDED">Đã hoàn tiền</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Stack List */}
      <div className="orders-list-stack">
        {paginatedOrders.length === 0 ? (
          <div
            className="heritage-card"
            style={{ textAlign: "center", padding: "3.5rem 1.5rem" }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: "56px",
                color: "var(--af-secondary)",
                marginBottom: "1rem",
              }}
            >
              receipt_long
            </span>
            <h3
              style={{
                fontFamily: "var(--gh-font-display)",
                color: "var(--af-primary)",
                fontSize: "20px",
                marginBottom: "0.5rem",
              }}
            >
              Chưa có đơn hàng nào
            </h3>
            <p
              style={{
                color: "var(--af-on-surface-variant)",
                fontSize: "14px",
                marginBottom: "1.5rem",
              }}
            >
              {searchQuery || statusTab !== "ALL" || paymentFilter
                ? "Không tìm thấy đơn hàng phù hợp với bộ lọc hiện tại."
                : "Quý khách chưa có đơn đặt quà nào. Hãy cùng khám phá các thức quà đặc sản Cố Đô."}
            </p>
            <Link
              href="/products"
              className="heritage-btn-primary"
              style={{ display: "inline-flex", textDecoration: "none" }}
            >
              <span className="material-symbols-outlined">storefront</span>
              <span>Khám phá bộ sưu tập</span>
            </Link>
          </div>
        ) : (
          paginatedOrders.map((order) => {
            const items = (order.items as Row[] | undefined) || [];
            const isExpanded = expandedIds[order.id] ?? (order.id === linkedOrderId);
            const isDelivered = String(order.status) === "DELIVERED";
            const isShipped = ["SHIPPED", "PACKED"].includes(
              String(order.status),
            );
            const isCancelled = [
              "CANCELLED",
              "DELIVERY_FAILED",
              "RETURNED",
            ].includes(String(order.status));
            const payStatus = orderPaymentStatus(order);
            const isCancellable =
              ["PLACED", "CONFIRMED"].includes(String(order.status)) &&
              !["PAID", "REVIEW"].includes(payStatus);
            const isPaid = payStatus === "PAID";
            const isCod = isCodOrder(order);
            const codClosed = isCod && codHasNoCollection(order);
            const codAmount = codDisplayAmount(order);
            const orderTotal = Number(order.total ?? 0);
            const showCodAmount = isCod && !codClosed;
            const amountLabel = showCodAmount
              ? isPaid ? "Đã thu COD" : codNeedsReceipt(order) ? "COD chưa ghi nhận thu" : "Trả khi nhận hàng"
              : codClosed ? "Giá trị đơn hàng" : "Tổng thanh toán";
            const displayAmount = showCodAmount ? codAmount : orderTotal;
            const payment = paymentDetails(order);
            const canOpenQr = payStatus === "PENDING" && payment?.status === "PENDING" && Boolean(payment.payload);
            const history = (order.history as Row[] | undefined) || [];

            return (
              <article key={order.id} className="orders-article-card">
                {/* Topbar: Code, Date & Status Pills */}
                <div className="orders-card-topbar">
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "0.85rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span
                        className="orders-summary-label"
                        style={{ fontSize: "12px" }}
                      >
                        Mã đơn
                      </span>
                      <span className="orders-code-badge">
                        #{String(order.number)}
                      </span>
                    </div>

                    <span
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        backgroundColor: "var(--af-outline-variant)",
                      }}
                    />

                    <div className="orders-date-wrap">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "16px", color: "var(--af-outline)" }}
                      >
                        {isDelivered ? "event_available" : "calendar_today"}
                      </span>
                      <span>
                        {isDelivered ? "Ngày nhận quà: " : "Ngày đặt: "}
                        {order.createdAt
                          ? date(order.createdAt)
                          : "18/10/2025"}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "0.6rem",
                    }}
                  >
                    {/* Status Badge */}
                    {isShipped && (
                      <span className="orders-status-pill orders-status-shipped">
                        <span
                          className="animate-pulse"
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            backgroundColor: "var(--af-secondary)",
                          }}
                        />
                        {order.status === "PACKED" ? "Đã đóng gói" : "Đang vận chuyển"}
                      </span>
                    )}
                    {isDelivered && (
                      <span className="orders-status-pill orders-status-delivered">
                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: "16px",
                            color: "var(--af-secondary)",
                          }}
                        >
                          verified
                        </span>
                        Đã giao hàng
                      </span>
                    )}
                    {isCancelled && (
                      <span className={`orders-status-pill ${order.status === "DELIVERY_FAILED" ? "orders-status-shipped" : "orders-status-cancelled"}`}>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "16px" }}
                        >
                          cancel
                        </span>
                        {order.status === "DELIVERY_FAILED" ? "Giao chưa thành công" : order.status === "RETURNED" ? "Đã hoàn về cửa hàng" : "Đã hủy"}
                      </span>
                    )}
                    {!isShipped && !isDelivered && !isCancelled && (
                      <span className="orders-status-pill orders-status-placed">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "16px" }}
                        >
                          hourglass_empty
                        </span>
                        {order.status === "CONFIRMED" ? "Đã xác nhận" : "Chờ xác nhận"}
                      </span>
                    )}

                    {/* Payment Badge */}
                    <span className={`orders-payment-pill${isPaid ? " orders-payment-paid" : " orders-payment-unpaid"}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: "15px" }} aria-hidden="true">
                        {isPaid ? "check_circle" : "payments"}
                      </span>
                      {orderPaymentLabel(order)}
                    </span>
                  </div>
                </div>

                {/* Products Row & Total Price Bar */}
                <div className="orders-card-body">
                  {/* Product Items Thumbnails */}
                  <div className="orders-items-group">
                    {items.length === 0 ? (
                      <span
                        style={{
                          color: "var(--af-outline)",
                          fontSize: "14px",
                        }}
                      >
                        Bưu phẩm đặc sản Gói Huế
                      </span>
                    ) : (
                      items.map((item, idx) => {
                        const pName = cleanText(item.name || "Sản phẩm");
                        const targetHref = item.slug
                          ? `/products/${item.slug}`
                          : "/products";
                        return (
                          <Link
                            key={idx}
                            href={targetHref}
                            className="orders-item-thumb-box orders-item-clickable"
                            title={`Xem chi tiết ${pName}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                String(item.image) ||
                                "/images/product-placeholder.svg"
                              }
                              alt={pName}
                              className="orders-item-thumb-img"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  "/images/product-placeholder.svg";
                              }}
                            />
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                paddingRight: "0.25rem",
                              }}
                            >
                              <span className="orders-item-name">
                                {pName}
                              </span>
                              <span className="orders-item-sub">
                                x{String(item.quantity ?? 1)} •{" "}
                                {money(Number(item.price) || 0)}
                              </span>
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>

                  {/* Total & Action Buttons */}
                  <div className="orders-total-actions-bar">
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        textAlign: "right",
                      }}
                    >
                      <span className="orders-total-label">
                        {amountLabel}
                      </span>
                      <span className="orders-total-val">
                        {money(displayAmount)}
                      </span>
                    </div>

                    <div className="orders-actions-btns">
                      {/* Cancel order button if applicable */}
                      {isCancellable && (
                        <button
                          type="button"
                          className="orders-btn-action orders-btn-cancel"
                          disabled={busy}
                          onClick={() => void handleCancelOrder(order)}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "18px" }}
                          >
                            cancel
                          </span>
                          <span>Hủy đơn hàng</span>
                        </button>
                      )}

                      {/* Returns button if delivered */}
                      {isDelivered && (
                        <Link
                          href="/account/returns"
                          className="orders-btn-action orders-btn-return"
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "18px" }}
                          >
                            assignment_return
                          </span>
                          <span>Yêu cầu đổi trả</span>
                        </Link>
                      )}

                      {/* Re-order button if order has items */}
                      {items.length > 0 && (
                        <button
                          type="button"
                          className="orders-btn-action orders-btn-reorder"
                          disabled={busy}
                          onClick={() => void handleReorder(order)}
                          title="Tạo checkout mới từ các món trong đơn này"
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "18px" }}
                          >
                            repeat
                          </span>
                          <span>{payStatus === "EXPIRED" ? "Đặt lại đơn" : "Đặt lại món này"}</span>
                        </button>
                      )}

                      {canOpenQr && (
                        <button type="button" className="orders-btn-action orders-btn-detail" onClick={() => setPayOrderId(order.id)}>
                          <span className="material-symbols-outlined" aria-hidden="true">qr_code_2</span>
                          Mở VietQR
                        </button>
                      )}
                      {/* Toggle Details button */}
                      <button
                        type="button"
                        className="orders-btn-action orders-btn-detail"
                        onClick={() => toggleDetails(order.id)}
                      >
                        <span>
                          {isExpanded ? "Thu gọn" : "Xem chi tiết"}
                        </span>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "18px" }}
                        >
                          {isExpanded ? "expand_less" : "expand_more"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable Details Section (Accordion) */}
                {isExpanded && (
                  <div className="orders-accordion-panel">
                    <div className="orders-accordion-grid">
                      {/* 1. Shipping Lifecycle */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                        }}
                      >
                        <div className="orders-panel-col-title">
                          <span
                            className="material-symbols-outlined"
                            style={{ color: "var(--af-secondary)" }}
                          >
                            {isDelivered ? "done_all" : "route"}
                          </span>
                          <span>
                            {isDelivered
                              ? "Lịch sử giao nhận"
                              : "Tiến trình giao vận"}
                          </span>
                        </div>
                        <div className="orders-timeline-wrapper">
                          {order.status === "DELIVERY_FAILED" && (
                            <p className="orders-cod-note">Giao hàng chưa thành công. Tiến trình sẽ cập nhật nếu đơn được giao lại.</p>
                          )}
                          {history.length > 0 ? (
                            history.map((h, i) => (
                              <div key={i}>
                                <span className="orders-timeline-time">
                                  {h.at ? date(h.at) : ""}
                                </span>
                                : {cleanText(String(h.note || h.status))}
                              </div>
                            ))
                          ) : (
                            <>
                              <div>
                                <span className="orders-timeline-time">
                                  {order.createdAt
                                    ? date(order.createdAt)
                                    : "18/10"}
                                </span>
                                : Tiếp nhận đơn hàng tại xưởng Gói Huế.
                              </div>
                              {isShipped && (
                                <div>
                                  <span className="orders-timeline-time">
                                    Đang giao
                                  </span>
                                  : Bưu tá đang giao hàng tại khu vực địa chỉ
                                  nhận.
                                </div>
                              )}
                              {isDelivered && (
                                <div>
                                  <span className="orders-timeline-time">
                                    Đã nhận
                                  </span>
                                  : Người nhận đã ký nhận bưu kiện nguyên vẹn.
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* 2. Delivery Address */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.4rem",
                        }}
                      >
                        <div className="orders-panel-col-title">
                          <span
                            className="material-symbols-outlined"
                            style={{ color: "var(--af-secondary)" }}
                          >
                            location_on
                          </span>
                          <span>Địa chỉ giao hàng</span>
                        </div>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "var(--af-primary)",
                            fontSize: "14px",
                          }}
                        >
                          {cleanText(String(order.recipient || "Chưa có thông tin người nhận"))} •{" "}
                          {String(order.phone || "Chưa có số điện thoại")}
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            color: "var(--af-on-surface-variant)",
                            lineHeight: 1.5,
                          }}
                        >
                          {cleanText(
                            String(
                              order.address ||
                                "Chưa có địa chỉ giao hàng",
                            ),
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--af-outline)",
                            marginTop: "0.25rem",
                          }}
                        >
                          Phương thức: Giao tiết kiệm tiêu chuẩn
                          {order.trackingReference
                            ? ` (Mã vận đơn: ${order.trackingReference})`
                            : ""}
                        </div>
                      </div>

                      {/* 3. Price Breakdown */}
                      <div className="orders-price-breakdown-card">
                        <div
                          className="orders-panel-col-title"
                          style={{
                            marginBottom: "0.35rem",
                            borderBottom:
                              "1px solid var(--af-surface-container)",
                            paddingBottom: "0.35rem",
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ color: "var(--af-secondary)" }}
                          >
                            receipt
                          </span>
                          <span>Chi tiết thanh toán</span>
                        </div>
                        <div className="orders-price-row">
                          <span>Tạm tính tiền hàng:</span>
                          <span
                            style={{
                              color: "var(--af-primary)",
                              fontWeight: 500,
                            }}
                          >
                            {money(
                              Number(
                                order.subtotal ||
                                  Number(order.total) -
                                    (Number(order.shippingFee) || 0),
                              ),
                            )}
                          </span>
                        </div>
                        <div className="orders-price-row">
                          <span>Phí vận chuyển:</span>
                          <span
                            style={{
                              color:
                                Number(order.shippingFee) === 0
                                  ? "var(--af-secondary)"
                                  : "var(--af-primary)",
                              fontWeight: 500,
                            }}
                          >
                            {Number(order.shippingFee) === 0
                              ? "0 đ (Miễn phí)"
                              : money(Number(order.shippingFee) || 0)}
                          </span>
                        </div>
                        <div className="orders-price-row">
                          <span>Hình thức:</span>
                          <span
                            style={{
                              color: "var(--af-primary)",
                              fontWeight: 500,
                            }}
                          >
                            {order.paymentMethod === "VIETQR"
                              ? "Chuyển khoản VietQR"
                              : "Tiền mặt khi nhận hàng"}
                          </span>
                        </div>
                        {showCodAmount && codAmount < orderTotal && (
                          <div className="orders-price-row">
                            <span>Giảm khoản COD</span><span>−{money(orderTotal - codAmount)}</span>
                          </div>
                        )}
                        <div className="orders-price-row total-row">
                          <span>{amountLabel}</span>
                          <span className="total-amount">
                            {money(displayAmount)}
                          </span>
                        </div>
                        {isCod && isPaid && Boolean(order.paidAt) && (
                          <p className="orders-cod-note">Ghi nhận thu tiền lúc {date(order.paidAt)}</p>
                        )}
                      </div>
                    </div>
                    {order.paymentMethod === "VIETQR" && (
                      <div className="orders-vietqr">
                        <PaymentPanel order={order} />
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Editorial Pagination */}
      {filteredOrders.length > 0 && (
        <div className="orders-pagination-row">
          <div className="orders-pagination-info">
            Hiển thị{" "}
            <strong>
              {(activePage - 1) * pageSize + 1} -{" "}
              {Math.min(activePage * pageSize, filteredOrders.length)}
            </strong>{" "}
            trong tổng số <strong>{filteredOrders.length}</strong> đơn đặt quà
            Cố Đô
          </div>

          <nav
            className="orders-pagination-nav"
            aria-label="Phân trang đơn hàng"
          >
            <button
              type="button"
              className="orders-pagination-btn"
              disabled={activePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              title="Trang trước"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                className={`orders-pagination-btn ${activePage === p ? "active" : ""}`}
                onClick={() => setCurrentPage(p)}
              >
                {p}
              </button>
            ))}

            <button
              type="button"
              className="orders-pagination-btn"
              disabled={activePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              title="Trang kế tiếp"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </nav>
        </div>
      )}
      {payingOrder && <VietQrDialog key={payingOrder.id} order={payingOrder} open onClose={() => setPayOrderId(null)} />}
    </div>
  );
}

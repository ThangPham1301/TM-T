"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AddressBook, PasswordSettings } from "./account-settings";
import { PaymentPanel } from "./payment-panel";
import { OrderBadges, OrderTimeline } from "./order-presentation";
import { ProductImage } from "./product/product-image";
import styles from "./journey.module.css";
import { WorkspaceNav, Pagination } from "./workspace-nav";
import {
  api,
  fields,
  date,
  label,
  money,
  type Row,
  useStore,
} from "@/lib/store";

export function Account({
  section = "profile",
  admin = false,
}: {
  section?: string;
  admin?: boolean;
}) {
  const { state, loading, busy, run, mutate } = useStore(),
    [selected, setSelected] = useState<Row | null>(null),
    [files, setFiles] = useState<File[]>([]),
    [supplementFiles, setSupplementFiles] = useState<File[]>([]),
    [orderQuery, setOrderQuery] = useState(""),
    [orderStatus, setOrderStatus] = useState(""),
    [paymentStatus, setPaymentStatus] = useState(""),
    [orderPage, setOrderPage] = useState(1);
  const selectedFromUrl = useRef(false);
  const [returnLines, setReturnLines] = useState([{ id: 0, productId: "", reason: "DAMAGED" }]);
  const nextReturnLine = useRef(1);
  useEffect(() => {
    if (state && section === "orders" && !selectedFromUrl.current) {
      selectedFromUrl.current = true;
      const id = new URLSearchParams(window.location.search).get("order");
      const order = state.orders.find((o) => o.id === id);
      if (order) setSelected(order);
    }
  }, [state, section]);
  if (loading) return <main className="store-page">Đang tải tài khoản…</main>;
  if (!state)
    return (
      <main className="store-page">
        <h1>Tài khoản Gói Huế</h1>
        <Link href="/login">Vui lòng đăng nhập →</Link>
      </main>
    );
  if (admin && state.user.role !== "ADMIN")
    return (
      <main className="store-page">
        <h1>Không có quyền truy cập</h1>
        <Link href="/account">Về tài khoản</Link>
      </main>
    );
  const current = selected
    ? ([...state.orders, ...state.privacy, ...state.returns].find(
        (r) => r.id === selected.id,
      ) ?? selected)
    : null;
  const orderItems = (current?.items as Row[] | undefined) ?? [];
  const selectedProducts = returnLines.map((line) => line.productId || String(orderItems[0]?.productId ?? ""));
  const nextProduct = orderItems.find((item) => !selectedProducts.includes(String(item.productId)));
  const orderCount = (s: string) =>
    state.orders.filter((o) => o.status === s).length;
  const filteredOrders = state.orders.filter(
    (o) =>
      (!orderQuery ||
        `${o.number} ${o.recipient} ${o.phone}`
          .toLocaleLowerCase("vi")
          .includes(orderQuery.toLocaleLowerCase("vi"))) &&
      (!orderStatus || o.status === orderStatus) &&
      (!paymentStatus || o.paymentStatus === paymentStatus),
  );
  const visibleOrderPage = Math.min(
    orderPage,
    Math.max(1, Math.ceil(filteredOrders.length / 8)),
  );
  async function upload(filesToUpload: File[]) {
    const ids: string[] = [];
    for (const f of filesToUpload) {
      const intent = await api("evidence/intents", "POST", { name: f.name });
      const r = await fetch(`/api/store/evidence/${intent.id}/content`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/octet-stream" },
        body: f,
      });
      if (!r.ok) {
        const p = await r.json();
        throw new Error(p.message ?? "Không tải được ảnh.");
      }
      ids.push(intent.id);
    }
    return ids;
  }
  return (
    <main className="store-page">
      <div className="store-heading">
        <span className="eyebrow">
          {admin ? "Không gian quản trị" : "Tri kỷ Gói Huế"}
        </span>
        <h1>{admin ? "Quản lý cửa hàng" : "Tài khoản của tôi"}</h1>
        <p>
          {String(state.user.name)} · {String(state.user.email)}
        </p>
      </div>
      <WorkspaceNav admin={admin} section={section} />
      {section === "addresses" && state.user.role === "CUSTOMER" && <AddressBook />}
      {section === "security" && <PasswordSettings />}
      {section === "profile" && state.user.role === "CUSTOMER" && (
        <div className="store-two">
          <section className="store-card">
            <div className="store-profile-heading">
              <span aria-hidden="true">{String(state.user.name).charAt(0).toLocaleUpperCase("vi")}</span>
              <div><h2>Thông tin cá nhân</h2><p>{String(state.user.email)}</p></div>
            </div>
            <form
              className="store-form"
              onSubmit={(e) => {
                const b = fields(e);
                void run(async () => {
                  await mutate("command", "profile", b);
                });
              }}
            >
              <label>
                Họ tên
                <input
                  name="name"
                  defaultValue={String(state.user.name)}
                  required
                  maxLength={100}
                />
              </label>
              <label>
                Điện thoại
                <input
                  name="phone"
                  defaultValue={String(state.user.phone)}
                  maxLength={30}
                />
              </label>
              <label>
                Địa chỉ
                <textarea
                  name="address"
                  defaultValue={String(state.user.address)}
                  maxLength={400}
                />
              </label>
              <button disabled={busy}>Lưu thông tin</button>
            </form>
          </section>
          <section className="store-card">
            <h2>Lựa chọn tiếp thị</h2>
            <label className="store-check">
              <input
                type="checkbox"
                checked={Boolean(state.user.marketing)}
                disabled={busy}
                onChange={(e) =>
                  void run(async () => {
                    await mutate("command", "consent", {
                      granted: e.target.checked,
                    });
                  })
                }
              />
              Tôi đồng ý nhận ưu đãi qua email
            </label>
            <p>
              Có thể rút lại bất cứ lúc nào. Hệ thống ghi nhận lựa chọn; dịch vụ
              gửi email đang chờ kết nối.
            </p>
            <details>
              <summary>Lịch sử lựa chọn</summary>
              {state.consents.map((c) => (
                <p key={c.id}>
                  {date(c.createdAt)} · {c.granted ? "Đồng ý" : "Rút đồng ý"} ·{" "}
                  {String(c.policyVersion)}
                </p>
              ))}
            </details>
          </section>
        </div>
      )}
      {section === "profile" && state.user.role === "ADMIN" && <PasswordSettings />}
      {section === "privacy" && (
        <div className="store-two">
          {!admin && (
            <section className="store-card">
              <h2>Gửi yêu cầu về dữ liệu</h2>
              <form
                className="store-form"
                onSubmit={(e) => {
                  const b = fields(e);
                  void run(async () => {
                    await mutate("command", "privacy-create", b);
                  });
                }}
              >
                <label>
                  Loại yêu cầu
                  <select name="type">
                    {[
                      "ACCESS",
                      "EXPORT",
                      "DELETE",
                      "RESTRICT",
                      "COMPLAINT",
                    ].map((x) => (
                      <option key={x} value={x}>
                        {label(x)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nội dung
                  <textarea name="description" required maxLength={2000} />
                </label>
                <p className="store-warning">
                  Yêu cầu xóa được xem xét trước khi thực hiện. Tài khoản sẽ bị
                  đóng; dữ liệu giao dịch cần giữ sẽ được giải thích trong kết
                  quả.
                </p>
                <button disabled={busy}>Gửi yêu cầu</button>
              </form>
            </section>
          )}
          <section className="store-card">
            <h2>Hồ sơ dữ liệu</h2>
            {!state.privacy.length && <p>Chưa có yêu cầu.</p>}
            {state.privacy.map((r) => (
              <button
                className="store-row"
                key={r.id}
                onClick={() => setSelected(r)}
              >
                <strong>{label(r.type)}</strong>
                <span>{label(r.status)}</span>
                <small>
                  {date(r.createdAt)} · {r.id.slice(0, 8)}
                </small>
              </button>
            ))}
          </section>
        </div>
      )}
      {section === "orders" && (
        <section className="store-card">
          <h2>{admin ? "Đơn hàng cửa hàng" : "Đơn hàng của tôi"}</h2>
          {admin && state.orders.length > 0 && (
            <div className={styles.kpiStrip} aria-label="Tình hình đơn hàng">
              <span className={styles.kpiScope}>
                Tình hình đơn hàng · Toàn bộ đơn
              </span>
              {[
                ["Tổng đơn", state.orders.length],
                ["Chờ xác nhận", orderCount("PLACED")],
                ["Đang đóng gói", orderCount("PACKED")],
                ["Đang giao", orderCount("SHIPPED")],
                ["Đã giao", orderCount("DELIVERED")],
              ].map(([labelText, value]) => (
                <span className={styles.kpiItem} key={labelText}>
                  <span className={styles.kpiValue}>{value}</span>
                  <span className={styles.kpiLabel}>{labelText}</span>
                </span>
              ))}
            </div>
          )}
          <div className="store-filters">
            <label>
              Tìm mã đơn/người nhận/điện thoại
              <input
                value={orderQuery}
                onChange={(e) => {
                  setOrderQuery(e.target.value);
                  setOrderPage(1);
                }}
              />
            </label>
            <label>
              Trạng thái đơn
              <select
                value={orderStatus}
                onChange={(e) => {
                  setOrderStatus(e.target.value);
                  setOrderPage(1);
                }}
              >
                <option value="">Tất cả</option>
                {[
                  "PLACED",
                  "CONFIRMED",
                  "PACKED",
                  "SHIPPED",
                  "DELIVERED",
                  "DELIVERY_FAILED",
                  "RETURNED",
                  "CANCELLED",
                ].map((s) => (
                  <option value={s} key={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Thanh toán
              <select
                value={paymentStatus}
                onChange={(e) => {
                  setPaymentStatus(e.target.value);
                  setOrderPage(1);
                }}
              >
                <option value="">Tất cả</option>
                <option value="UNPAID">Chưa thu tiền</option>
                <option value="PAID">Đã thu tiền</option>
              </select>
            </label>
          </div>
          {!state.orders.length && (
            <p>
              Chưa có đơn hàng.{" "}
              <Link href="/products">Khám phá bộ sưu tập</Link>
            </p>
          )}
          {filteredOrders
            .slice((visibleOrderPage - 1) * 8, visibleOrderPage * 8)
            .map((o) => (
              <button
                className="store-row"
                key={o.id}
                onClick={() => {
                  setReturnLines([{ id: 0, productId: "", reason: "DAMAGED" }]);
                  setFiles([]);
                  setSelected(o);
                }}
              >
                {((o.items as Row[] | undefined) ?? []).length > 0 && (
                  <span className={styles.thumbRow}>
                    {((o.items as Row[] | undefined) ?? [])
                      .slice(0, 3)
                      .map((line, i) => (
                        <ProductImage
                          key={i}
                          src={String(line.image ?? "")}
                          alt=""
                          width={40}
                          height={40}
                          className={styles.thumb}
                        />
                      ))}
                  </span>
                )}
                <strong>
                  {String(o.number)} · {money(o.total)}
                </strong>
                <OrderBadges order={o} />
                <small>{date(o.createdAt)}</small>
              </button>
            ))}
          {state.orders.length > 0 && filteredOrders.length === 0 && (
            <p>Không có đơn phù hợp bộ lọc.</p>
          )}
          <Pagination
            page={visibleOrderPage}
            total={filteredOrders.length}
            pageSize={8}
            onChange={setOrderPage}
          />
        </section>
      )}
      {section === "returns" && (
        <section className="store-card">
          <h2>Yêu cầu đổi trả</h2>
          {!state.returns.length && (
            <div className="store-empty">
              <p>Chưa có yêu cầu đổi trả.</p>
              {!admin && <Link href="/account/orders">Mở đơn đã giao để gửi yêu cầu</Link>}
            </div>
          )}
          {state.returns.filter((r, i, rows) => !r.caseId || rows.findIndex((row) => row.caseId === r.caseId) === i).map((r) => {
            const lines = r.caseId ? state.returns.filter((row) => row.caseId === r.caseId) : [r];
            const closed = lines.every((row) => ["RESOLVED", "REJECTED", "WITHDRAWN"].includes(String(row.status)));
            const fulfilled = lines.filter((row) => row.status === "RESOLVED");
            const partial = fulfilled.length > 0 && (fulfilled.length < lines.length || fulfilled.some((row) => Number(row.approvedQuantity ?? row.quantity) < Number(row.quantity)));
            return (
            <button
              key={r.id}
              className="store-row"
              onClick={() => setSelected(r)}
            >
              <strong>
                {String(r.orderNumber)} · {lines.length > 1 ? `${lines.length} dòng hàng` : String(r.product)}
              </strong>
              <span>
                {label(r.reason)} · {String(r.quantity)} sản phẩm
              </span>
              <span className="store-status-chip">{closed && partial ? "Hoàn tất một phần" : lines.length === 1 ? label(r.status) : closed ? "Đã đóng hồ sơ" : "Đang xử lý"}</span>
              <small>{date(r.createdAt)}</small>
            </button>
            );
          })}
        </section>
      )}
      {section === "policies" && admin && (
        <section className="store-card">
          <h2>Chính sách bảo mật</h2>
          <p className="store-warning">
            Phiên bản dự thảo chờ phê duyệt; lưu phiên bản mới không tự biến
            thành chính sách có hiệu lực.
          </p>
          <form
            className="store-form"
            onSubmit={(e) => {
              const b = fields(e);
              void run(async () => {
                await mutate("command", "policy", b);
              });
            }}
          >
            <label>
              Phiên bản
              <input
                name="version"
                placeholder="1.1-draft"
                required
                maxLength={40}
              />
            </label>
            <label>
              Nội dung
              <textarea
                name="content"
                rows={18}
                defaultValue={String(state.policy.content)}
                required
                maxLength={16000}
              />
            </label>
            <button disabled={busy}>Lưu phiên bản mới</button>
          </form>
          <details>
            <summary>Lịch sử phiên bản</summary>
            {state.policyVersions?.map((p) => (
              <details key={p.id}>
                <summary>
                  {String(p.version)} · {date(p.createdAt)}
                </summary>
                <div className="store-policy">{String(p.content)}</div>
              </details>
            ))}
          </details>
        </section>
      )}
      {section === "audit" && admin && (
        <section className="store-card">
          <h2>Nhật ký thao tác</h2>
          {state.audit?.map((a, i) => (
            <div className="store-row" key={String(a.id ?? i)}>
              <strong>{String(a.action)}</strong>
              <small>
                {date(a.at)} · {String(a.subject)}
              </small>
            </div>
          ))}
        </section>
      )}
      {current && (
        <section className="store-card store-detail">
          <button className="store-close" onClick={() => setSelected(null)}>
            Đóng chi tiết ×
          </button>
          <>
            <h2>
              {current.type
                ? label(current.type)
                : String(current.number ?? current.orderNumber)}
            </h2>
            {current.items != null ? (
              <OrderBadges order={current} />
            ) : (
              <p className="store-badge">{label(current.status)}</p>
            )}
            <p>Mã hồ sơ: {current.id}</p>
            {current.items != null ? (
              <>
                <OrderTimeline order={current} />
                <p>
                  {String(current.recipient)} · {String(current.phone)}
                </p>
                <p>{String(current.address)}</p>
                {(current.items as Row[]).map((line, i) => (
                  <p key={i} className={styles.detailItem}>
                    <ProductImage
                      src={String(line.image ?? "")}
                      alt=""
                      width={44}
                      height={44}
                      className={styles.thumb}
                    />
                    <span>
                      {String(line.name)} · {String(line.quantity)} ×{" "}
                      {money(line.price)}
                    </span>
                  </p>
                ))}
                <p>
                  Tiền hàng {money(current.subtotal)} · Giao hàng{" "}
                  {money(current.shippingFee)} ·{" "}
                  <strong>Tổng {money(current.total)}</strong>
                </p>
                <PaymentPanel order={current} />
                {Boolean(current.paymentReference) && (
                  <p>
                    Biên nhận thu tiền: {String(current.paymentReference)} ·{" "}
                    {date(current.paidAt)}
                  </p>
                )}
                {Boolean(current.deliveredAt) && (
                  <p>Giao thành công lúc: {date(current.deliveredAt)}</p>
                )}
                {Boolean(current.trackingReference) && (
                  <p>Vận đơn: {String(current.trackingReference)}</p>
                )}
                {["PLACED", "CONFIRMED"].includes(String(current.status)) && (
                  <details>
                    <summary>
                      Sửa thông tin nhận hàng trước khi đóng gói
                    </summary>
                    <form
                      key={`recipient-${current.revision}`}
                      className="store-form"
                      onSubmit={(e) => {
                        const b = fields(e);
                        if (
                          !window.confirm(
                            "Lưu thông tin nhận hàng mới cho đơn này?",
                          )
                        )
                          return;
                        void run(async () => {
                          await mutate("commerce", "order-recipient", {
                            ...b,
                            id: current.id,
                            revision: current.revision,
                          });
                        });
                      }}
                    >
                      <label>
                        Người nhận
                        <input
                          name="recipient"
                          defaultValue={String(current.recipient)}
                          required
                          maxLength={100}
                        />
                      </label>
                      <label>
                        Điện thoại
                        <input
                          name="phone"
                          defaultValue={String(current.phone)}
                          required
                          maxLength={30}
                        />
                      </label>
                      <label>
                        Địa chỉ
                        <textarea
                          name="address"
                          defaultValue={String(current.address)}
                          required
                          maxLength={400}
                        />
                      </label>
                      <label>
                        Lý do thay đổi
                        <input name="note" required maxLength={2000} />
                      </label>
                      <button disabled={busy}>Lưu thông tin nhận</button>
                    </form>
                  </details>
                )}
                {!admin &&
                  ["PLACED", "CONFIRMED"].includes(String(current.status)) &&
                  current.paymentStatus !== "PAID" && (
                    <form
                      className="store-form"
                      onSubmit={(e) => {
                        const b = fields(e);
                        if (
                          !window.confirm(
                            `Hủy đơn ${current.number}? Tồn kho sẽ được hoàn lại khi hủy thành công.`,
                          )
                        )
                          return;
                        void run(async () => {
                          await mutate("commerce", "order-cancel", {
                            ...b,
                            id: current.id,
                            revision: current.revision,
                          });
                        });
                      }}
                    >
                      <label>
                        Lý do hủy
                        <input name="note" required maxLength={2000} />
                      </label>
                      <button disabled={busy}>Hủy đơn hàng</button>
                    </form>
                  )}
                {admin && (
                  <OrderAction
                    key={current.id + String(current.revision)}
                    row={current}
                    busy={busy}
                    onSave={(b) =>
                      void run(async () => {
                        await mutate("commerce", String(b.action), {
                          ...b,
                          id: current.id,
                          revision: current.revision,
                        });
                      })
                    }
                  />
                )}
                {!admin && current.status === "DELIVERED" && (
                  <form key={current.id}
                    className="store-form store-return-form"
                    onSubmit={(e) => {
                      const b = fields(e);
                      void run(async () => {
                        const evidenceIds = await upload(files);
                        const r = await mutate("command", "return-submit", {
                          orderId: current.id,
                          items: returnLines.map(({ id: i }) => ({ lineId: b[`lineId-${i}`], quantity: Number(b[`quantity-${i}`]), reason: b[`reason-${i}`], resolution: b[`resolution-${i}`], description: b[`description-${i}`] })),
                          evidenceIds,
                        });
                        setSelected(r);
                        setFiles([]);
                        setReturnLines([{ id: 0, productId: "", reason: "DAMAGED" }]);
                      });
                    }}
                  >
                    <div><h3>Yêu cầu đổi trả</h3><p className="store-subtle">Chọn sản phẩm trong đơn và mô tả vấn đề để cửa hàng xem xét.</p></div>
                    {returnLines.map(({ id: line, reason }, index) => <fieldset className="store-return-line" key={line}>
                    <legend>Món cần xử lý</legend>
                    <label>
                      Sản phẩm
                      <select name={`lineId-${line}`} value={selectedProducts[index]} required onChange={(event) => {
                        const productId = event.target.value;
                        setReturnLines(returnLines.map((row) => row.id === line ? { ...row, productId } : row));
                      }}>
                        {orderItems.filter((item) => String(item.productId) === selectedProducts[index] || !selectedProducts.includes(String(item.productId))).map((l, i) => (
                          <option key={i} value={String(l.productId)}>
                            {String(l.name)} (đã mua {String(l.quantity)})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Số lượng
                      <input
                        name={`quantity-${line}`}
                        type="number"
                        min={1}
                        max={Number(orderItems.find((item) => String(item.productId) === selectedProducts[index])?.quantity ?? 1)}
                        defaultValue={1}
                        required
                      />
                    </label>
                    <label>
                      Lý do
                      <select name={`reason-${line}`} value={reason} onChange={(event) => {
                        const reason = event.target.value;
                        setReturnLines(returnLines.map((row) => row.id === line ? { ...row, reason } : row));
                      }}>
                        {[
                          "DAMAGED",
                          "WRONG_ITEM",
                          "MISSING_ITEM",
                          "UNSAFE",
                          "QUALITY",
                          "NOT_RECEIVED",
                          "CHANGE_OF_MIND",
                        ].map((s) => (
                          <option key={s} value={s}>
                            {label(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Mong muốn
                      <select key={missingReturnItem(reason) ? "missing" : "received"} name={`resolution-${line}`}>
                        <option value={missingReturnItem(reason) ? "MAKE_UP" : "REPLACEMENT"}>{missingReturnItem(reason) ? "Giao bù" : "Đổi hàng"}</option>
                        <option value="REFUND">Hoàn tiền</option>
                      </select>
                    </label>
                    <label>
                      Nội dung
                      <textarea name={`description-${line}`} required maxLength={2000} />
                    </label>
                    {returnLines.length > 1 && <button type="button" onClick={() => setReturnLines(returnLines.filter((row) => row.id !== line))}>Bỏ dòng</button>}
                    </fieldset>)}
                    <button type="button" disabled={!nextProduct || returnLines.length >= 50} onClick={() => {
                      if (nextProduct) setReturnLines([...returnLines, { id: nextReturnLine.current++, productId: String(nextProduct.productId), reason: "DAMAGED" }]);
                    }}>Thêm dòng sản phẩm</button>
                    <label>
                      Ảnh PNG/JPEG (tối đa 5 ảnh, 5 MB/ảnh)
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        multiple
                        onChange={(e) => {
                          const f = Array.from(e.target.files ?? []);
                          if (
                            f.length > 5 ||
                            f.some((x) => x.size > 5 * 1024 * 1024)
                          ) {
                            e.target.value = "";
                            setFiles([]);
                          } else setFiles(f);
                        }}
                      />
                    </label>
                    {files.length > 0 && <p className="store-subtle">{files.map((file) => file.name).join(", ")}</p>}
                    <button className="primary-button" disabled={busy}>Gửi yêu cầu đổi trả</button>
                  </form>
                )}
              </>
            ) : (
              <>
                <p>{String(current.description ?? "")}</p>
                {Boolean(current.result) && (
                  <p className="store-warning">{String(current.result)}</p>
                )}
                {!current.type && (
                  <>
                    {Boolean(current.caseId) && <div className="store-row-actions" aria-label="Các món trong hồ sơ">{state.returns.filter((row) => row.caseId === current.caseId).map((row) => <button key={row.id} onClick={() => setSelected(row)} aria-pressed={row.id === current.id}>{String(row.product)} · {label(row.status)}</button>)}</div>}
                    {Boolean(current.replacementTracking) && <p>Vận đơn hàng thay thế: {String(current.replacementTracking)}</p>}
                    {current.receivedQuantity != null && <p>Đã nhận hàng trả: {String(current.receivedQuantity)}</p>}
                    {current.status === "CUSTOMER_CONFIRMATION" && <p>Phương án đề xuất: {label(current.resolution)} cho {String(current.proposedQuantity)} sản phẩm.</p>}
                    {!admin && ["REQUESTED","REVIEWING","EVIDENCE_REQUIRED","CUSTOMER_CONFIRMATION"].includes(String(current.status)) && <div className="store-row-actions">{(current.status === "CUSTOMER_CONFIRMATION" ? ["return-confirm","return-withdraw"] : ["return-withdraw"]).map((action) => <button key={action} disabled={busy} onClick={() => { const note = action === "return-confirm" ? "Khách đồng ý phương án." : "Khách rút yêu cầu."; if (window.confirm(note)) void run(async () => { await mutate("command", action, {id: current.id, revision: current.revision, note}); }); }}>{action === "return-confirm" ? "Đồng ý phương án" : "Rút yêu cầu cho món này"}</button>)}</div>}
                    <p>
                      Sản phẩm: {String(current.product)} · Yêu cầu{" "}
                      {String(current.quantity)} · Duyệt{" "}
                      {String(current.approvedQuantity ?? "Chưa duyệt")}
                    </p>
                    <p>
                      {label(current.resolution)} · {money(current.amount)} ·{" "}
                      {label(current.fulfillment)}
                    </p>
                    <p>Hàng trả: {label(current.goods)}</p>
                    {Boolean(current.operationReference) && (
                      <p>
                        Chứng từ/vận đơn kết quả:{" "}
                        {String(current.operationReference)}
                      </p>
                    )}
                    {((current.evidenceIds as string[]) ?? []).length > 0 && (
                      <div
                        className="store-evidence-gallery"
                        aria-label="Ảnh bằng chứng"
                      >
                        {((current.evidenceIds as string[]) ?? []).map(
                          (id, index) => (
                            <a
                              key={id}
                              href={`/api/store/evidence/${id}/content`}
                              target="_blank"
                              rel="noreferrer"
                              title={`Xem ảnh bằng chứng ${index + 1}`}
                            >
                              <img
                                src={`/api/store/evidence/${id}/content`}
                                alt={`Ảnh bằng chứng ${index + 1}`}
                              />
                              <span>Xem ảnh {index + 1}</span>
                            </a>
                          ),
                        )}
                      </div>
                    )}
                  </>
                )}
                {current.export != null && (
                  <a
                    className="store-file"
                    href={`/api/store/privacy/${current.id}/export`}
                  >
                    Tải dữ liệu của tôi (JSON)
                  </a>
                )}
                {!admin &&
                  (current.type
                    ? !["COMPLETED", "RESOLVED", "REJECTED", "WITHDRAWN"].includes(String(current.status))
                    : current.status === "EVIDENCE_REQUIRED") && (
                    <form
                      className="store-form"
                      onSubmit={(e) => {
                        const b = fields(e);
                        void run(async () => {
                          const evidenceIds = current.type
                            ? []
                            : await upload(supplementFiles);
                          await mutate(
                            "command",
                            current.type
                              ? "privacy-supplement"
                              : "return-supplement",
                            {
                              ...b,
                              id: current.id,
                              revision: current.revision,
                              evidenceIds,
                            },
                          );
                          setSupplementFiles([]);
                        });
                      }}
                    >
                      <label>
                        Bổ sung thông tin
                        <textarea name="note" required maxLength={2000} />
                      </label>
                      {!current.type && (
                        <label>
                          Ảnh bổ sung PNG/JPEG (tối đa 5 MB/ảnh)
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
                            multiple
                            onChange={(e) => {
                              const selectedFiles = Array.from(
                                e.target.files ?? [],
                              );
                              const alreadyAttached = (
                                (current.evidenceIds as string[]) ?? []
                              ).length;
                              if (
                                selectedFiles.length + alreadyAttached > 5 ||
                                selectedFiles.some(
                                  (file) =>
                                    file.size > 5 * 1024 * 1024 ||
                                    !["image/png", "image/jpeg"].includes(
                                      file.type,
                                    ),
                                )
                              ) {
                                e.target.value = "";
                                setSupplementFiles([]);
                              } else setSupplementFiles(selectedFiles);
                            }}
                          />
                          <small>
                            Còn{" "}
                            {Math.max(
                              0,
                              5 -
                                ((current.evidenceIds as string[]) ?? [])
                                  .length,
                            )}{" "}
                            ảnh có thể đính kèm.
                          </small>
                        </label>
                      )}
                      {!current.type && supplementFiles.length > 0 && (
                        <p className="store-subtle">
                          Đã chọn:{" "}
                          {supplementFiles.map((file) => file.name).join(", ")}
                        </p>
                      )}
                      <button disabled={busy}>Gửi bổ sung</button>
                    </form>
                  )}
                {admin && (
                  <CaseAction
                    key={current.id + String(current.revision)}
                    row={current}
                    paymentStatus={state.orders.find((order) => order.id === current.orderId)?.paymentStatus}
                    onSave={(b) =>
                      void run(async () => {
                        await mutate(
                          "command",
                          current.type ? "privacy-update" : "return-update",
                          {
                            ...b,
                            id: current.id,
                            revision: current.revision,
                          },
                        );
                      })
                    }
                    busy={busy}
                  />
                )}
              </>
            )}
            <h3>Lịch sử xử lý</h3>
            <ol className="store-timeline">
              {((current.history as Row[]) ?? []).map((h, i) => (
                <li key={i}>
                  <strong>{label(h.status)}</strong>
                  <small>{date(h.at)}</small>
                  <p>{String(h.note)}</p>
                </li>
              ))}
            </ol>
          </>
        </section>
      )}
    </main>
  );
}

function OrderAction({
  row,
  busy,
  onSave,
}: {
  row: Row;
  busy: boolean;
  onSave: (b: Record<string, unknown>) => void;
}) {
  const nextOptions = (
    {
      PLACED: ["CONFIRMED"],
      CONFIRMED: ["PACKED"],
      PACKED: ["SHIPPED"],
      SHIPPED: ["DELIVERED", "DELIVERY_FAILED"],
      DELIVERY_FAILED: ["SHIPPED", "RETURNED"],
    } as Record<string, string[]>
  )[String(row.status)] ?? [];
  const actions = [
    ...(row.paymentStatus === "REVIEW" ? ["payment-resolve"] : []),
    ...(nextOptions.length ? ["order-status"] : []),
    ...(row.paymentStatus !== "PAID" && row.status !== "CANCELLED"
      ? ["order-paid"]
      : []),
    ...(["PLACED", "CONFIRMED"].includes(String(row.status)) &&
    row.paymentStatus !== "PAID"
      ? ["order-cancel"]
      : []),
  ];
  const [action, setAction] = useState(actions[0] ?? "");
  const [next, setNext] = useState(nextOptions[0] ?? "");
  const nextValue = nextOptions.includes(next)
    ? next
    : (nextOptions[0] ?? "");
  if (!actions.length)
    return <p>Không còn thao tác xử lý trực tiếp cho đơn này.</p>;
  const title =
    action === "payment-resolve"
      ? "Xử lý đối soát thanh toán (REVIEW)"
      : action === "order-status"
        ? `Chuyển sang ${label(nextValue)}`
        : action === "order-paid"
          ? "Xác nhận đã thu tiền"
          : "Hủy đơn đủ điều kiện";
  return (
    <form
      className="store-form"
      onSubmit={(e) => {
        const b = fields(e);
        if (window.confirm(`${title} cho đơn ${row.number}?`))
          onSave({ ...b, status: nextValue });
      }}
    >
      <h3>Xử lý đơn hàng</h3>
      <label>
        Thao tác
        <select
          name="action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        >
          {actions.map((a) => (
            <option key={a} value={a}>
              {a === "payment-resolve"
                ? "Đối soát thanh toán (REVIEW)"
                : a === "order-status"
                  ? `Chuyển sang ${label(nextValue)}`
                  : a === "order-paid"
                    ? "Xác nhận đã thu tiền"
                    : "Hủy đơn"}
            </option>
          ))}
        </select>
      </label>
      {action === "order-status" && nextOptions.length > 1 && (
        <label>
          Trạng thái tiếp theo
          <select
            value={nextValue}
            onChange={(e) => setNext(e.target.value)}
          >
            {nextOptions.map((s) => (
              <option value={s} key={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
      )}
      {action === "payment-resolve" && (
        <label>
          Kết quả đối soát
          <select name="resolution">
            <option value="PAID_RECORDED">
              Ghi nhận đã thu tiền — giữ đơn, tiếp tục xử lý
            </option>
            <option value="REFUNDED">
              Hoàn tiền cho khách (qua kênh ngoài hệ thống)
            </option>
          </select>
        </label>
      )}
      {(action === "order-paid" ||
        action === "payment-resolve" ||
        (action === "order-status" && nextValue === "SHIPPED")) && (
        <label>
          {action === "order-paid"
            ? "Mã chứng từ thu tiền"
            : action === "payment-resolve"
              ? "Mã chứng từ xử lý (biên nhận hoàn / đối soát)"
              : "Mã vận đơn"}
          <input name="reference" required maxLength={200} />
        </label>
      )}
      <label>
        Ghi chú
        <textarea name="note" required maxLength={2000} />
      </label>
      <p className="store-subtle">
        Chỉ xác nhận khi có bằng chứng thực tế. Giao vận và thu tiền đang được
        ghi nhận thủ công.
      </p>
      <button disabled={busy}>Xác nhận xử lý</button>
    </form>
  );
}

function missingReturnItem(reason: unknown) {
  return reason === "MISSING_ITEM" || reason === "NOT_RECEIVED";
}

function CaseAction({
  row,
  paymentStatus,
  busy,
  onSave,
}: {
  row: Row;
  busy: boolean;
  paymentStatus?: unknown;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const missing = missingReturnItem(row.reason);
  const shipment = ["REPLACEMENT", "MAKE_UP"].includes(String(row.resolution));
  const financial = ["REFUND", "ADJUST_DUE"].includes(String(row.resolution));
  const options: Record<string, string[]> = row.type
    ? {
        SUBMITTED: ["REVIEWING"],
        REVIEWING: ["EVIDENCE_REQUIRED", "COMPLETED", "REJECTED"],
        EVIDENCE_REQUIRED: ["REVIEWING"],
      }
    : {
        REQUESTED: ["REVIEWING"],
        REVIEWING: ["EVIDENCE_REQUIRED", "APPROVED", "REJECTED"],
        EVIDENCE_REQUIRED: ["REVIEWING"],
        APPROVED: [row.goods === "NOT_REQUIRED" ? "PROCESSING" : "RECEIVED", "WAITING_STOCK", "PAYMENT_REVIEW", "EXCEPTION"],
        RECEIVED: ["INSPECTED", "EXCEPTION"],
        INSPECTED: ["PROCESSING", "EXCEPTION", "PAYMENT_REVIEW"],
        PROCESSING: [row.caseId && ["REPLACEMENT","MAKE_UP"].includes(String(row.resolution)) ? "REPLACEMENT_SENT" : "RESOLVED", "EXCEPTION", "PAYMENT_REVIEW"],
        REPLACEMENT_SENT: ["RESOLVED", "EXCEPTION"],
        WAITING_STOCK: row.resumeStatus === "APPROVED" && row.goods === "NOT_REQUIRED" ? ["RESUME", "APPROVED"] : ["RESUME"],
        PAYMENT_REVIEW: row.resumeStatus === "APPROVED" && row.goods === "NOT_REQUIRED" ? ["RESUME", "APPROVED"] : ["RESUME"],
        EXCEPTION: ["RESUME"],
      };
  const paymentBlocked = row.resolution === "REFUND" ? paymentStatus !== "PAID" : row.resolution === "ADJUST_DUE" && paymentStatus === "PAID";
  const next = (options[String(row.status)] ?? []).filter((step) =>
    (step !== "WAITING_STOCK" || shipment) && (step !== "PAYMENT_REVIEW" || financial) &&
    (!paymentBlocked || !["PROCESSING", "RESOLVED"].includes(step)),
  );
  const [selection, setTarget] = useState("");
  const target = next.includes(selection) ? selection : next[0];
  if (!next.length) return null;
  return (
    <form
      className="store-form"
      onSubmit={(e) => {
        const b = fields(e);
        onSave({
          ...b,
          approvedQuantity: Number(b.approvedQuantity ?? 0),
          returnRequired: b.returnRequired === "on",
        });
      }}
    >
      <h3>Xử lý hồ sơ</h3>
      {paymentBlocked && <p className="store-warning">{row.resolution === "REFUND" ? "Cần xác nhận đã thu tiền trước khi hoàn." : "Đơn đã thu tiền. Cần chuyển sang phương án hoàn tiền."}</p>}
      <label>
        Bước tiếp theo
        <select
          name="status"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          {next.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
      </label>
      {target === "APPROVED" && (
        <>
          <label>
            Số lượng duyệt
            <input
              name="approvedQuantity"
              type="number"
              min={1}
              max={Number(row.approvedQuantity ?? row.quantity)}
              defaultValue={Number(row.approvedQuantity ?? row.quantity)}
              required
            />
          </label>
          <label>
            Phương án
            <select name="resolution" defaultValue={String(row.resolution)}>
              <option value="REFUND">Hoàn tiền</option>
              {!missing && <option value="REPLACEMENT">Đổi hàng</option>}
              {missing && <option value="MAKE_UP">Giao bù</option>}
              <option value="ADJUST_DUE">Điều chỉnh khoản phải thu</option>
            </select>
          </label>
          {!missing && <label className="store-check">
            <input name="returnRequired" type="checkbox" />
            Cần thu hồi hàng
          </label>}
        </>
      )}
      {target === "RECEIVED" && <label>Số lượng thực nhận<input name="receivedQuantity" type="number" required min={0} max={Number(row.approvedQuantity)} defaultValue={Number(row.approvedQuantity)} /></label>}
      {target === "INSPECTED" && <label>Số lượng đạt kiểm hàng<input name="inspectedQuantity" type="number" required min={1} max={Number(row.receivedQuantity ?? row.approvedQuantity)} defaultValue={Number(row.receivedQuantity ?? row.approvedQuantity)} /></label>}
      {target === "INSPECTED" && (
        <label>
          Phân loại
          <select name="disposition">
            {["QUARANTINE", "DAMAGED", "DISPOSE"].map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
      )}
      {["RESOLVED","REPLACEMENT_SENT"].includes(target) && (
        <label>
          {target === "REPLACEMENT_SENT" ? "Mã vận đơn gửi hàng" : "Mã chứng từ xác nhận kết quả"}
          <input name="reference" required maxLength={200} />
        </label>
      )}
      {row.type === "DELETE" && target === "COMPLETED" && (
        <p className="store-warning">
          Tài khoản khách sẽ bị đóng, phiên bị hủy và dữ liệu được xử lý theo
          phạm vi chính sách.
        </p>
      )}
      <label>
        Lý do/kết quả
        <textarea name="note" required maxLength={2000} />
      </label>
      <button disabled={busy}>Xác nhận xử lý</button>
    </form>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PasswordSettings } from "./account-settings";
import { useCurrentTime } from "@/lib/use-current-time";
import { AccountProfile } from "./account-profile";
import { AccountAddresses } from "./account-addresses";
import { AccountSecurity } from "./account-security";
import { AccountPrivacy } from "./account-privacy";
import { AccountOrders } from "./account-orders";
import { AdminOrders } from "./admin-orders";
import { AdminCodPayment, AdminOrderPayment } from "./admin-order-payment";
import { codAmountDue, codNeedsReceipt, isCodOrder, matchesPaymentFilter, orderPaymentStatus } from "@/lib/order-payment";
import { AdminPrivacy } from "./admin-privacy";
import { accountNavigation } from "@/shared/layout/navigation";
import { PaymentPanel } from "./payment-panel";
import { OrderBadges, OrderTimeline } from "./order-presentation";
import { ReturnRequestForm, getReturnableProducts } from "./return-request-form";
import { ProductImage } from "./product/product-image";
import styles from "./journey.module.css";
import { WorkspaceNav, Pagination } from "./workspace-nav";
import { ReturnQueue, PolicyEditor, AuditLog, OperationsWorkspace, EvidencePreview } from "./operations";
import {
  api,
  fields,
  cleanText,
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
  const { state, loading, busy, run, mutate, logout } = useStore(),
    [selected, setSelected] = useState<Row | null>(null),
    [returnOrderId, setReturnOrderId] = useState<string | null>(null),
    [files, setFiles] = useState<File[]>([]),
    [supplementFiles, setSupplementFiles] = useState<File[]>([]),
    [orderQuery, setOrderQuery] = useState(""),
    [orderStatus, setOrderStatus] = useState(""),
    [paymentStatus, setPaymentStatus] = useState(""),
    [orderPage, setOrderPage] = useState(1);
  const selectedFromUrl = useRef(false);
  const [returnLines, setReturnLines] = useState([{ id: 0, productId: "", reason: "DAMAGED" }]);
  const nextReturnLine = useRef(1);
  const now = useCurrentTime();
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
    if (active && state && section === "orders" && !selectedFromUrl.current) {
      selectedFromUrl.current = true;
      const id = new URLSearchParams(window.location.search).get("order");
      const order = state.orders.find((o) => o.id === id);
      if (order) setSelected(order);
    }
    });
    return () => { active = false; };
  }, [state, section]);
  const openedInitialReturn = useRef(false);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
    if (!active || section !== "returns" || !state || openedInitialReturn.current) return;
    openedInitialReturn.current = true;
    const firstOpen = state.returns.find(
      (row) => !["RESOLVED", "REJECTED", "WITHDRAWN"].includes(String(row.status)),
    );
    if (firstOpen) setSelected(firstOpen);
    });
    return () => { active = false; };
  }, [section, state]);
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
  const linkedReturnOrder = section === "returns" && current
    ? state.orders.find((order) => order.id === current.orderId)
    : undefined;
  const linkedReturnItem = (linkedReturnOrder?.items as Row[] | undefined)?.find(
    (item) => item.productId === current?.lineId,
  );
  const deliveredOrders = section === "returns" && !admin
    ? state.orders.filter((order) => order.status === "DELIVERED")
    : [];
  const defaultReturnOrderId = returnOrderId === null
    ? (deliveredOrders.find((order) => getReturnableProducts(order, state.returns).some(({ remaining }) => remaining > 0)) ?? deliveredOrders[0])?.id ?? ""
    : returnOrderId;
  const returnOrder = deliveredOrders.find((order) => order.id === defaultReturnOrderId);
  const orderItems = (current?.items as Row[] | undefined) ?? [];
  const customerReturnDetail = !admin && section === "returns";
  const history = (current?.history as Row[] | undefined) ?? [];
  const timelineItem = (entry: Row, index: number) => (
    <li key={index}>
      <strong>{entry.transition === "RESUME" && "Tiếp tục xử lý · "}{label(entry.status)}</strong>
      <small>{date(entry.at)}</small>
      <p>{String(entry.note)}</p>
    </li>
  );
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
      matchesPaymentFilter(o, paymentStatus),
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

  const returnForm = (
    !admin &&
    current?.status === "DELIVERED" &&
    (() => {
      const deliveredAt = current.deliveredAt ? new Date(String(current.deliveredAt)).getTime() : 0;
      const isAfter7Days = now !== null && deliveredAt > 0 && now - deliveredAt > 7 * 24 * 3600 * 1000;
      return (
        <form
          className="store-form"
          onSubmit={(e) => {
            const b = fields(e);
            const validLines = returnLines.filter(
              (line) =>
                b[`productId_${line.id}`] &&
                Number(b[`quantity_${line.id}`]) > 0,
            );
            if (validLines.length === 0) {
              alert("Vui lòng chọn ít nhất một sản phẩm và nhập số lượng hợp lệ.");
              return;
            }
            if (
              !window.confirm(
                `Gửi yêu cầu đổi trả cho ${validLines.length} dòng hàng?`,
              )
            )
              return;
            void run(async () => {
              const uploadedEvidence = await upload(files);
              const items = validLines.map((l) => ({
                lineId: b[`productId_${l.id}`],
                quantity: Number(b[`quantity_${l.id}`]),
                reason: b[`reason_${l.id}`] ?? l.reason,
                resolution: b[`resolution_${l.id}`] ?? "REFUND",
                description: b[`description_${l.id}`] ?? "",
              }));
              await mutate("command", "return-submit", {
                orderId: current.id,
                evidenceIds: uploadedEvidence,
                items,
              });
              setFiles([]);
              setReturnLines([{ id: 0, productId: "", reason: "DAMAGED" }]);
            });
          }}
        >
          {section !== "returns" && <h3>Yêu cầu đổi hoặc trả hàng</h3>}
          {section !== "returns" && (
            <p className="store-subtle">
              Chính sách dự thảo: tiếp nhận trong 7 ngày từ khi giao thành công. Sau 7 ngày, hệ thống vẫn tiếp nhận nếu là lỗi chất lượng hoặc an toàn thực phẩm.
            </p>
          )}
          {returnLines.map((line, idx) => {
            const item = orderItems.find((it) => String(it.productId) === line.productId) ?? orderItems[0];
            const availableProducts = orderItems.filter(
              (it) => String(it.productId) === String(item?.productId) || !selectedProducts.includes(String(it.productId)),
            );
            return (
              <div key={line.id} className="store-return-line">
                {returnLines.length > 1 && (
                  <div className="store-return-line-header">
                    <strong>Dòng hàng #{idx + 1}</strong>
                    <button
                      type="button"
                      className="store-btn-text"
                      onClick={() => setReturnLines((prev) => prev.filter((l) => l.id !== line.id))}
                    >
                      Xóa dòng này ×
                    </button>
                  </div>
                )}
                <label>
                  {section === "returns" ? "2. Chọn sản phẩm yêu cầu hỗ trợ" : "Sản phẩm"}
                  <select
                    name={`productId_${line.id}`}
                    value={line.productId || String(item?.productId ?? "")}
                    onChange={(e) => {
                      const val = e.target.value;
                      setReturnLines((prev) => prev.map((l) => l.id === line.id ? { ...l, productId: val } : l));
                    }}
                  >
                    {availableProducts.map((it) => (
                      <option key={String(it.productId)} value={String(it.productId)}>
                        {String(it.name)} (đã mua: {String(it.quantity)})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Số lượng yêu cầu
                  <input
                    type="number"
                    name={`quantity_${line.id}`}
                    min={1}
                    max={Number(item?.quantity ?? 1)}
                    defaultValue={1}
                    required
                  />
                </label>
                <label>
                  {section === "returns" ? "3. Lý do đổi trả" : "Lý do"}
                  <select
                    name={`reason_${line.id}`}
                    value={isAfter7Days && !["UNSAFE", "QUALITY"].includes(line.reason) ? "QUALITY" : line.reason}
                    onChange={(e) => {
                      const val = e.target.value;
                      setReturnLines((prev) => prev.map((l) => l.id === line.id ? { ...l, reason: val } : l));
                    }}
                  >
                    {([
                      ...(!isAfter7Days ? [
                        ["WRONG_ITEM", "Giao sai sản phẩm"],
                        ["MISSING_ITEM", "Giao thiếu hàng"],
                        ["DAMAGED", "Hư hỏng do vận chuyển"],
                        ["NOT_RECEIVED", "Chưa nhận được hàng"],
                        ["CHANGE_OF_MIND", "Thay đổi ý định"],
                      ] : []),
                      ["UNSAFE", "Nghi ngờ không an toàn thực phẩm"],
                      ["QUALITY", "Chất lượng không đảm bảo"],
                    ] as [string, string][]).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {section === "returns" ? "4. Mô tả chi tiết vấn đề" : "Mô tả chi tiết lỗi"}
                  <textarea
                    name={`description_${line.id}`}
                    required
                    maxLength={2000}
                    placeholder="Mô tả tình trạng sản phẩm khi nhận..."
                  />
                </label>
                <fieldset className="returns-resolution">
                  <legend>{section === "returns" ? "5. Chọn phương án giải quyết" : "Phương án mong muốn"}</legend>
                  <label>
                    <input type="radio" name={`resolution_${line.id}`} value="REFUND" defaultChecked />
                    Hoàn tiền
                  </label>
                  {["MISSING_ITEM", "NOT_RECEIVED"].includes(line.reason) ? (
                    <label><input type="radio" name={`resolution_${line.id}`} value="MAKE_UP" /> Giao bù hàng thiếu</label>
                  ) : (
                    <label><input type="radio" name={`resolution_${line.id}`} value="REPLACEMENT" /> Đổi sản phẩm mới</label>
                  )}
                </fieldset>
              </div>
            );
          })}
          {nextProduct && returnLines.length < orderItems.length && (
            <button
              type="button"
              className="store-btn-secondary"
              onClick={() => {
                const nextId = nextReturnLine.current++;
                setReturnLines((prev) => [
                  ...prev,
                  { id: nextId, productId: String(nextProduct.productId), reason: "DAMAGED" },
                ]);
              }}
            >
              + Thêm sản phẩm khác từ đơn này
            </button>
          )}
          <label className={section === "returns" ? "returns-upload" : undefined}>
            <strong>{section === "returns" ? "6. Tải ảnh chứng minh" : "Ảnh chứng minh"}</strong>
            <span>PNG/JPEG · Tối đa 5 ảnh, 5 MB/ảnh</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              multiple
              onChange={(e) => {
                const selectedFiles = Array.from(e.target.files ?? []);
                if (
                  selectedFiles.length > 5 ||
                  selectedFiles.some(
                    (file) =>
                      file.size > 5 * 1024 * 1024 ||
                      !["image/png", "image/jpeg"].includes(file.type),
                  )
                ) {
                  e.target.value = "";
                  setFiles([]);
                } else setFiles(selectedFiles);
              }}
            />
            <small>
              Chụp rõ nhãn mác, hạn sử dụng và phần hư hỏng nếu có.
            </small>
          </label>
          {files.length > 0 && (
            <p className="store-subtle">
              Đã chọn: {files.map((file) => file.name).join(", ")}
            </p>
          )}
          <button disabled={busy}>Gửi yêu cầu đổi trả</button>
        </form>
      );
    })()
  );

  const detailPanel = current ? (
    <section key={current.id} className="store-card store-detail">
      <button className="store-close" onClick={() => setSelected(null)}>
        Đóng chi tiết ×
      </button>
      <>
        <h2>
          {current.type
            ? label(current.type)
            : section === "returns"
              ? `Yêu cầu #${String(current.caseId || current.id).slice(0, 8)}`
              : String(current.number ?? current.orderNumber)}
        </h2>
        {current.items != null ? (
          <OrderBadges order={current} />
        ) : (
          <p className="store-badge">{label(current.status)}</p>
        )}
        {section === "returns" && current.orderNumber ? (
          <p className="returns-linked-order">
            Đơn hàng liên quan{" "}
            <Link href={`${admin ? "/admin" : "/account"}/orders?order=${encodeURIComponent(String(current.orderId))}`}>
              {String(current.orderNumber)}
            </Link>
          </p>
        ) : <p>Mã hồ sơ: {current.id}</p>}
        {current.items != null ? (
          <>
            {admin && current.paymentMethod === "VIETQR" && (
              <AdminOrderPayment
                key={current.id + String(current.revision)}
                order={current}
                busy={busy}
                onResolve={(data) => void run(async () => {
                  await mutate("commerce", "payment-resolve", { ...data, id: current.id, revision: current.revision });
                })}
              />
            )}
            {admin && isCodOrder(current) && <AdminCodPayment order={current} />}
            <OrderTimeline order={current} />
            <p>
              {cleanText(String(current.recipient))} · {String(current.phone)}
            </p>
            <p>{cleanText(String(current.address))}</p>
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
                  {line.slug ? (
                    <Link
                      href={`/products/${line.slug}`}
                      style={{ color: "inherit", textDecoration: "underline" }}
                    >
                      {cleanText(String(line.name))}
                    </Link>
                  ) : (
                    cleanText(String(line.name))
                  )}{" "}
                  · {String(line.quantity)} × {money(line.price)}
                </span>
              </p>
            ))}
            <p>
              Tiền hàng {money(current.subtotal)} · Giao hàng{" "}
              {money(current.shippingFee)} ·{" "}
              <strong>Tổng {money(current.total)}</strong>
            </p>
            {!admin && <PaymentPanel order={current} />}
            {!admin && Boolean(current.paymentReference) && (
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
                    Địa chỉ nhận hàng
                    <textarea
                      name="address"
                      defaultValue={String(current.address)}
                      required
                      maxLength={400}
                    />
                  </label>
                  <button disabled={busy}>Cập nhật địa chỉ nhận</button>
                </form>
              </details>
            )}
            {admin && (
              <OrderAction
                key={current.id + String(current.revision)}
                row={current}
                onSave={(b) =>
                  void run(async () => {
                    await mutate("commerce", "order-status", {
                      ...b,
                      id: current.id,
                      revision: current.revision,
                    });
                  })
                }
                busy={busy}
              />
            )}
            {section !== "returns" && returnForm}
          </>
        ) : (
          <>
            {section === "returns" ? (
              <>
                {admin && linkedReturnOrder?.recipient != null && (
                  <div className="returns-detail-block">
                    <small>Người nhận</small>
                    <strong>{String(linkedReturnOrder.recipient)}</strong>
                    {linkedReturnOrder.phone != null && <span>{String(linkedReturnOrder.phone)}</span>}
                    {linkedReturnOrder.address != null && <span>{String(linkedReturnOrder.address)}</span>}
                  </div>
                )}
                <div className="returns-detail-block returns-detail-product">
                  {typeof linkedReturnItem?.image === "string" && (
                    <ProductImage src={linkedReturnItem.image} alt="" width={56} height={56} />
                  )}
                  <div>
                    <small>Sản phẩm yêu cầu đổi trả</small>
                    <strong>{String(current.product ?? current.description)}</strong>
                  </div>
                </div>
              </>
            ) : null}
            {!customerReturnDetail && Boolean(current.unitPrice) && (
              <p>
                Đơn giá: {money(current.unitPrice)} · Số lượng:{" "}
                {String(current.quantity)}
              </p>
            )}
            {!customerReturnDetail && Boolean(current.approvedQuantity) && (
              <p>Số lượng được duyệt: {String(current.approvedQuantity)}</p>
            )}
            {Boolean(current.amount) && (
              <p>Số tiền: {money(current.amount)}</p>
            )}
            {current.codDueAfterAmount != null && (
              <p>Khoản COD phải thu sau điều chỉnh: <strong>{money(current.codDueAfterAmount)}</strong></p>
            )}
            <p>{String(current.description)}</p>
            {Boolean(current.reason) && <p>Lý do: {label(current.reason)}</p>}
            {Boolean(current.resolution) && (
              <p>Phương án: {label(current.resolution)}</p>
            )}
            {!customerReturnDetail && Boolean(current.goods) && (
              <p>Thu hồi hàng: {label(current.goods)}</p>
            )}
            {!customerReturnDetail && Boolean(current.fulfillment) && (
              <p>Thực hiện giải pháp: {label(current.fulfillment)}</p>
            )}
            {Boolean(current.refundReference) && (
              <p>Tham chiếu hoàn tiền: {String(current.refundReference)}</p>
            )}
            {Boolean(current.replacementOrderNumber) && (
              <p>
                Đơn đổi hàng mới: {String(current.replacementOrderNumber)}
              </p>
            )}
            {!customerReturnDetail && Boolean(current.intakeReference) && (
              <p>Biên bản nhận hàng: {String(current.intakeReference)}</p>
            )}
            {Boolean(current.decisionReason) && (
              <p>Lý do quyết định: {String(current.decisionReason)}</p>
            )}
            {Boolean(current.result) && (
              <div className="store-result">
                <h4>Kết quả xử lý</h4>
                <p>{String(current.result)}</p>
                {Boolean(current.data) && (
                  <pre>{JSON.stringify(current.data, null, 2)}</pre>
                )}
              </div>
            )}
            {Boolean(current.downloadUrl) && (
              <p>
                <a
                  href={`/api/store${String(current.downloadUrl)}`}
                  className="store-link-button"
                  download
                >
                  Tải dữ liệu xuất (JSON)
                </a>
              </p>
            )}
            {((current.evidenceIds as string[]) ?? []).length > 0 && (
              <div className="store-evidence-grid">
                <h4>Ảnh đính kèm</h4>
                <div className="store-evidence-list returns-evidence-list">
                  {((current.evidenceIds as string[]) ?? []).map((id) => (
                    <EvidencePreview key={id} id={id} />
                  ))}
                </div>
              </div>
            )}
            {customerReturnDetail && current.status === "EXCEPTION" && (
              <p className="store-subtle">Hồ sơ đang chờ cửa hàng xử lý vướng mắc. Bạn có thể theo dõi tiến độ trong lịch sử bên dưới.</p>
            )}
            {!admin &&
              !current.type &&
              ["REQUESTED", "REVIEWING", "EVIDENCE_REQUIRED", "CUSTOMER_CONFIRMATION"].includes(
                String(current.status),
              ) && (
                <details className="returns-withdraw">
                  <summary>Rút yêu cầu</summary>
                  <form
                    className="store-form"
                    onSubmit={(e) => {
                      const b = fields(e);
                      if (
                        !window.confirm(
                          "Rút yêu cầu này? Thao tác này sẽ đóng hồ sơ.",
                        )
                      )
                        return;
                      void run(async () => {
                        await mutate("command", "return-withdraw", {
                          id: current.id,
                          revision: current.revision,
                          note: b.note,
                        });
                      });
                    }}
                  >
                    <label>
                      Lý do rút yêu cầu
                      <textarea name="note" required maxLength={500} />
                    </label>
                    <button disabled={busy} className="store-btn-danger">
                      Xác nhận rút yêu cầu
                    </button>
                  </form>
                </details>
              )}
            {admin && !current.type && current.status === "EVIDENCE_REQUIRED" && (
              <p className="store-subtle">Đang chờ khách hàng gửi bổ sung.</p>
            )}
            {!admin && (
              current.type
                ? !["RESOLVED", "COMPLETED", "REJECTED", "WITHDRAWN"].includes(String(current.status))
                : current.status === "EVIDENCE_REQUIRED"
            ) && (
              <details className="returns-supplement">
                <summary>Bổ sung thông tin/ảnh</summary>
                <form
                  className="store-form"
                  onSubmit={(e) => {
                    const b = fields(e);
                    void run(async () => {
                      const uploadedEvidence = await upload(supplementFiles);
                      await mutate(
                        "command",
                        current.type
                          ? "privacy-supplement"
                          : "return-supplement",
                        {
                          id: current.id,
                          revision: current.revision,
                          note: b.note,
                          evidenceIds: uploadedEvidence,
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
              </details>
            )}
            {admin && (
              <CaseAction
                key={current.id + String(current.revision)}
                row={current}
                paymentStatus={linkedReturnOrder?.paymentStatus}
                allowCodAdjustment={Boolean(linkedReturnOrder && codNeedsReceipt(linkedReturnOrder))}
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
        {customerReturnDetail ? (
          history.length > 0 && (
            <div className="b07-timeline">
              <h3>Lịch sử xử lý</h3>
              <ol className="store-timeline">{timelineItem(history[history.length - 1], history.length - 1)}</ol>
              {history.length > 1 && (
                <details>
                  <summary>Xem {history.length - 1} bước trước đó</summary>
                  <ol className="store-timeline">{history.slice(0, -1).map(timelineItem)}</ol>
                </details>
              )}
            </div>
          )
        ) : (
          <>
            <h3>Lịch sử xử lý</h3>
            <ol className="store-timeline">{history.map(timelineItem)}</ol>
          </>
        )}
      </>
    </section>
  ) : null;

  if (admin && section === "orders") {
    return <AdminOrders orders={state.orders} filteredOrders={filteredOrders} query={orderQuery} status={orderStatus} paymentStatus={paymentStatus} page={visibleOrderPage} selected={current} detail={detailPanel} onQueryChange={(value) => { setOrderQuery(value); setOrderPage(1); }} onStatusChange={(value) => { setOrderStatus(value); setOrderPage(1); }} onPaymentStatusChange={(value) => { setPaymentStatus(value); setOrderPage(1); }} onPageChange={setOrderPage} onSelect={(order) => { setReturnLines([{ id: 0, productId: "", reason: "DAMAGED" }]); setFiles([]); setSelected(order); }} onClose={() => setSelected(null)} />;
  }

  if (admin && section === "privacy") {
    return <AdminPrivacy rows={state.privacy} selected={current} detail={detailPanel} onSelect={setSelected} />;
  }

  if (!admin) {
    const customerOnlySections = ["addresses", "orders", "returns"];
    const unavailableToAdmin = state.user.role === "ADMIN" && customerOnlySections.includes(section);
    return (
      <div className={section === "returns" ? "account-screen-wrapper b07-account" : "account-screen-wrapper"}>
        <div className="account-main-layout">
          <aside className="account-sidebar-aside">
            <div>
              <div className="account-sidebar-header">
                <span className="account-sidebar-eyebrow">Quản lý tài khoản</span>
                <h2 className="account-sidebar-title">Tài Khoản Của Tôi</h2>
              </div>
              <nav className="account-sidebar-nav" aria-label="Quản lý tài khoản">
                {accountNavigation.filter((item) => state.user.role !== "ADMIN" || !customerOnlySections.includes(item.key)).map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`account-sidebar-link ${section === item.key ? "active" : ""}`}
                    aria-current={section === item.key ? "page" : undefined}
                  >
                    <span className="material-symbols-outlined">{item.icon || "circle"}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
            </div>
            <div className="account-sidebar-logout-wrapper">
              <button
                type="button"
                className="account-sidebar-logout"
                onClick={() => void run(logout)}
              >
                <span className="material-symbols-outlined">logout</span>
                <span>Đăng xuất</span>
              </button>
            </div>
          </aside>

          <main className="account-content-pane">
            {unavailableToAdmin && (
              <section className="store-card">
                <h1>Mục dành cho khách hàng</h1>
                <p>Tài khoản quản trị không sử dụng mục này trong tài khoản cá nhân.</p>
                <Link href={section === "orders" ? "/admin/orders" : section === "returns" ? "/admin/returns" : "/account/profile"}>
                  {section === "orders" ? "Đến quản lý đơn hàng →" : section === "returns" ? "Đến xử lý đổi trả →" : "Về hồ sơ cá nhân →"}
                </Link>
              </section>
            )}
            {section === "profile" && <AccountProfile />}
            {section === "addresses" && !unavailableToAdmin && <AccountAddresses />}
            {section === "security" && <AccountSecurity />}
            {section === "privacy" && <AccountPrivacy />}
            {section === "orders" && !unavailableToAdmin && (
              <AccountOrders />
            )}
            {section === "returns" && !unavailableToAdmin && (
              <div className="customer-returns">
                <header className="returns-heading">
                  <div>
                    <span className="eyebrow">Bảo hành &amp; khiếu nại dịch vụ</span>
                    <h1>Yêu cầu đổi trả &amp; hoàn tiền</h1>
                    <p>Gửi yêu cầu hỗ trợ cho sản phẩm trong đơn hàng đã giao.</p>
                    <Link href="/return-policy">Xem chính sách đổi trả →</Link>
                  </div>
                  <a className="returns-primary" href="#new-return">+ Tạo yêu cầu đổi trả mới</a>
                </header>
                <div className="returns-policy-strip">
                  <span className="material-symbols-outlined" aria-hidden="true">info</span>
                  <p><strong>Thời hạn tiếp nhận:</strong> 7 ngày từ khi giao. Lỗi chất lượng hoặc an toàn thực phẩm vẫn được tiếp nhận sau thời hạn này.</p>
                  <Link href="/return-policy">Điều khoản &amp; quy định</Link>
                </div>
                <div className="returns-layout returns-customer-layout">
                  <section aria-label="Hồ sơ đổi trả">
                    <div className="returns-cases-heading">
                      <h2 className="returns-section-title">Hồ sơ khiếu nại hiện hành</h2>
                      <span className="store-status-chip">{new Set(state.returns.map((row) => row.caseId || row.id)).size} hồ sơ</span>
                    </div>
                    {detailPanel}
                    <ReturnQueue rows={state.returns} onSelect={(row) => {
                      setSupplementFiles([]);
                      setSelected(row);
                    }} />
                  </section>
                  <section className="store-card returns-create" id="new-return">
                    <div className="returns-create-title">
                      <span className="material-symbols-outlined" aria-hidden="true">assignment_return</span>
                      <h2>Tạo yêu cầu đổi trả mới</h2>
                    </div>
                    <div className="store-form">
                      <label>
                        1. Chọn đơn hàng đã giao
                        <select
                          value={returnOrder?.id ?? ""}
                          onChange={(event) => {
                            setFiles([]);
                            setReturnLines([{ id: 0, productId: "", reason: "DAMAGED" }]);
                            setReturnOrderId(event.target.value);
                          }}
                        >
                          <option value="">Chọn đơn hàng</option>
                          {deliveredOrders.map((order) => (
                            <option key={order.id} value={order.id}>
                              {String(order.number)} · Giao ngày {new Date(String(order.deliveredAt)).toLocaleDateString("vi-VN")} · {((order.items as Row[] | undefined) ?? []).reduce((sum, item) => sum + Number(item.quantity), 0)} món · {money(order.total)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {!deliveredOrders.length && (
                        <p className="store-subtle">Bạn chưa có đơn đã giao. <Link href="/account/orders">Xem đơn hàng</Link></p>
                      )}
                    </div>
                    {returnOrder?.status === "DELIVERED" && (
                      <ReturnRequestForm
                        key={returnOrder.id}
                        order={returnOrder}
                        returns={state.returns}
                        busy={busy}
                        onReset={() => setReturnOrderId("")}
                        onSubmit={(items, photos) => {
                          void run(async () => {
                            const evidenceIds = await upload(photos);
                            await mutate("command", "return-submit", { orderId: returnOrder.id, items, evidenceIds });
                            setReturnOrderId("");
                          });
                        }}
                      />
                    )}
                  </section>
                </div>
              </div>
            )}
            {section !== "orders" && section !== "returns" && !unavailableToAdmin && detailPanel}
          </main>
        </div>
      </div>
    );
  }

  if (["returns", "policies", "audit"].includes(section)) {
    const operationsSections = {
      returns: ["Xử lý yêu cầu đổi trả", "Xem bằng chứng, thẩm định và cập nhật tiến độ từng yêu cầu."],
      policies: ["Quản lý chính sách bảo mật", "Soạn thảo, xem trước và tra cứu các phiên bản đã lưu."],
      audit: ["Nhật ký hoạt động quản trị", "Theo dõi lịch sử thao tác và đối tượng được cập nhật."],
    } as const;
    const [title, description] = operationsSections[section as keyof typeof operationsSections];
    return (
      <OperationsWorkspace section={section} title={title} description={description}>
        {section === "returns" && (
          <div className="returns-layout returns-admin-layout">
            <ReturnQueue rows={state.returns} orders={state.orders} onSelect={setSelected} admin />
            <aside className="returns-admin-detail" aria-label="Chi tiết yêu cầu">
              {detailPanel ?? <p className="store-empty">Chọn một yêu cầu để xem chi tiết và xử lý.</p>}
            </aside>
          </div>
        )}
        {section === "policies" && (
          <PolicyEditor policy={state.policy} versions={state.policyVersions ?? []} busy={busy}
            onSave={(draft) => {
              void run(async () => { await mutate("command", "policy", draft); });
            }}
          />
        )}
        {section === "audit" && <AuditLog rows={state.audit ?? []} />}
      </OperationsWorkspace>
    );
  }

  return (
    <main className="store-page">
      <div className="store-heading">
        <span className="eyebrow">Không gian quản trị</span>
        <h1>Quản lý cửa hàng</h1>
        <p>
          {String(state.user.name)} · {String(state.user.email)}
        </p>
      </div>
      <WorkspaceNav admin={admin} section={section} />
      {section === "profile" && <PasswordSettings />}
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
          <div className={styles.kpiHeader}>
            <h2>{admin ? "Đơn hàng cửa hàng" : "Đơn hàng của tôi"}</h2>
            {admin && state.orders.length > 0 && (
              <span className={styles.kpiScopeNote}>Toàn bộ đơn</span>
            )}
          </div>
          {admin && state.orders.length > 0 && (
            <div className={styles.kpiGrid} aria-label="Tình hình đơn hàng">
              {[
                ["Tổng đơn", state.orders.length],
                ["Chờ xác nhận", orderCount("PLACED")],
                ["Đang đóng gói", orderCount("PACKED")],
                ["Đang giao", orderCount("SHIPPED")],
                ["Đã giao", orderCount("DELIVERED")],
              ].map(([labelText, value], i) => (
                <span
                  className={`${styles.kpiCell} ${i === 0 ? styles.kpiCellTotal : ""}`}
                  key={labelText}
                >
                  <span className={styles.kpiLabel}>{labelText}</span>
                  <span className={styles.kpiValue}>{value}</span>
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
      {detailPanel}
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
  const paidStatus = orderPaymentStatus(row);
  const isCod = isCodOrder(row);
  const codDelivery = isCod && row.status === "SHIPPED";
  const blockedVietQr = row.paymentMethod === "VIETQR" && paidStatus !== "PAID";
  const nextOptions = ((
    {
      PLACED: ["CONFIRMED"],
      CONFIRMED: ["PACKED"],
      PACKED: ["SHIPPED"],
      SHIPPED: ["DELIVERED", "DELIVERY_FAILED"],
      DELIVERY_FAILED: ["SHIPPED", "RETURNED"],
    } as Record<string, string[]>
  )[String(row.status)] ?? []).filter((status) =>
    !(blockedVietQr && ["PACKED", "SHIPPED", "DELIVERED"].includes(status))
    && !(paidStatus === "PAID" && status === "RETURNED"),
  );
  const actions = [
    ...(nextOptions.length ? ["order-status"] : []),
    ...(codNeedsReceipt(row) ? ["order-paid"] : []),
    ...(["PLACED", "CONFIRMED"].includes(String(row.status)) &&
    !["PAID", "REVIEW"].includes(paidStatus)
      ? ["order-cancel"]
      : []),
  ];
  const [action, setAction] = useState(actions[0] ?? "");
  const [next, setNext] = useState(codDelivery ? "" : nextOptions[0] ?? "");
  const nextValue = codDelivery || nextOptions.includes(next)
    ? next
    : (nextOptions[0] ?? "");
  const collectsCod = action === "order-paid" ||
    (action === "order-status" && nextValue === "DELIVERED" && codDelivery && paidStatus === "UNPAID");
  const codDue = codAmountDue(row);
  const deliveryLabel = (status: string) => {
    if (status === "DELIVERED" && codDelivery) {
      return paidStatus === "UNPAID" ? "Giao thành công và xác nhận thu COD" : "Giao thành công";
    }
    return label(status);
  };
  if (!actions.length)
    return <p>{blockedVietQr && ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERY_FAILED"].includes(String(row.status))
      ? "Cần xác nhận thanh toán VietQR trước khi tiếp tục giao vận."
      : "Không còn thao tác xử lý trực tiếp cho đơn này."}</p>;
  const title =
    action === "order-status"
        ? codDelivery ? deliveryLabel(nextValue) : `Chuyển sang ${label(nextValue)}`
        : action === "order-paid"
          ? "Bổ sung chứng từ thu COD"
          : "Hủy đơn đủ điều kiện";
  return (
    <form
      className="store-form"
      onSubmit={(e) => {
        const b = fields(e);
        if (window.confirm(`${title} cho đơn ${row.number}?`))
          onSave({ ...b, status: nextValue, ...(collectsCod ? { collectedAmount: Number(b.collectedAmount) } : {}) });
      }}
    >
      <h3>Xử lý đơn hàng</h3>
      {codDelivery ? <input type="hidden" name="action" value="order-status" /> : <label>
        Thao tác
        <select
          name="action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        >
          {actions.map((a) => (
            <option key={a} value={a}>
              {a === "order-status"
                  ? `Chuyển sang ${label(nextValue)}`
                  : a === "order-paid"
                    ? "Bổ sung chứng từ thu COD"
                    : "Hủy đơn"}
            </option>
          ))}
        </select>
      </label>}
      {action === "order-status" && nextOptions.length > 1 && (
        <label>
          {codDelivery ? "Kết quả giao hàng" : "Trạng thái tiếp theo"}
          <select
            value={nextValue}
            onChange={(e) => setNext(e.target.value)}
            required={codDelivery}
          >
            {codDelivery && <option value="" disabled>Chọn kết quả giao hàng</option>}
            {nextOptions.map((s) => (
              <option value={s} key={s}>
                {deliveryLabel(s)}
              </option>
            ))}
          </select>
        </label>
      )}
      {collectsCod && (
        <label>
          Số tiền thực thu (VND)
          <input name="collectedAmount" type="number" inputMode="numeric" min={codDue} max={codDue} step={1} required />
          <small>Số tiền phải thu của đơn là <strong>{money(codDue)}</strong>.</small>
        </label>
      )}
      {(collectsCod ||
        (action === "order-status" && nextValue === "SHIPPED")) && (
        <label>
          {collectsCod
            ? "Mã chứng từ thu COD"
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
      <button disabled={busy || (action === "order-status" && !nextValue)}>
        {collectsCod ? codDelivery ? "Xác nhận giao và thu COD" : "Lưu chứng từ thu COD" : "Xác nhận xử lý"}
      </button>
    </form>
  );
}

function missingReturnItem(reason: unknown) {
  return reason === "MISSING_ITEM" || reason === "NOT_RECEIVED";
}

function CaseAction({
  row,
  paymentStatus,
  allowCodAdjustment,
  busy,
  onSave,
}: {
  row: Row;
  busy: boolean;
  paymentStatus?: unknown;
  allowCodAdjustment: boolean;
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
  const paymentBlocked = row.resolution === "REFUND" ? paymentStatus !== "PAID" : row.resolution === "ADJUST_DUE" && !allowCodAdjustment;
  const refundAwaitingPayment = row.resolution === "REFUND" && paymentBlocked;
  const resumeNeedsPayment =
    row.status === "PAYMENT_REVIEW" ||
    (row.status === "EXCEPTION" && ["INSPECTED", "PROCESSING"].includes(String(row.resumeStatus)));
  const next = (options[String(row.status)] ?? []).filter((step) =>
    (step !== "WAITING_STOCK" || shipment) && (step !== "PAYMENT_REVIEW" || financial) &&
    (!paymentBlocked || !["PROCESSING", "RESOLVED"].includes(step)) &&
    !(refundAwaitingPayment && resumeNeedsPayment && step === "RESUME"),
  );
  const [selection, setTarget] = useState("");
  const [note, setNote] = useState("");
  const reviewingReturn = !row.type && row.status === "REVIEWING";
  const target = next.includes(selection) ? selection : reviewingReturn ? "" : next[0];
  const refundNotice = refundAwaitingPayment && (
    <div className="store-warning">
      <p>Chưa thể tiếp tục hoàn tiền vì đơn hàng chưa được xác nhận đã thu tiền.</p>
      <p>Nếu đã thu tiền thực tế, mở đơn hàng để ghi nhận chứng từ thu tiền hoặc đối soát thanh toán. Nếu chưa thu tiền, giữ hồ sơ chờ xác minh.</p>
      {typeof row.orderId === "string" && (
        <Link href={`/admin/orders?order=${encodeURIComponent(row.orderId)}`}>
          Mở đơn hàng {String(row.orderNumber ?? "")}
        </Link>
      )}
    </div>
  );
  if (!next.length) return refundNotice || null;
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
      {!row.type && row.status === "INSPECTED" && (
        <p className="store-subtle">Hàng trả đã được kiểm tra. Hồ sơ còn bước thực hiện và xác nhận kết quả.</p>
      )}
      {refundNotice}
      {paymentBlocked && !refundAwaitingPayment && (
        <p className="store-warning">Chỉ điều chỉnh khoản phải thu cho đơn COD chưa thu tiền.</p>
      )}
      {reviewingReturn ? (
        <fieldset className="returns-decisions">
          <legend>Quyết định nghiệp vụ</legend>
          <input type="hidden" name="status" value={selection} />
          {[
            ["APPROVED", "Chấp thuận đổi trả"],
            ["EVIDENCE_REQUIRED", "Yêu cầu bổ sung"],
            ["REJECTED", "Từ chối yêu cầu"],
          ].filter(([step]) => next.includes(step)).map(([step, title]) => (
            <button type="button" key={step} aria-pressed={selection === step} onClick={() => setTarget(step)}>
              {title}
            </button>
          ))}
        </fieldset>
      ) : (
        <label>
          Bước tiếp theo
          <select
            name="status"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            {next.map((s) => (
              <option key={s} value={s}>
                {s === "RESUME" && row.resumeStatus
                  ? `Tiếp tục xử lý → ${label(row.resumeStatus)}`
                  : label(s)}
              </option>
            ))}
          </select>
        </label>
      )}
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
              {allowCodAdjustment && <option value="ADJUST_DUE">Điều chỉnh khoản phải thu COD</option>}
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
        <textarea name="note" required maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <button disabled={busy || !target || !note.trim()}>Xác nhận xử lý</button>
    </form>
  );
}

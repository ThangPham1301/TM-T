"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AddressBook, PasswordSettings } from "./account-settings";
import { AccountProfile } from "./account-profile";
import { AccountAddresses } from "./account-addresses";
import { AccountSecurity } from "./account-security";
import { AccountPrivacy } from "./account-privacy";
import { AccountOrders } from "./account-orders";
import { accountNavigation } from "@/shared/layout/navigation";
import { PaymentPanel } from "./payment-panel";
import { OrderBadges, OrderTimeline } from "./order-presentation";
import { ProductImage } from "./product/product-image";
import styles from "./journey.module.css";
import { WorkspaceNav, Pagination } from "./workspace-nav";
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

  const detailPanel = current ? (
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
            {Boolean((current.packing as Row | undefined)?.photoId) && (
              <p><a href={`/api/store/packing/${current.id}/photo`} target="_blank" rel="noreferrer">Xem ảnh đóng gói</a></p>
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
                onSave={(b, photo) =>
                  void run(async () => {
                    let packingPhotoId: string | undefined;
                    if (photo) {
                      if (!photo.size || photo.size > 5 * 1024 * 1024) throw new Error("Chọn ảnh tối đa 5 MB.");
                      const response = await fetch(`/api/store/packing/${current.id}/photo/${current.revision}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/octet-stream" },
                        body: photo,
                      });
                      const uploaded = await response.json();
                      if (!response.ok) throw new Error(uploaded.message ?? "Không tải được ảnh đóng gói.");
                      packingPhotoId = uploaded.photoId;
                    }
                    await mutate("commerce", "order-status", {
                      ...b,
                      id: current.id,
                      revision: current.revision,
                      ...(packingPhotoId ? { packingPhotoId } : {}),
                    });
                  })
                }
                busy={busy}
              />
            )}
            {!admin &&
              String(current.status) === "DELIVERED" &&
              (() => {
                const deliveredAt = current.deliveredAt ? new Date(String(current.deliveredAt)).getTime() : 0;
                const isAfter7Days = deliveredAt > 0 && Date.now() - deliveredAt > 7 * 24 * 3600 * 1000;
                return (
                  <form
                    className="store-form"
                    onSubmit={(e) => {
                      const b = fields(e);
                      const validLines = returnLines.filter((l) => l.productId && Number(b[`quantity_${l.id}`]) > 0);
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
                          lineId: l.productId,
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
                    <h3>Yêu cầu đổi hoặc trả hàng</h3>
                    <p className="store-subtle">
                      Chính sách dự thảo: tiếp nhận trong 7 ngày từ khi giao thành công. Sau 7 ngày, hệ thống vẫn tiếp nhận nếu là lỗi chất lượng hoặc an toàn thực phẩm.
                    </p>
                    {returnLines.map((line, idx) => {
                      const item = orderItems.find((it) => String(it.productId) === line.productId) ?? orderItems[0];
                      const availableProducts = orderItems.filter(
                        (it) => String(it.productId) === line.productId || !selectedProducts.includes(String(it.productId)),
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
                            Sản phẩm
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
                            Lý do
                            <select
                              name={`reason_${line.id}`}
                              value={line.reason}
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
                            Phương án mong muốn
                            <select name={`resolution_${line.id}`}>
                              <option value="REFUND">Hoàn tiền</option>
                              {["MISSING_ITEM", "NOT_RECEIVED"].includes(line.reason) ? (
                                <option value="MAKE_UP">Giao bù hàng thiếu</option>
                              ) : (
                                <option value="REPLACEMENT">Đổi sản phẩm mới</option>
                              )}
                            </select>
                          </label>
                          <label>
                            Mô tả chi tiết lỗi
                            <textarea
                              name={`description_${line.id}`}
                              required
                              maxLength={2000}
                              placeholder="Mô tả tình trạng sản phẩm khi nhận..."
                            />
                          </label>
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
                    <label>
                      Ảnh chứng minh PNG/JPEG (tối đa 5 ảnh, 5 MB/ảnh)
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
              })()}
          </>
        ) : (
          <>
            <p>
              <strong>{String(current.product ?? current.description)}</strong>
            </p>
            {Boolean(current.unitPrice) && (
              <p>
                Đơn giá: {money(current.unitPrice)} · Số lượng:{" "}
                {String(current.quantity)}
              </p>
            )}
            {Boolean(current.approvedQuantity) && (
              <p>Số lượng được duyệt: {String(current.approvedQuantity)}</p>
            )}
            {Boolean(current.amount) && (
              <p>Số tiền: {money(current.amount)}</p>
            )}
            <p>{String(current.description)}</p>
            {Boolean(current.reason) && <p>Lý do: {label(current.reason)}</p>}
            {Boolean(current.resolution) && (
              <p>Phương án: {label(current.resolution)}</p>
            )}
            {Boolean(current.goods) && (
              <p>Thu hồi hàng: {label(current.goods)}</p>
            )}
            {Boolean(current.fulfillment) && (
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
            {Boolean(current.intakeReference) && (
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
                <div className="store-evidence-list">
                  {((current.evidenceIds as string[]) ?? []).map((id) => (
                    <a
                      key={id}
                      href={`/api/store/evidence/${id}/content`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={`/api/store/evidence/${id}/content`}
                        alt="Bằng chứng đính kèm"
                        className="store-evidence-thumb"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {!admin &&
              !["RESOLVED", "REJECTED", "WITHDRAWN"].includes(
                String(current.status),
              ) && (
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
                        reason: b.reason,
                      });
                    });
                  }}
                >
                  <h4>Rút yêu cầu đổi trả</h4>
                  <label>
                    Lý do rút yêu cầu
                    <textarea name="reason" required maxLength={500} />
                  </label>
                  <button disabled={busy} className="store-btn-danger">
                    Xác nhận rút yêu cầu
                  </button>
                </form>
              )}
            {!["RESOLVED", "REJECTED", "WITHDRAWN"].includes(
              String(current.status),
            ) && (
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
  ) : null;

  if (!admin) {
    return (
      <div className="account-screen-wrapper">
        <div className="account-main-layout">
          <aside className="account-sidebar-aside">
            <div>
              <div className="account-sidebar-header">
                <span className="account-sidebar-eyebrow">Quản lý tài khoản</span>
                <h2 className="account-sidebar-title">Tài Khoản Của Tôi</h2>
              </div>
              <nav className="account-sidebar-nav" aria-label="Quản lý tài khoản">
                {accountNavigation.map((item) => (
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
                onClick={() => void logout()}
              >
                <span className="material-symbols-outlined">logout</span>
                <span>Đăng xuất</span>
              </button>
            </div>
          </aside>

          <main className="account-content-pane">
            {section === "profile" && <AccountProfile />}
            {section === "addresses" && <AccountAddresses />}
            {section === "security" && <AccountSecurity />}
            {section === "privacy" && <AccountPrivacy />}
            {section === "orders" && (
              <AccountOrders onSelectOrder={setSelected} />
            )}
            {section === "returns" && (
              <section className="store-card">
                <h2>Yêu cầu đổi trả</h2>
                {!state.returns.length && (
                  <div className="store-empty">
                    <p>Chưa có yêu cầu đổi trả.</p>
                    <Link href="/account/orders">Mở đơn đã giao để gửi yêu cầu</Link>
                  </div>
                )}
                {state.returns
                  .filter(
                    (r, i, rows) =>
                      !r.caseId || rows.findIndex((row) => row.caseId === r.caseId) === i,
                  )
                  .map((r) => {
                    const lines = r.caseId
                      ? state.returns.filter((row) => row.caseId === r.caseId)
                      : [r];
                    const closed = lines.every((row) =>
                      ["RESOLVED", "REJECTED", "WITHDRAWN"].includes(String(row.status)),
                    );
                    const fulfilled = lines.filter((row) => row.status === "RESOLVED");
                    const partial =
                      fulfilled.length > 0 &&
                      (fulfilled.length < lines.length ||
                        fulfilled.some(
                          (row) =>
                            Number(row.approvedQuantity ?? row.quantity) <
                            Number(row.quantity),
                        ));
                    return (
                      <button
                        key={r.id}
                        className="store-row"
                        onClick={() => setSelected(r)}
                      >
                        <strong>
                          {String(r.orderNumber)} ·{" "}
                          {lines.length > 1
                            ? `${lines.length} dòng hàng`
                            : String(r.product)}
                        </strong>
                        <span>
                          {label(r.reason)} · {String(r.quantity)} sản phẩm
                        </span>
                        <span className="store-status-chip">
                          {closed && partial
                            ? "Hoàn tất một phần"
                            : lines.length === 1
                            ? label(r.status)
                            : closed
                            ? "Đã đóng hồ sơ"
                            : "Đang xử lý"}
                        </span>
                        <small>{date(r.createdAt)}</small>
                      </button>
                    );
                  })}
              </section>
            )}
            {section !== "orders" && detailPanel}
          </main>
        </div>
      </div>
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
      {detailPanel}
    </main>
  );
}

const packingInstructions = [
  ["WAX_PAPER", "Kiểm giấy sáp gạo nếp chống dính · 20 giây"],
  ["MOLDED_TRAY", "Xếp khay bã mía, hút ẩm và thẻ hạt mầm/thiệp nếu có · 30 giây"],
  ["KRAFT_BOX", "Lồng hộp Kraft · 25 giây"],
  ["HONEYCOMB", "Quấn giấy tổ ong và chèn góc · 40 giây"],
  ["CORN_TAPE", "Đóng thùng sóng E, dán keo giấy chữ H · 35 giây"],
  ["LABEL", "Dán vận đơn và tem tránh nắng, cho đồng kiểm · 30 giây"],
] as const;

function OrderAction({
  row,
  busy,
  onSave,
}: {
  row: Row;
  busy: boolean;
  onSave: (b: Record<string, unknown>, photo?: File) => void;
}) {
  const vietQr = row.paymentMethod === "VIETQR";
  const pendingCod = row.paymentMethod === "COD" && row.status === "PLACED" && Boolean(row.codConfirmBy);
  const inspectionItems = (row.items as Row[] | undefined) ?? [];
  const pickLots = inspectionItems.flatMap((item) =>
    Array.isArray(item.lotAllocations) ? item.lotAllocations as Row[] : []
  );
  const fulfillmentQc = row.fulfillmentQc as Row | undefined;
  const canPick = row.status === "CONFIRMED" && (!vietQr || row.paymentStatus === "PAID");
  const needsQc = Boolean(row.fulfillmentQcRequired) || pickLots.length > 0;
  const fulfillmentActions: Record<string, string> = {
    "order-pick-qc": "Ghi nhận QC soạn hàng",
    "order-repick": "Cấp lại lô không còn đạt",
    "order-reopen-packing": "Mở lại đơn để soạn và kiểm định",
  };
  const nextOptions = ((
    {
      PLACED: ["CONFIRMED"],
      CONFIRMED: ["PACKED"],
      PACKED: ["SHIPPED"],
      SHIPPED: ["DELIVERED", "DELIVERY_FAILED"],
      DELIVERY_FAILED: ["SHIPPED", "RETURNED"],
    } as Record<string, string[]>
  )[String(row.status)] ?? []).filter((status) =>
    (!vietQr || row.paymentStatus === "PAID" || !["PACKED", "SHIPPED"].includes(status)) &&
    (status !== "PACKED" || !needsQc || fulfillmentQc?.outcome === "PASSED")
  );
  const actions = [
    ...(canPick ? ["order-pick-qc"] : []),
    ...(canPick && pickLots.length > 0 ? ["order-repick"] : []),
    ...(row.status === "RETURNED" && row.returnStockStatus === "QUARANTINED" ? ["order-return-qc"] : []),
    ...(row.status === "RETURNED" && row.paymentStatus === "PAID" ? ["order-return-refund"] : []),
    ...(row.paymentStatus === "REVIEW" ? ["payment-resolve"] : []),
    ...(!pendingCod && nextOptions.length ? ["order-status"] : []),
    ...(row.status === "PACKED" ? ["order-reopen-packing"] : []),
    ...(!vietQr && !pendingCod && row.paymentStatus !== "PAID" && !["CANCELLED", "RETURNED"].includes(String(row.status))
      ? ["order-paid"]
      : []),
    ...(["PLACED", "CONFIRMED"].includes(String(row.status)) &&
    !["PAID", "REVIEW"].includes(String(row.paymentStatus))
      ? ["order-cancel"]
      : []),
  ];
  const [action, setAction] = useState(actions[0] ?? "");
  const [next, setNext] = useState(nextOptions[0] ?? "");
  const nextValue = nextOptions.includes(next)
    ? next
    : (nextOptions[0] ?? "");
  const needsPackingSop = action === "order-status" && nextValue === "PACKED" && Boolean(row.packingSopRequired);
  const inspection = row.returnInspection as Row | undefined;
  if (!actions.length)
    return inspection
      ? <p>Đã kiểm hàng hoàn. Biên bản QC: {String(inspection.reference)}.</p>
      : <p>Không còn thao tác xử lý trực tiếp cho đơn này.</p>;
  const title =
    fulfillmentActions[action] ?? (action === "order-return-qc"
      ? "Ghi nhận kiểm định hàng hoàn"
      : action === "order-return-refund"
        ? "Ghi nhận tiền đã hoàn cho đơn trả về"
        : action === "payment-resolve"
      ? "Xử lý đối soát thanh toán (REVIEW)"
      : action === "order-status"
        ? `Chuyển sang ${label(nextValue)}`
        : action === "order-paid"
          ? "Xác nhận đã thu tiền"
          : "Hủy đơn đủ điều kiện");
  return (
    <form
      className="store-form"
      onSubmit={(e) => {
        const b = fields(e);
        if (needsPackingSop) {
          const form = new FormData(e.currentTarget);
          const photo = form.get("packingPhoto");
          if (photo instanceof File && window.confirm(`${title} cho đơn ${row.number}?`)) {
            onSave({ action, status: nextValue, note: b.note, packingSteps: form.getAll("packingSteps") }, photo);
          }
          return;
        }
        if (action === "order-pick-qc") {
          const form = new FormData(e.currentTarget);
          if (window.confirm(`${title} cho đơn ${row.number}?`)) {
            onSave({
              action, reference: b.reference, note: b.note, qcOutcome: b.qcOutcome,
              qcTexture: form.has("qcTexture"), qcAroma: form.has("qcAroma"),
              qcPackaging: form.has("qcPackaging"), qcContents: form.has("qcContents"),
              affectedLotIds: form.getAll("affectedLotIds"),
            });
          }
          return;
        }
        if (action === "order-return-qc") {
          const form = new FormData(e.currentTarget);
          const inspection = inspectionItems.map((item, index) => ({
            productId: item.productId,
            ...(Array.isArray(item.lotAllocations)
              ? { lots: item.lotAllocations.map((lot: Row, lotIndex: number) => ({
                  lotId: lot.lotId,
                  acceptedQuantity: Number(form.get(`accepted-${index}-${lotIndex}`)),
                })) }
              : { acceptedQuantity: Number(form.get(`accepted-${index}`)) }),
          }));
          if (window.confirm(`${title} cho đơn ${row.number}?`)) {
            onSave({
              action, reference: b.reference, note: b.note, inspection,
              packagingChecked: form.has("packagingChecked"),
              qualityChecked: form.has("qualityChecked"),
            });
          }
          return;
        }
        if (window.confirm(`${title} cho đơn ${row.number}?`))
          onSave({ ...b, status: nextValue });
      }}
    >
      <h3>Xử lý đơn hàng</h3>
      {canPick && (
        <section>
          <h4>Phiếu soạn hàng</h4>
          <ul>
            {inspectionItems.map((item) => (
              <li key={String(item.productId)}>
                {String(item.name)} × {Number(item.quantity)}
                {Array.isArray(item.lotAllocations) && (
                  <ul>{(item.lotAllocations as Row[]).map((lot) => (
                    <li key={String(lot.lotId)}>
                      Lô {String(lot.code)} · SL {Number(lot.quantity)} · HSD {String(lot.expiresOn)}
                    </li>
                  ))}</ul>
                )}
              </li>
            ))}
          </ul>
          {fulfillmentQc && <p>QC: {fulfillmentQc.outcome === "PASSED" ? "Đạt" : "Không đạt"} · {String(fulfillmentQc.reference)}</p>}
        </section>
      )}
      <label>
        Thao tác
        <select
          name="action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        >
          {actions.map((a) => (
            <option key={a} value={a}>
              {fulfillmentActions[a] ?? (a === "order-return-qc"
                ? "Kiểm định hàng hoàn"
                : a === "order-return-refund"
                  ? "Ghi nhận khoản hoàn tiền"
                  : a === "payment-resolve"
                ? "Đối soát thanh toán (REVIEW)"
                : a === "order-status"
                  ? `Chuyển sang ${label(nextValue)}`
                  : a === "order-paid"
                    ? "Xác nhận đã thu tiền"
                    : "Hủy đơn")}
            </option>
          ))}
        </select>
      </label>
      {action === "order-pick-qc" && (
        <fieldset>
          <legend>Kiểm định trước đóng gói</legend>
          <label><input type="checkbox" name="qcTexture" /> Kết cấu và độ dẻo đạt</label>
          <label><input type="checkbox" name="qcAroma" /> Mùi và cảm quan đạt</label>
          <label><input type="checkbox" name="qcPackaging" /> Bao bì và niêm phong đạt</label>
          <label><input type="checkbox" name="qcContents" /> Đủ hàng, đúng quy cách và thiệp nếu có</label>
          {pickLots.map((lot) => (
            <label key={String(lot.lotId)}>
              <input type="checkbox" name="affectedLotIds" value={String(lot.lotId)} /> Cách ly lô {String(lot.code)}
            </label>
          ))}
          <label>Kết luận<select name="qcOutcome" required defaultValue="">
            <option value="" disabled>Chọn kết luận</option>
            <option value="PASSED">Đạt</option>
            <option value="FAILED">Không đạt</option>
          </select></label>
          <label>Mã biên bản QC<input name="reference" required maxLength={200} /></label>
        </fieldset>
      )}
      {action === "order-return-qc" && (
        <fieldset>
          <legend>Kiểm định hàng đang cách ly</legend>
          <label><input type="checkbox" name="packagingChecked" required /> Đã kiểm bao bì</label>
          <label><input type="checkbox" name="qualityChecked" required /> Đã kiểm chất lượng</label>
          {inspectionItems.map((item, index) => Array.isArray(item.lotAllocations)
            ? item.lotAllocations.map((lot: Row, lotIndex: number) => (
                <label key={String(lot.lotId)}>
                  {String(item.name)} · Lô {String(lot.code)} · Số lượng đạt
                  <input type="number" name={`accepted-${index}-${lotIndex}`} min={0}
                    max={Number(lot.quantity)} step={1} defaultValue={0} required />
                </label>
              ))
            : (
            <label key={String(item.productId)}>
              {String(item.name)} · Số lượng đạt để nhập lại
              <input type="number" name={`accepted-${index}`} min={0}
                max={Number(item.quantity)} step={1} defaultValue={0} required />
            </label>
          ))}
          <label>Mã biên bản QC<input name="reference" required maxLength={200} /></label>
        </fieldset>
      )}
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
      {needsPackingSop && (
        <fieldset>
          <legend>Đóng gói xanh · 6 bước · mục tiêu 180 giây</legend>
          {packingInstructions.map(([step, description]) => (
            <label key={step}><input type="checkbox" name="packingSteps" value={step} required /> {description}</label>
          ))}
          <label>Ảnh live-packing trước khi đóng hộp
            <input name="packingPhoto" type="file" accept="image/png,image/jpeg" required />
          </label>
          <p>Chụp rõ sản phẩm, mã lô và hạn dùng. Tránh để lộ thông tin người nhận.</p>
        </fieldset>
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
        action === "order-return-refund" ||
        action === "payment-resolve" ||
        (action === "order-status" && nextValue === "SHIPPED")) && (
        <label>
          {action === "order-paid"
            ? "Mã chứng từ thu tiền"
            : action === "order-return-refund"
              ? "Mã chứng từ hoàn tiền"
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

"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Dialog, EmptyState, StatusBadge } from "@/shared/ui";
import { Pagination } from "../workspace-nav";
import {
  discountCondition,
  discountHeadline,
  type OfferRule,
} from "@/lib/discounts";
import { api, ApiError, type Row, useStore } from "@/lib/store";
import { OperationsWorkspace } from "../operations";
import styles from "./admin-discounts.module.css";

type Rule = OfferRule & {
  name: string;
  productId: string;
  productIds?: string[];
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  featured: boolean;
  priority: number;
  message: string;
};
type SavedRule = Rule & { id: string; revision: number };

const timeZone = "Asia/Ho_Chi_Minh";
const dateLabel = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone,
});
const vietnamOffset = 7 * 60 * 60 * 1000;
function offerTime(time: string) {
  if (!/^[2-9]\d{3}-/.test(time)) return NaN;
  return Date.parse(time);
}

function formatOfferTime(time: string) {
  const value = offerTime(time);
  return Number.isFinite(value) ? dateLabel.format(value) : "Ngày không hợp lệ";
}

function toField(time: string | number) {
  const value = typeof time === "string" ? offerTime(time) : time;
  return Number.isFinite(value)
    ? new Date(value + vietnamOffset).toISOString().slice(0, 16)
    : "";
}

function blank(): Rule {
  return {
    name: "",
    scope: "PRODUCT",
    productId: "",
    productIds: [],
    condition: "QUANTITY",
    minimum: 2,
    method: "PERCENT",
    value: 10,
    startsAt: toField(Date.now()),
    endsAt: toField(Date.now() + 7 * 86_400_000),
    enabled: false,
    featured: false,
    priority: 0,
    message: "",
  };
}

const statuses = {
  active: { label: "Đang chạy", tone: "success" },
  scheduled: { label: "Đã lên lịch", tone: "warning" },
  paused: { label: "Chưa bật", tone: "neutral" },
  ended: { label: "Đã kết thúc", tone: "neutral" },
  invalid: { label: "Lịch không hợp lệ", tone: "warning" },
} as const;
const scopeLabels = {
  PRODUCT: "Một sản phẩm",
  PRODUCTS: "Nhóm sản phẩm",
  CART: "Toàn bộ giỏ",
} satisfies Record<OfferRule["scope"], string>;
const pageSize = 8;
type Status = keyof typeof statuses;

function status(rule: Rule, now: number): Status {
  const start = offerTime(rule.startsAt);
  const end = offerTime(rule.endsAt);
  if (!(start < end)) return "invalid";
  if (end <= now) return "ended";
  if (!rule.enabled) return "paused";
  return start > now ? "scheduled" : "active";
}

function searchText(value: string) {
  return value
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d");
}

export function AdminDiscounts() {
  const { state, loading, run, mutate, busy } = useStore();
  const [rows, setRows] = useState<SavedRule[]>([]);
  const [products, setProducts] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<SavedRule | null>(null);
  const [draft, setDraft] = useState<Rule>(blank);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(Date.now);
  const isAdmin = state?.user.role === "ADMIN";

  useEffect(() => {
    if (!isAdmin) return;
    let live = true;
    void Promise.all([api("admin/discounts"), api("admin/products")])
      .then(([rules, catalog]) => {
        if (!live) return;
        setRows(rules);
        setProducts(catalog);
        setError("");
      })
      .catch((problem: Error) => {
        if (live) setError(problem.message);
      })
      .finally(() => {
        if (live) setFetching(false);
      });
    return () => {
      live = false;
    };
  }, [isAdmin, attempt]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function reload() {
    setFetching(true);
    setAttempt((value) => value + 1);
  }

  function update<K extends keyof Rule>(key: K, value: Rule[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFormError("");
  }

  function select(rule: SavedRule | null) {
    setEditing(rule);
    setProductSearch("");
    setDraft(
      rule
        ? {
            ...rule,
            startsAt: toField(rule.startsAt),
            endsAt: toField(rule.endsAt),
          }
        : blank(),
    );
    setFormError("");
    setNotice("");
    setEditorOpen(true);
  }

  function merge(saved: SavedRule) {
    setRows((current) =>
      current.some(({ id }) => id === saved.id)
        ? current.map((rule) => (rule.id === saved.id ? saved : rule))
        : [saved, ...current],
    );
  }

  function report(problem: unknown, editor = true) {
    const setMessage = editor ? setFormError : setActionError;
    setMessage(
      problem instanceof Error ? problem.message : "Không lưu được ưu đãi.",
    );
    if (problem instanceof ApiError && problem.status === 409) {
      if (editor)
        setFormError(
          "Ưu đãi vừa thay đổi. Đóng biểu mẫu và mở lại chương trình để lấy dữ liệu mới.",
        );
      reload();
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setNotice("");
    if (draft.scope === "PRODUCTS" && !draft.productIds?.length) {
      setFormError("Chọn ít nhất một sản phẩm cho nhóm ưu đãi.");
      return;
    }
    const startsAt = new Date(`${draft.startsAt}+07:00`);
    const endsAt = new Date(`${draft.endsAt}+07:00`);
    if (draft.startsAt && draft.endsAt && [startsAt, endsAt].some(
      (date) => date.getUTCFullYear() < 2000 || date.getUTCFullYear() > 9999,
    )) {
      setFormError("Năm áp dụng ưu đãi phải từ 2000 đến 9999.");
      return;
    }
    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      setFormError("Ngày kết thúc phải sau ngày bắt đầu.");
      return;
    }
    void run(async () => {
      try {
        const saved = (await mutate("commerce", "discount-save", {
          ...draft,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          ...(editing ? { id: editing.id, revision: editing.revision } : {}),
        })) as Row & SavedRule;
        merge(saved);
        if (!editing) {
          setQuery("");
          setFilter("");
          setPage(1);
        }
        setEditorOpen(false);
        setNotice("Đã lưu ưu đãi.");
      } catch (problem) {
        report(problem);
      }
    });
  }

  function toggle(rule: SavedRule) {
    setActionError("");
    setNotice("");
    void run(async () => {
      try {
        const saved = (await mutate("commerce", "discount-toggle", {
          id: rule.id,
          revision: rule.revision,
          enabled: !rule.enabled,
        })) as Row & SavedRule;
        merge(saved);
        setNotice(saved.enabled ? "Đã bật ưu đãi." : "Đã tạm dừng ưu đãi.");
      } catch (problem) {
        report(problem, false);
      }
    });
  }

  if (loading) return <main className="store-page">Đang tải quản trị…</main>;
  if (!state)
    return (
      <main className="store-page">
        <Link href="/login">Đăng nhập để quản lý ưu đãi →</Link>
      </main>
    );
  if (!isAdmin)
    return (
      <main className="store-page">
        <h1>Không có quyền truy cập</h1>
      </main>
    );

  const productName = (id: string) =>
    String(
      products.find((item) => item.id === id)?.name ??
        "Sản phẩm chưa chọn hoặc đã xóa",
    );
  const scopeName =
    draft.scope === "PRODUCT" ? productName(draft.productId) : "";
  const selectedIds = draft.productIds ?? [];
  const productOptions = products.map(({ id, name, active }) => ({
    id,
    label: `${name}${active ? "" : " (đang ẩn)"}`,
  }));
  for (const id of selectedIds.filter(
    (id) => !products.some((item) => item.id === id),
  )) {
    productOptions.unshift({ id, label: "Sản phẩm đã xóa · hãy bỏ chọn" });
  }
  const search = searchText(productSearch.trim());
  const matchingProducts = productOptions.filter(
    ({ id, label }) =>
      selectedIds.includes(id) || searchText(label).includes(search),
  );
  const listing = rows.map((rule) => {
    const names =
      rule.scope === "PRODUCTS"
        ? (rule.productIds ?? []).map(productName)
        : rule.scope === "PRODUCT"
          ? [productName(rule.productId)]
          : [];
    return { rule, names, state: status(rule, now) };
  });
  const filtered = listing.filter(
    ({ rule, names, state }) =>
      (!filter || state === filter) &&
      searchText([rule.name, ...names].join(" ")).includes(
        searchText(query.trim()),
      ),
  );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / pageSize)),
  );
  function closeEditor() {
    if (!busy) setEditorOpen(false);
  }

  return (
    <OperationsWorkspace
      section="discounts"
      title="Quản lý ưu đãi"
      description="Đặt điều kiện giảm giá tự động và chọn ưu đãi hiển thị đầu tiên trên cửa hàng."
    >
      <section className={styles.overview} aria-label="Tổng quan ưu đãi">
        {[
          ["Tất cả chương trình", rows.length],
          [
            "Đang chạy",
            listing.filter((item) => item.state === "active").length,
          ],
          [
            "Đã lên lịch",
            listing.filter((item) => item.state === "scheduled").length,
          ],
          [
            "Ưu tiên quảng bá",
            listing.filter(
              ({ rule, state }) =>
                rule.featured && (state === "active" || state === "scheduled"),
            ).length,
          ],
        ].map(([label, count]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{fetching ? "–" : count}</strong>
          </div>
        ))}
      </section>

      {notice && (
        <p role="status" className={styles.success}>
          {notice}
        </p>
      )}
      {actionError && (
        <p role="alert" className={styles.error}>
          {actionError}
        </p>
      )}
      <section className={styles.panel} aria-labelledby="discount-list-heading">
        <header className={styles.panelHeading}>
          <div>
            <h2 id="discount-list-heading">Chương trình ưu đãi</h2>
            <small>
              {filtered.length} chương trình
              {filtered.length !== rows.length && ` / ${rows.length}`}
            </small>
          </div>
          <Button
            onClick={() => select(null)}
            disabled={busy || fetching || Boolean(error)}
          >
            + Tạo ưu đãi
          </Button>
        </header>
        <div className={styles.filters}>
          <label>
            Tìm ưu đãi
            <input
              type="search"
              placeholder="Tên chương trình hoặc sản phẩm"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Trạng thái
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(statuses).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {fetching && (
          <p className={styles.feedback} role="status">
            Đang tải ưu đãi…
          </p>
        )}
        {error && (
          <div className={styles.feedback} role="alert">
            {error}{" "}
            <Button variant="secondary" size="small" onClick={reload}>
              Thử lại
            </Button>
          </div>
        )}
        {!fetching &&
          !error &&
          (filtered.length === 0 ? (
            <div className={styles.feedback}>
              <EmptyState
                title={
                  rows.length
                    ? "Không tìm thấy ưu đãi phù hợp"
                    : "Chưa có chương trình ưu đãi"
                }
              />
            </div>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Chương trình</th>
                      <th scope="col">Phạm vi</th>
                      <th scope="col">Lịch áp dụng</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered
                      .slice(
                        (currentPage - 1) * pageSize,
                        currentPage * pageSize,
                      )
                      .map(({ rule, names, state }) => (
                        <tr key={rule.id}>
                          <td>
                            <strong>{rule.name}</strong>
                            <span className={styles.discount}>
                              {discountHeadline(rule)}
                            </span>
                            <small>
                              {discountCondition(
                                rule,
                                rule.scope === "PRODUCT" ? names[0] : "",
                              )}
                            </small>
                          </td>
                          <td>
                            <span>{scopeLabels[rule.scope]}</span>
                            {names.length > 0 && (
                              <small>{names.join(", ")}</small>
                            )}
                          </td>
                          <td>
                            <time dateTime={rule.startsAt}>
                              {formatOfferTime(rule.startsAt)}
                            </time>
                            <small>
                              Đến{" "}
                              <time dateTime={rule.endsAt}>
                                {formatOfferTime(rule.endsAt)}
                              </time>
                            </small>
                          </td>
                          <td>
                            <StatusBadge tone={statuses[state].tone}>
                              {statuses[state].label}
                            </StatusBadge>
                            {rule.featured && (
                              <small>Ưu tiên quảng bá {rule.priority}</small>
                            )}
                          </td>
                          <td>
                            <div className={styles.ruleActions}>
                              <Button
                                size="small"
                                variant="secondary"
                                onClick={() => select(rule)}
                                disabled={busy}
                              >
                                Chỉnh sửa
                              </Button>
                              {(rule.enabled || (state !== "ended" && state !== "invalid")) && (
                                <Button
                                  size="small"
                                  variant="secondary"
                                  onClick={() => toggle(rule)}
                                  disabled={busy}
                                >
                                  {rule.enabled ? "Tạm dừng" : "Bật ưu đãi"}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {filtered.length > pageSize && (
                <div className={styles.pagination}>
                  <Pagination
                    page={currentPage}
                    total={filtered.length}
                    pageSize={pageSize}
                    onChange={setPage}
                  />
                </div>
              )}
            </>
          ))}
      </section>

      <Dialog
        open={editorOpen}
        title={editing ? "Chỉnh sửa ưu đãi" : "Tạo ưu đãi mới"}
        onClose={closeEditor}
        className={styles.editor}
      >
        {editorOpen && (
          <form onSubmit={save} className={styles.form}>
            <fieldset
              disabled={busy || fetching || Boolean(error)}
              className={styles.formBody}
            >
              <section
                className={styles.formSection}
                aria-labelledby="offer-scope"
              >
                <h3 id="offer-scope">Thông tin và phạm vi</h3>
                <label>
                  Tên ưu đãi
                  <input
                    placeholder="Ví dụ: Mè xửng và trà cung đình giảm 15%"
                    required
                    maxLength={90}
                    value={draft.name}
                    onChange={(event) => update("name", event.target.value)}
                  />
                </label>
                <div className={styles.fields}>
                  <label>
                    Phạm vi
                    <select
                      value={draft.scope}
                      onChange={(event) =>
                        update("scope", event.target.value as Rule["scope"])
                      }
                    >
                      <option value="PRODUCT">Một sản phẩm</option>
                      <option value="PRODUCTS">Nhóm sản phẩm tự chọn</option>
                      <option value="CART">Toàn bộ giỏ hàng</option>
                    </select>
                  </label>
                  {draft.scope === "PRODUCT" && (
                    <label>
                      Sản phẩm
                      <select
                        required
                        value={draft.productId}
                        onChange={(event) =>
                          update("productId", event.target.value)
                        }
                      >
                        <option value="">Chọn sản phẩm</option>
                        {draft.productId &&
                          !products.some(
                            (item) => item.id === draft.productId,
                          ) && (
                            <option value={draft.productId}>
                              Sản phẩm đã xóa
                            </option>
                          )}
                        {products.map(({ id, name, active }) => (
                          <option key={id} value={id}>
                            {String(name)}
                            {active ? "" : " (đang ẩn)"}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {draft.scope === "PRODUCTS" && (
                    <fieldset className={styles.productPicker}>
                      <legend>Sản phẩm áp dụng</legend>
                      <label>
                        Tìm sản phẩm
                        <input
                          type="search"
                          value={productSearch}
                          onChange={(event) =>
                            setProductSearch(event.target.value)
                          }
                        />
                      </label>
                      <p className={styles.help} aria-live="polite">
                        Đã chọn {selectedIds.length} sản phẩm
                      </p>
                      {matchingProducts.length ? (
                        <div className={styles.productChoices}>
                          {matchingProducts.map(({ id, label }) => {
                            const checked = selectedIds.includes(id);
                            return (
                              <label className={styles.check} key={id}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={
                                    !checked && selectedIds.length >= 100
                                  }
                                  onChange={() =>
                                    update(
                                      "productIds",
                                      checked
                                        ? selectedIds.filter(
                                            (item) => item !== id,
                                          )
                                        : [...selectedIds, id],
                                    )
                                  }
                                />
                                {label}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className={styles.help}>
                          Không có sản phẩm phù hợp.
                        </p>
                      )}
                      <p className={styles.help}>
                        Cộng số lượng hoặc tiền hàng của các sản phẩm đã chọn để
                        xét điều kiện.
                      </p>
                    </fieldset>
                  )}
                </div>
              </section>
              <section
                className={styles.formSection}
                aria-labelledby="offer-terms"
              >
                <h3 id="offer-terms">Điều kiện và mức giảm</h3>
                <p>
                  Chỉ sản phẩm bán theo giá thường được tính vào điều kiện.
                  Khoản giảm thực tế phụ thuộc vào giá sàn của từng sản phẩm.
                </p>
                <div className={styles.fields}>
                  <label>
                    Điều kiện
                    <select
                      value={draft.condition}
                      onChange={(event) =>
                        update(
                          "condition",
                          event.target.value as Rule["condition"],
                        )
                      }
                    >
                      <option value="QUANTITY">Số lượng tối thiểu</option>
                      <option value="SUBTOTAL">Tiền hàng tối thiểu</option>
                    </select>
                  </label>
                  <label>
                    {draft.condition === "QUANTITY"
                      ? "Số lượng tối thiểu"
                      : "Tiền hàng tối thiểu (đ)"}
                    <input
                      required
                      type="number"
                      min={1}
                      max={
                        draft.condition === "QUANTITY"
                          ? draft.scope === "PRODUCT"
                            ? 100
                            : 10000
                          : 100000000
                      }
                      value={draft.minimum || ""}
                      onChange={(event) =>
                        update("minimum", Number(event.target.value))
                      }
                    />
                  </label>
                  <label>
                    Hình thức giảm
                    <select
                      value={draft.method}
                      onChange={(event) =>
                        update("method", event.target.value as Rule["method"])
                      }
                    >
                      <option value="PERCENT">Phần trăm</option>
                      <option value="FIXED">Số tiền cố định</option>
                    </select>
                  </label>
                  <label>
                    {draft.method === "PERCENT"
                      ? "Mức giảm (%)"
                      : "Mức giảm (đ)"}
                    <input
                      required
                      type="number"
                      min={1}
                      max={draft.method === "PERCENT" ? 100 : 100000000}
                      value={draft.value || ""}
                      onChange={(event) =>
                        update("value", Number(event.target.value))
                      }
                    />
                  </label>
                </div>
              </section>
              <section
                className={styles.formSection}
                aria-labelledby="offer-schedule"
              >
                <h3 id="offer-schedule">Lịch áp dụng</h3>
                <div className={styles.fields}>
                  <label>
                    Bắt đầu (giờ Việt Nam)
                    <input
                      required
                      type="datetime-local"
                      value={draft.startsAt}
                      onChange={(event) =>
                        update("startsAt", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Kết thúc (giờ Việt Nam)
                    <input
                      required
                      type="datetime-local"
                      value={draft.endsAt}
                      onChange={(event) => update("endsAt", event.target.value)}
                    />
                  </label>
                </div>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(event) =>
                      update("enabled", event.target.checked)
                    }
                  />{" "}
                  Bật ưu đãi theo lịch
                </label>
              </section>
              <section
                className={styles.formSection}
                aria-labelledby="offer-promo"
              >
                <h3 id="offer-promo">Hiển thị trên cửa hàng</h3>
                <p>
                  Ưu đãi đang chạy xuất hiện trong thẻ nổi. Khách có thể xem các
                  ưu đãi khác khi nhiều chương trình cùng chạy.
                </p>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={draft.featured}
                    onChange={(event) =>
                      update("featured", event.target.checked)
                    }
                  />{" "}
                  Ưu tiên hiển thị trước
                </label>
                <div className={styles.fields}>
                  {draft.featured && (
                    <label>
                      Độ ưu tiên (0–999)
                      <input
                        required
                        type="number"
                        min={0}
                        max={999}
                        value={draft.priority}
                        onChange={(event) =>
                          update("priority", Number(event.target.value))
                        }
                      />
                    </label>
                  )}
                  <label>
                    Dòng giới thiệu (tùy chọn)
                    <input
                      maxLength={120}
                      value={draft.message}
                      onChange={(event) =>
                        update("message", event.target.value)
                      }
                    />
                  </label>
                </div>
                <aside className={styles.preview} aria-label="Xem trước ưu đãi">
                  <small>Xem trước thẻ quảng bá</small>
                  {draft.name && <span>{draft.name}</span>}
                  <strong>{discountHeadline(draft)}</strong>
                  <span>
                    {draft.scope === "PRODUCT" && !draft.productId
                      ? "Chọn sản phẩm để xem điều kiện ưu đãi."
                      : discountCondition(draft, scopeName)}
                  </span>
                  {draft.message && <span>{draft.message}</span>}
                </aside>
              </section>
            </fieldset>
            <div className={styles.formFooter}>
              {formError && (
                <p role="alert" className={styles.error}>
                  {formError}
                </p>
              )}
              <div>
                <Button
                  variant="secondary"
                  onClick={closeEditor}
                  disabled={busy}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  loading={busy}
                  disabled={fetching || Boolean(error)}
                >
                  {editing ? "Lưu thay đổi" : "Lưu ưu đãi"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Dialog>
    </OperationsWorkspace>
  );
}

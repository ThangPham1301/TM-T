"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { priceLabels, vietnamTime, type RuleType } from "@/lib/pricing";
import { api, money, type Row, useStore } from "@/lib/store";
import { Button, Dialog, EmptyState, StatusBadge } from "@/shared/ui";
import { OperationsWorkspace } from "../operations";
import { usePricing } from "./use-pricing";
import styles from "./admin-pricing.module.css";

type Target = { productId: string; price: number };
type Draft = {
  name: string;
  type: RuleType;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  threshold: number;
  targets: Target[];
};
type Rule = Omit<Draft, "startsAt" | "endsAt"> & {
  id: string;
  revision: number;
  startsAt: string | null;
  endsAt: string | null;
};

const ruleTypes = {
  SCHEDULE: { label: "Theo lịch", help: "Áp dụng trong khung giờ đã chọn." },
  STOCK: { label: "Theo tồn kho", help: "Áp dụng khi tồn kho đạt ngưỡng." },
  DEMAND: {
    label: "Theo sức mua",
    help: "Áp dụng khi lượng bán không vượt ngưỡng.",
  },
} satisfies Record<RuleType, { label: string; help: string }>;
const ruleTypeKeys = Object.keys(ruleTypes) as RuleType[];
const ruleStatuses = {
  active: "Đang áp dụng / theo dõi",
  scheduled: "Đã lên lịch",
  paused: "Đã tắt",
  ended: "Đã kết thúc",
};

function searchKey(value: string) {
  return value
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .trim();
}

const HOUR = 3_600_000;
const formatInput = (time: number) =>
  new Date(time + 7 * HOUR).toISOString().slice(0, 16);
const blank = (): Draft => ({
  name: "",
  type: "SCHEDULE",
  enabled: false,
  startsAt: formatInput(Date.now() + 15 * 60_000),
  endsAt: formatInput(Date.now() + 3 * HOUR),
  threshold: 5,
  targets: [],
});

function status(rule: Rule, now: number) {
  if (rule.endsAt && Date.parse(rule.endsAt) <= now)
    return {
      key: "ended",
      label: ruleStatuses.ended,
      tone: "neutral" as const,
    };
  if (!rule.enabled)
    return {
      key: "paused",
      label: ruleStatuses.paused,
      tone: "neutral" as const,
    };
  if (rule.startsAt && Date.parse(rule.startsAt) > now)
    return {
      key: "scheduled",
      label: ruleStatuses.scheduled,
      tone: "warning" as const,
    };
  return {
    key: "active",
    label: rule.type === "SCHEDULE" ? "Đang áp dụng" : "Đang theo dõi",
    tone: "success" as const,
  };
}

export function AdminPricing() {
  const { state, loading } = useStore();
  if (loading) return <main className="store-page">Đang tải tài khoản…</main>;
  if (state?.user.role !== "ADMIN")
    return (
      <main className="store-page">
        <Link href="/login">Đăng nhập Admin để quản lý giá</Link>
      </main>
    );
  return <PricingWorkspace />;
}

function PricingWorkspace() {
  const { busy, mutate, run } = useStore();
  const { feed, reload: reloadPricing } = usePricing();
  const [rules, setRules] = useState<Rule[]>([]);
  const [products, setProducts] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [editorError, setEditorError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<"rule" | "floor" | null>(null);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [selection, setSelection] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [floorId, setFloorId] = useState("");
  const [floor, setFloor] = useState(1);
  const [view, setView] = useState<"rules" | "floors">("rules");
  const [ruleSearch, setRuleSearch] = useState("");
  const [floorSearch, setFloorSearch] = useState("");
  const [filter, setFilter] = useState<RuleType | "">("");
  const [statusFilter, setStatusFilter] = useState("");
  const byId = new Map(products.map((product) => [product.id, product]));
  const name = (id: string) => String(byId.get(id)?.name ?? "Sản phẩm đã xóa");
  const [loadedAt] = useState(Date.now);
  const now = feed ? Date.parse(feed.asOf) : loadedAt;
  const query = searchKey(ruleSearch);
  const shownRules = rules
    .map((rule) => ({ rule, badge: status(rule, now) }))
    .filter(
      ({ rule, badge }) =>
        (!filter || filter === rule.type) &&
        (!statusFilter || statusFilter === badge.key) &&
        (!query ||
          searchKey(rule.name).includes(query) ||
          rule.targets.some((target) =>
            searchKey(name(target.productId)).includes(query),
          )),
    );
  const floorQuery = searchKey(floorSearch);
  const shownProducts = products.filter((product) =>
    searchKey(String(product.name)).includes(floorQuery),
  );
  const missingFloors = products.filter(
    (product) => product.priceFloor == null,
  ).length;
  const targetQuery = searchKey(targetSearch);
  const targetOptions = products.filter(
    (product) =>
      searchKey(String(product.name)).includes(targetQuery) &&
      !draft.targets.some((target) => target.productId === product.id),
  );

  useEffect(() => {
    let active = true;
    void Promise.all([api("admin/pricing"), api("admin/products")])
      .then(([received, catalog]) => {
        if (active) {
          setRules(received);
          setProducts(catalog);
        }
      })
      .catch((error: Error) => {
        if (active) setActionError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  function open(rule?: Rule) {
    setEditing(rule ?? null);
    setDraft(
      rule
        ? {
            ...rule,
            startsAt: rule.startsAt
              ? formatInput(Date.parse(rule.startsAt))
              : "",
            endsAt: rule.endsAt ? formatInput(Date.parse(rule.endsAt)) : "",
          }
        : blank(),
    );
    setSelection("");
    setTargetSearch("");
    setEditorError("");
    setDialog("rule");
  }

  function chooseFloor(id: string) {
    const product = byId.get(id);
    setFloorId(id);
    setFloor(Number(product?.priceFloor ?? product?.price ?? 1));
    setEditorError("");
  }

  function openFloor(id: string) {
    chooseFloor(id);
    setDialog("floor");
  }

  function changeType(type: RuleType) {
    setDraft((current) => ({
      ...current,
      type,
      threshold: type === "STOCK" ? 40 : 5,
      startsAt: current.startsAt || formatInput(Date.now() + 15 * 60_000),
      endsAt: current.endsAt || formatInput(Date.now() + 3 * HOUR),
    }));
    setEditorError("");
  }

  function refresh() {
    setLoading(true);
    setAttempt((value) => value + 1);
    reloadPricing();
  }

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setEditorError("");
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function execute(
    action: string,
    data: Record<string, unknown>,
    success: string,
    inEditor = true,
  ) {
    setNotice("");
    setActionError("");
    setEditorError("");
    void run(async () => {
      try {
        await mutate("commerce", action, data);
        setDialog(null);
        setNotice(success);
        refresh();
      } catch (error) {
        const report = inEditor ? setEditorError : setActionError;
        report(
          error instanceof Error
            ? error.message
            : "Không cập nhật được quy tắc giá.",
        );
      }
    });
  }

  function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.targets.length) {
      setEditorError("Thêm ít nhất một sản phẩm vào quy tắc.");
      return;
    }
    const schedule = draft.type === "SCHEDULE";
    const start = new Date(draft.startsAt + "+07:00");
    const end = new Date(draft.endsAt + "+07:00");
    if (
      schedule &&
      (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start)
    ) {
      setEditorError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }
    execute(
      "pricing-save",
      {
        ...draft,
        ...(editing ? { id: editing.id, revision: editing.revision } : {}),
        startsAt: schedule ? start.toISOString() : "",
        endsAt: schedule ? end.toISOString() : "",
      },
      "Đã lưu quy tắc giá.",
    );
  }

  const floorProduct = byId.get(floorId);
  const floorRoom =
    floorProduct && Math.max(0, Number(floorProduct.price) - floor);
  const hasRuleFilters = Boolean(query || filter || statusFilter);
  return (
    <OperationsWorkspace
      section="pricing"
      title="Quản lý giá bán"
      description="Đặt giá theo lịch, tồn kho hoặc sức mua của các đơn đã xác nhận."
    >
      <div
        className={styles.viewSwitch}
        role="group"
        aria-label="Nội dung quản lý giá"
      >
        <button
          type="button"
          aria-pressed={view === "rules"}
          onClick={() => setView("rules")}
        >
          Quy tắc giá {!loading && <span>{rules.length}</span>}
        </button>
        <button
          type="button"
          aria-pressed={view === "floors"}
          onClick={() => setView("floors")}
        >
          Giá sàn sản phẩm{" "}
          {!loading && missingFloors > 0 && (
            <span>{missingFloors} chưa đặt</span>
          )}
        </button>
      </div>
      <section className={styles.panel} aria-labelledby="pricing-section">
        <div className={styles.toolbar}>
          <div>
            <h2 id="pricing-section">
              {view === "rules" ? "Quy tắc giá" : "Giá sàn sau ưu đãi"}
            </h2>
            <p>
              {view === "rules"
                ? "Thứ tự áp dụng: theo lịch, theo tồn kho, theo sức mua, rồi đến giá thường."
                : "Sản phẩm chưa đặt sàn dùng giá thường làm mức thực thu tối thiểu."}
            </p>
          </div>
          {view === "rules" && (
            <Button disabled={loading || busy} onClick={() => open()}>
              + Tạo quy tắc
            </Button>
          )}
        </div>
        {view === "rules" ? (
          <div className={styles.filters}>
            <label>
              Tìm quy tắc
              <input
                type="search"
                placeholder="Nhập tên quy tắc hoặc sản phẩm"
                value={ruleSearch}
                onChange={(event) => setRuleSearch(event.target.value)}
              />
            </label>
            <label>
              Loại quy tắc
              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as RuleType | "")
                }
              >
                <option value="">Tất cả loại</option>
                {ruleTypeKeys.map((type) => (
                  <option key={type} value={type}>
                    {ruleTypes[type].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(ruleStatuses).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className={styles.productFilter}>
            <label>
              Tìm sản phẩm
              <input
                type="search"
                placeholder="Nhập tên sản phẩm"
                value={floorSearch}
                onChange={(event) => setFloorSearch(event.target.value)}
              />
            </label>
            {!loading && (
              <small>
                {shownProducts.length} / {products.length} sản phẩm
              </small>
            )}
          </div>
        )}
        {loading && (
          <p className={styles.feedback} role="status">
            Đang tải dữ liệu giá bán…
          </p>
        )}
        {actionError && (
          <div className={styles.error} role="alert">
            {actionError}{" "}
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                setActionError("");
                refresh();
              }}
            >
              Tải lại
            </Button>
          </div>
        )}
        {notice && (
          <p role="status" className={styles.success}>
            {notice}
          </p>
        )}
        {view === "rules" &&
          !loading &&
          !actionError &&
          shownRules.length === 0 && (
            <EmptyState
              title={
                hasRuleFilters
                  ? "Không tìm thấy quy tắc phù hợp"
                  : "Chưa có quy tắc giá"
              }
              action={
                hasRuleFilters ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRuleSearch("");
                      setFilter("");
                      setStatusFilter("");
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                ) : (
                  <Button onClick={() => open()}>Tạo quy tắc đầu tiên</Button>
                )
              }
            />
          )}
        {view === "rules" && (
          <div className={styles.list}>
            {shownRules.map(({ rule, badge }) => {
              const targets = (
                <ul className={styles.ruleTargets}>
                  {rule.targets.map((target) => (
                    <li key={target.productId}>
                      <span>{name(target.productId)}</span>
                      <strong>{money(target.price)}</strong>
                      {feed?.prices[target.productId]?.ruleId === rule.id && (
                        <StatusBadge tone="success">Giá đang bán</StatusBadge>
                      )}
                    </li>
                  ))}
                </ul>
              );
              return (
                <article className={styles.rule} key={rule.id}>
                  <div className={styles.ruleInfo}>
                    <div className={styles.ruleHead}>
                      <h3>{rule.name}</h3>
                      <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                    </div>
                    <p>
                      {priceLabels[rule.type]} ·{" "}
                      {rule.startsAt && rule.endsAt
                        ? `${vietnamTime.format(new Date(rule.startsAt))} đến ${vietnamTime.format(new Date(rule.endsAt))}`
                        : rule.type === "STOCK"
                          ? `Tồn từ ${rule.threshold} sản phẩm`
                          : `Bán tối đa ${rule.threshold} sản phẩm trong 3 ngày trước`}
                    </p>
                  </div>
                  <div className={styles.actions}>
                    <Button
                      size="small"
                      variant="secondary"
                      disabled={busy || loading}
                      onClick={() => open(rule)}
                    >
                      Chỉnh sửa
                    </Button>
                    {(rule.enabled || badge.label !== "Đã kết thúc") && (
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={busy || loading}
                        onClick={() =>
                          execute(
                            "pricing-toggle",
                            {
                              id: rule.id,
                              revision: rule.revision,
                              enabled: !rule.enabled,
                            },
                            rule.enabled
                              ? "Đã tạm dừng quy tắc."
                              : "Đã bật quy tắc.",
                            false,
                          )
                        }
                      >
                        {rule.enabled ? "Tạm dừng" : "Bật quy tắc"}
                      </Button>
                    )}
                  </div>
                  {rule.targets.length > 4 ? (
                    <details className={styles.targetDetails}>
                      <summary>Xem {rule.targets.length} sản phẩm</summary>
                      {targets}
                    </details>
                  ) : (
                    targets
                  )}
                </article>
              );
            })}
          </div>
        )}
        {view === "floors" && shownProducts.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.floorTable} aria-label="Giá sàn sản phẩm">
              <thead>
                <tr>
                  <th scope="col">Sản phẩm</th>
                  <th scope="col">Giá thường</th>
                  <th scope="col">Giá sàn</th>
                  <th scope="col">Có thể giảm tối đa</th>
                  <th scope="col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {shownProducts.map((product) => {
                  const base = Number(product.price);
                  const minimum = Number(product.priceFloor ?? base);
                  return (
                    <tr key={product.id}>
                      <th scope="row">
                        {String(product.name)}
                        {product.active === false && <small>Đang ẩn</small>}
                      </th>
                      <td>{money(base)}</td>
                      <td>
                        <strong>{money(minimum)}</strong>
                        {product.priceFloor == null && (
                          <small>Theo giá thường</small>
                        )}
                      </td>
                      <td>{money(Math.max(0, base - minimum))}</td>
                      <td>
                        <Button
                          size="small"
                          variant="secondary"
                          disabled={busy || loading}
                          aria-label={`Cập nhật giá sàn của ${String(product.name)}`}
                          onClick={() => openFloor(product.id)}
                        >
                          {product.priceFloor == null
                            ? "Đặt giá sàn"
                            : "Cập nhật"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {view === "floors" &&
          !loading &&
          !actionError &&
          shownProducts.length === 0 && (
            <EmptyState
              title={
                floorQuery
                  ? "Không tìm thấy sản phẩm"
                  : "Chưa có sản phẩm để đặt giá sàn"
              }
            />
          )}
      </section>

      <Dialog
        open={dialog === "rule"}
        className={styles.dialog}
        title={editing ? "Chỉnh sửa quy tắc giá" : "Tạo quy tắc giá"}
        onClose={() => !busy && setDialog(null)}
      >
        {dialog === "rule" && (
          <form className={styles.form} onSubmit={saveRule}>
            <section
              className={styles.formSection}
              aria-labelledby="pricing-rule-settings"
            >
              <h3 id="pricing-rule-settings">Thông tin và điều kiện</h3>
              <label>
                Tên quy tắc
                <input
                  required
                  maxLength={90}
                  placeholder="Ví dụ: Giá mè xửng khi tồn cao"
                  value={draft.name}
                  onChange={(event) => change("name", event.target.value)}
                />
              </label>
              <fieldset className={styles.typeChoices}>
                <legend>Cách định giá</legend>
                <div>
                  {ruleTypeKeys.map((type) => (
                    <label className={styles.typeChoice} key={type}>
                      <input
                        type="radio"
                        name="pricing-rule-type"
                        value={type}
                        checked={draft.type === type}
                        onChange={() => changeType(type)}
                      />
                      <span>
                        <strong>{ruleTypes[type].label}</strong>
                        <small>{ruleTypes[type].help}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {draft.type === "SCHEDULE" ? (
                <div className={styles.two}>
                  <label>
                    Bắt đầu (giờ Việt Nam)
                    <input
                      type="datetime-local"
                      required
                      value={draft.startsAt}
                      onChange={(event) =>
                        change("startsAt", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Kết thúc (giờ Việt Nam)
                    <input
                      type="datetime-local"
                      required
                      value={draft.endsAt}
                      onChange={(event) => change("endsAt", event.target.value)}
                    />
                  </label>
                </div>
              ) : (
                <label>
                  {draft.type === "STOCK"
                    ? "Tồn kho tối thiểu"
                    : "Số lượng bán tối đa trong 3 ngày trước"}
                  <input
                    type="number"
                    required
                    min={draft.type === "STOCK" ? 1 : 0}
                    max={1000000}
                    value={draft.threshold}
                    onChange={(event) =>
                      change("threshold", Number(event.target.value))
                    }
                  />
                </label>
              )}
              {draft.type === "DEMAND" && (
                <small>
                  Hệ thống cập nhật sức mua lúc 00:00 theo giờ Việt Nam, dựa
                  trên các đơn đã xác nhận trong 3 ngày trọn vẹn trước đó.
                </small>
              )}
            </section>
            <section
              className={styles.formSection}
              aria-labelledby="pricing-rule-products"
            >
              <h3 id="pricing-rule-products">Sản phẩm và giá áp dụng</h3>
              <p className={styles.help}>
                Giá theo quy tắc phải bằng hoặc cao hơn giá sàn. Sản phẩm dùng
                giá này sẽ không cộng thêm ưu đãi giỏ hàng.
              </p>
              <label>
                Tìm sản phẩm để thêm
                <input
                  type="search"
                  value={targetSearch}
                  placeholder="Nhập tên sản phẩm"
                  onChange={(event) => {
                    setTargetSearch(event.target.value);
                    setSelection("");
                  }}
                />
              </label>
              <div className={styles.selectTarget}>
                <label>
                  Sản phẩm áp dụng
                  <select
                    value={selection}
                    onChange={(event) => setSelection(event.target.value)}
                  >
                    <option value="">
                      {targetOptions.length > 0
                        ? "Chọn sản phẩm"
                        : "Không còn sản phẩm phù hợp"}
                    </option>
                    {targetOptions.map((product) => (
                      <option value={product.id} key={product.id}>
                        {String(product.name)}
                        {product.active === false ? " (đang ẩn)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  variant="secondary"
                  disabled={!selection || draft.targets.length >= 100}
                  onClick={() => {
                    const product = byId.get(selection);
                    if (!product) return;
                    change("targets", [
                      ...draft.targets,
                      { productId: product.id, price: Number(product.price) },
                    ]);
                    setSelection("");
                    setTargetSearch("");
                  }}
                >
                  Thêm sản phẩm
                </Button>
              </div>
              {draft.targets.length === 0 && (
                <p className={styles.formEmpty}>Chưa chọn sản phẩm áp dụng.</p>
              )}
              {draft.targets.map((target) => {
                const product = byId.get(target.productId);
                const base = Number(product?.price ?? target.price);
                const minimum = Number(product?.priceFloor ?? base);
                const belowFloor = target.price > 0 && target.price < minimum;
                const difference = target.price - base;
                return (
                  <div className={styles.target} key={target.productId}>
                    <div>
                      <strong>{name(target.productId)}</strong>
                      <small>
                        Giá thường {money(base)} · Giá sàn {money(minimum)}
                        {product &&
                          product.priceFloor == null &&
                          " (theo giá thường)"}
                      </small>
                      <small>
                        {!target.price || difference === 0
                          ? "Bằng giá thường"
                          : `${difference < 0 ? "Thấp hơn" : "Cao hơn"} giá thường ${money(Math.abs(difference))}`}
                      </small>
                    </div>
                    <label>
                      Giá áp dụng (đ)
                      <input
                        required
                        type="number"
                        min={minimum}
                        max={10000000}
                        aria-invalid={belowFloor || undefined}
                        aria-describedby={
                          belowFloor
                            ? `pricing-floor-${target.productId}`
                            : undefined
                        }
                        value={target.price || ""}
                        onChange={(event) => {
                          change(
                            "targets",
                            draft.targets.map((item) =>
                              item.productId === target.productId
                                ? { ...item, price: Number(event.target.value) }
                                : item,
                            ),
                          );
                        }}
                      />
                      {belowFloor && (
                        <small
                          className={styles.fieldError}
                          id={`pricing-floor-${target.productId}`}
                        >
                          Tối thiểu {money(minimum)}
                        </small>
                      )}
                    </label>
                    <Button
                      variant="secondary"
                      size="small"
                      aria-label={`Bỏ ${name(target.productId)}`}
                      onClick={() =>
                        change(
                          "targets",
                          draft.targets.filter(
                            (item) => item.productId !== target.productId,
                          ),
                        )
                      }
                    >
                      Bỏ
                    </Button>
                  </div>
                );
              })}
            </section>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => change("enabled", event.target.checked)}
              />
              <span>
                <strong>Bật quy tắc</strong>
                <small>
                  {draft.enabled
                    ? "Giá được áp dụng khi đủ điều kiện."
                    : "Có thể bật sau từ danh sách quy tắc."}
                </small>
              </span>
            </label>
            {editorError && (
              <p role="alert" className={styles.error}>
                {editorError}
              </p>
            )}
            <div className={styles.formActions}>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                Hủy
              </Button>
              <Button type="submit" loading={busy}>
                {editing ? "Lưu thay đổi" : "Lưu quy tắc"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={dialog === "floor"}
        title="Thiết lập giá sàn sau ưu đãi"
        onClose={() => !busy && setDialog(null)}
      >
        {dialog === "floor" && (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              if (floorProduct)
                execute(
                  "pricing-floor",
                  { id: floorId, revision: floorProduct.revision, floor },
                  "Đã cập nhật giá sàn.",
                );
            }}
          >
            <label>
              Sản phẩm
              <select
                value={floorId}
                required
                onChange={(event) => chooseFloor(event.target.value)}
              >
                <option value="">Chọn sản phẩm</option>
                {products.map((product) => (
                  <option value={product.id} key={product.id}>
                    {String(product.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Giá sàn sau ưu đãi (đ)
              <input
                required
                type="number"
                min={1}
                max={Number(floorProduct?.price ?? 10000000)}
                value={floor || ""}
                onChange={(event) => setFloor(Number(event.target.value))}
              />
            </label>
            {floorProduct && (
              <dl className={styles.floorPreview}>
                <div>
                  <dt>Giá thường</dt>
                  <dd>{money(floorProduct.price)}</dd>
                </div>
                <div>
                  <dt>Có thể giảm tối đa mỗi đơn vị</dt>
                  <dd>{floor > 0 ? money(floorRoom) : "—"}</dd>
                </div>
              </dl>
            )}
            <small className={styles.help}>
              Giá sàn là số tiền hàng thấp nhất trên mỗi đơn vị sau ưu đãi.
            </small>
            {editorError && (
              <p role="alert" className={styles.error}>
                {editorError}
              </p>
            )}
            <div className={styles.formActions}>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                Hủy
              </Button>
              <Button type="submit" loading={busy} disabled={!floorProduct}>
                Lưu giá sàn
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </OperationsWorkspace>
  );
}

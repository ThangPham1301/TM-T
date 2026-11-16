"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, fields, money, type Row, useStore } from "@/lib/store";
import { WorkspaceNav, Pagination } from "./workspace-nav";
import { OperationsWorkspace } from "./operations";
import { ProductImage } from "./product/product-image";

export function CatalogAdmin({
  section,
}: {
  section: "products" | "categories" | "settings";
}) {
  const { state, loading, busy, run, mutate, logout } = useStore();
  const [products, setProducts] = useState<Row[]>([]),
    [categories, setCategories] = useState<Row[]>([]),
    [shipping, setShipping] = useState<Row | null>(null),
    [loadError, setLoadError] = useState(""),
    [selected, setSelected] = useState<Row | null>(null);
  const [query, setQuery] = useState(""),
    [active, setActive] = useState(""),
    [category, setCategory] = useState(""),
    [page, setPage] = useState(1);
  const [file, setFile] = useState<File | null>(null),
    [fileError, setFileError] = useState(""),
    [removeImage, setRemoveImage] = useState(false);
  const uploaded = useRef<{ file: File; id: string } | null>(null);
  useEffect(() => {
    let live = true;
    if (state?.user.role === "ADMIN")
      void Promise.all([
        api("admin/products"),
        api("admin/categories"),
        api("shipping"),
      ])
        .then(([p, c, s]) => {
          if (live) {
            setProducts(p);
            setCategories(c);
            setShipping(s);
            setLoadError("");
          }
        })
        .catch((e) => {
          if (live) setLoadError(e.message);
        });
    return () => {
      live = false;
    };
  }, [state]);
  if (loading) return <main className="store-page">Đang tải quản trị…</main>;
  if (!state)
    return (
      <main className="store-page">
        <Link href="/login">Đăng nhập để tiếp tục</Link>
      </main>
    );
  if (state.user.role !== "ADMIN")
    return (
      <main className="store-page">
        <h1>Không có quyền truy cập</h1>
      </main>
    );
  const isProduct = section === "products",
    source = isProduct ? products : categories;
  const matches = source.filter(
    (r) =>
      (!query ||
        `${r.name} ${r.slug ?? r.code}`
          .toLocaleLowerCase("vi")
          .includes(query.toLocaleLowerCase("vi"))) &&
      (!active || String(r.active) === active) &&
      (!isProduct || !category || r.category === category),
  );
  const safePage = Math.min(page, Math.max(1, Math.ceil(matches.length / 8))),
    rows = matches.slice((safePage - 1) * 8, safePage * 8);
  function edit(row: Row) {
    setSelected(row);
    setFile(null);
    setFileError("");
    setRemoveImage(false);
    uploaded.current = null;
  }
  async function imageId() {
    if (!file) return undefined;
    if (uploaded.current?.file === file) return uploaded.current.id;
    const intent = await api(
      "commerce",
      "POST",
      { action: "catalog-image-intent", name: file.name },
      crypto.randomUUID(),
    );
    const response = await fetch(
      `/api/store/catalog/images/${intent.id}/content`,
      {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      },
    );
    if (!response.ok) {
      const e = await response.json();
      throw new Error(e.message ?? "Không thể tải ảnh.");
    }
    uploaded.current = { file, id: intent.id };
    return intent.id;
  }
  if (section === "settings") {
    return (
      <OperationsWorkspace
        section={section}
        title="Cấu hình bán hàng & vận chuyển"
        description="Quản lý phí giao hàng và trạng thái tiếp nhận đơn mới."
        userName={String(state.user.name)}
        onLogout={() => void logout()}
      >
        <aside className="operations-notice">
          <span className="operations-notice-mark" aria-hidden="true">!</span>
          <div><h2>Lưu ý nghiệp vụ quan trọng</h2><p>Mức phí mới có hiệu lực với đơn đặt sau khi lưu. Các đơn đã đặt giữ mức phí cũ.</p></div>
          {shipping && <span className="store-status-chip">Phiên bản {String(shipping.revision)}</span>}
        </aside>
        {loadError && <p className="store-error">{loadError}</p>}
        {!shipping && !loadError && <p className="store-empty">Đang tải cấu hình…</p>}
        {shipping && (
          <form className="store-form operations-settings" key={String(shipping.revision)} onSubmit={(event) => {
            const b = fields(event);
            if (!window.confirm("Lưu cấu hình phí giao hàng mới? Đơn đã đặt vẫn giữ phí cũ.")) return;
            void run(async () => {
              await mutate("commerce", "shipping-save", {
                revision: shipping.revision,
                baseFee: Number(b.baseFee),
                freeShippingThreshold: Number(b.freeShippingThreshold),
                enabled: b.enabled === "yes",
                pauseMessage: b.pauseMessage,
              });
            });
          }}>
            <div className="operations-settings-grid">
              <section className="store-card operations-shipping">
                <h2>Cấu hình vận chuyển tiêu chuẩn</h2>
                <label>
                  Phí vận chuyển cơ bản (VND)
                  <input name="baseFee" type="number" required min={0} max={1000000} defaultValue={Number(shipping.baseFee)} />
                </label>
                <label>
                  Ngưỡng miễn phí vận chuyển (VND)
                  <input name="freeShippingThreshold" type="number" required min={0} max={100000000} defaultValue={Number(shipping.freeShippingThreshold)} />
                </label>
                <p className="store-subtle">Nhập 0 để tắt miễn phí. Hệ thống tính theo tổng tiền hàng khi thanh toán.</p>
              </section>
              <section className="store-card operations-order-intake">
                <h2>Trạng thái tiếp nhận đơn hàng</h2>
                <label>
                  <input type="radio" name="enabled" value="yes" defaultChecked={Boolean(shipping.enabled)} />
                  <span><strong>Đang tiếp nhận đơn bình thường</strong><small>Khách có thể đặt đơn mới tại cửa hàng.</small></span>
                </label>
                <label>
                  <input type="radio" name="enabled" value="no" defaultChecked={!shipping.enabled} />
                  <span><strong>Tạm ngừng tiếp nhận đơn mới</strong><small>Khách vẫn có thể xem sản phẩm và giỏ hàng.</small></span>
                </label>
                <div className="operations-pause-message">
                  <label>
                    Thông báo hiển thị cho khách hàng
                    <textarea name="pauseMessage" rows={4} maxLength={250}
                      defaultValue={String(shipping.pauseMessage ?? "")}
                      placeholder="Cửa hàng đang tạm ngừng nhận đơn mới." />
                  </label>
                  <p className="store-subtle">Tối đa 250 ký tự. Thông báo hiện trên trang chủ, giỏ hàng và thanh toán khi tạm ngừng nhận đơn.</p>
                </div>
              </section>
            </div>
            <footer className="operations-savebar">
              <span>Cấu hình có hiệu lực sau khi bạn lưu thay đổi.</span>
              <button type="reset" className="store-btn-secondary" disabled={busy}>Khôi phục giá trị đã lưu</button>
              <button disabled={busy}>Lưu thay đổi cấu hình</button>
            </footer>
          </form>
        )}
      </OperationsWorkspace>
    );
  }
  return (
    <main className="store-page">
      <header className="store-heading">
        <span className="eyebrow">Quản trị cửa hàng</span>
        <h1>
          {isProduct ? "Sản phẩm & tồn kho" : "Danh mục sản phẩm"}
        </h1>
      </header>
      <WorkspaceNav admin section={section} />
      {loadError && <p className="store-error">{loadError}</p>}
        <>
          <section className="store-card">
            <div className="store-list-heading">
              <h2>{isProduct ? "Danh sách sản phẩm" : "Danh sách danh mục"}</h2>
              <button
                disabled={busy}
                onClick={() => edit({ id: "new", active: true })}
              >
                + Thêm {isProduct ? "sản phẩm" : "danh mục"}
              </button>
            </div>
            <div className="store-filters">
              <label>
                Tìm theo tên/mã
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Nhập từ khóa…"
                />
              </label>
              <label>
                Trạng thái
                <select
                  value={active}
                  onChange={(e) => {
                    setActive(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Tất cả</option>
                  <option value="true">Đang hiển thị</option>
                  <option value="false">Đã ẩn</option>
                </select>
              </label>
              {isProduct && (
                <label>
                  Danh mục
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Tất cả</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.code)}>
                        {String(c.name)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {!rows.length && <p>Không có kết quả phù hợp.</p>}
            {rows.map((r) => (
              <article className="store-management-row" key={r.id}>
                <ProductImage
                  src={String(r.image)}
                  alt={String(r.name)}
                  width={100}
                  height={85}
                />
                <div>
                  <strong>{String(r.name)}</strong>
                  <p>
                    {String(r.slug ?? r.code)} ·{" "}
                    {r.active ? "Hiển thị" : "Đã ẩn"}
                  </p>
                  <small>
                    {isProduct
                      ? `${money(r.price)} · Tồn ${r.stock}`
                      : `Thứ tự ${r.sortOrder}`}
                  </small>
                </div>
                <div className="store-row-actions">
                  <button disabled={busy} onClick={() => edit(r)}>
                    Sửa
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        r.active &&
                        !window.confirm(
                          `Ẩn “${r.name}”? ${isProduct ? "Sản phẩm sẽ ngừng bán." : "Sản phẩm thuộc danh mục cũng bị ẩn khỏi cửa hàng."}`,
                        )
                      )
                        return;
                      void run(async () => {
                        await mutate("commerce", "catalog-toggle", {
                          id: r.id,
                          revision: r.revision,
                          kind: isProduct ? "product" : "category",
                          active: !r.active,
                        });
                      });
                    }}
                  >
                    {r.active ? "Ẩn" : "Hiện"}
                  </button>
                  <button
                    disabled={busy}
                    className="store-danger"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Xóa “${r.name}”? Chỉ xóa được khi chưa có dữ liệu liên kết.`,
                        )
                      )
                        return;
                      void run(async () => {
                        await mutate(
                          "commerce",
                          isProduct ? "product-delete" : "category-delete",
                          { id: r.id, revision: r.revision },
                        );
                        if (selected?.id === r.id) setSelected(null);
                      });
                    }}
                  >
                    Xóa
                  </button>
                </div>
              </article>
            ))}
            <Pagination
              page={safePage}
              total={matches.length}
              pageSize={8}
              onChange={setPage}
            />
          </section>
          {selected && (
            <section className="store-card store-detail">
              <button className="store-close" onClick={() => setSelected(null)}>
                Đóng ×
              </button>
              <h2>
                {selected.id === "new" ? "Thêm mới" : "Chỉnh sửa"}{" "}
                {isProduct ? "sản phẩm" : "danh mục"}
              </h2>
              <form
                className="store-form"
                key={selected.id}
                onSubmit={(e) => {
                  const b = fields(e);
                  void run(async () => {
                    const id = await imageId();
                    const payload: Record<string, unknown> = {
                      ...b,
                      id: selected.id === "new" ? undefined : selected.id,
                      revision: selected.revision,
                      active: b.active === "on",
                    };
                    if (isProduct) {
                      payload.price = Number(b.price);
                      payload.stock = Number(b.stock);
                    } else payload.sortOrder = Number(b.sortOrder);
                    if (id) payload.imageId = id;
                    else if (removeImage) payload.imageId = "";
                    await mutate(
                      "commerce",
                      isProduct ? "product-save" : "category-save",
                      payload,
                    );
                    setSelected(null);
                    setFile(null);
                  });
                }}
              >
                <label>
                  Tên
                  <input
                    name="name"
                    defaultValue={String(selected.name ?? "")}
                    required
                    maxLength={150}
                  />
                </label>
                <label>
                  {isProduct ? "Slug đường dẫn" : "Mã danh mục"}
                  <input
                    name={isProduct ? "slug" : "code"}
                    defaultValue={String(selected.slug ?? selected.code ?? "")}
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    maxLength={120}
                  />
                </label>
                {isProduct ? (
                  <>
                    <label>
                      Danh mục
                      <select
                        name="category"
                        defaultValue={String(selected.category ?? "")}
                        required
                      >
                        <option value="" disabled>
                          Chọn danh mục đang hoạt động
                        </option>
                        {categories.map((c) => (
                          <option
                            key={c.id}
                            value={String(c.code)}
                            disabled={!c.active}
                          >
                            {String(c.name)}
                            {!c.active ? " (đã ẩn)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Giá VND
                      <input
                        name="price"
                        type="number"
                        min={1}
                        max={10000000}
                        defaultValue={Number(selected.price ?? 85000)}
                        required
                      />
                    </label>
                    <label>
                      Tồn kho
                      <input
                        name="stock"
                        type="number"
                        min={0}
                        max={1000000}
                        defaultValue={Number(selected.stock ?? 0)}
                        required
                      />
                    </label>
                  </>
                ) : (
                  <label>
                    Thứ tự hiển thị
                    <input
                      name="sortOrder"
                      type="number"
                      min={0}
                      max={10000}
                      defaultValue={Number(selected.sortOrder ?? 0)}
                      required
                    />
                  </label>
                )}
                <label>
                  Mô tả
                  <textarea
                    name="description"
                    defaultValue={String(selected.description ?? "")}
                    required={isProduct}
                    maxLength={isProduct ? 4000 : 2000}
                  />
                </label>
                <label className="store-check">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={Boolean(selected.active)}
                  />
                  Hiển thị trên cửa hàng
                </label>
                {!removeImage && selected.image != null && (
                  <ProductImage
                    src={String(selected.image)}
                    alt="Ảnh hiện tại"
                    width={180}
                    height={140}
                  />
                )}
                <label>
                  Upload ảnh thay thế (PNG/JPEG, tối đa 5 MB)
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      uploaded.current = null;
                      if (
                        f &&
                        (f.size > 5 * 1024 * 1024 ||
                          !["image/png", "image/jpeg"].includes(f.type))
                      ) {
                        setFileError("Chọn PNG/JPEG tối đa 5 MB.");
                        e.target.value = "";
                        setFile(null);
                      } else {
                        setFileError("");
                        setFile(f);
                        setRemoveImage(false);
                      }
                    }}
                  />
                </label>
                {fileError && <p className="store-error">{fileError}</p>}
                {file && <p>Ảnh đã chọn: {file.name}</p>}
                <label className="store-check">
                  <input
                    type="checkbox"
                    checked={removeImage}
                    onChange={(e) => {
                      setRemoveImage(e.target.checked);
                      setFile(null);
                      uploaded.current = null;
                    }}
                  />
                  Gỡ ảnh hiện tại và dùng ảnh mặc định
                </label>
                <button disabled={busy || Boolean(fileError)}>
                  Lưu {isProduct ? "sản phẩm" : "danh mục"}
                </button>
              </form>
            </section>
          )}
        </>
    </main>
  );
}

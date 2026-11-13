"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fields, money, type Row, useStore } from "@/lib/store";
type Summary = {
  items: Row[];
  cartToken: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  shipping: Row;
};
export function Cart({ checkout = false }: { checkout?: boolean }) {
  const { state, loading, busy, run, mutate } = useStore(),
    router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null),
    [error, setError] = useState(""),
    [fetching, setFetching] = useState(false);
  async function refresh() {
    setFetching(true);
    try {
      setSummary(await api("cart/summary"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được giỏ.");
    } finally {
      setFetching(false);
    }
  }
  useEffect(() => {
    let live = true;
    if (state?.user.role === "CUSTOMER") {
      setFetching(true);
      void api("cart/summary")
        .then((s) => {
          if (live) {
            setSummary(s);
            setError("");
          }
        })
        .catch((e) => {
          if (live) setError(e.message);
        })
        .finally(() => {
          if (live) setFetching(false);
        });
    } else setSummary(null);
    return () => {
      live = false;
    };
  }, [state]);
  if (loading) return <main className="store-page">Đang tải tài khoản…</main>;
  if (!state)
    return (
      <main className="store-page">
        <h1>Giỏ hàng của bạn</h1>
        <Link href="/login">Đăng nhập để mua hàng →</Link>
      </main>
    );
  if (state.user.role !== "CUSTOMER")
    return (
      <main className="store-page">
        <h1>Giỏ hàng dành cho khách hàng</h1>
        <Link href="/admin">Về quản trị cửa hàng</Link>
      </main>
    );
  const rows = summary?.items ?? [],
    blocked = rows.some(
      (l) =>
        !l.available || l.priceChanged || Number(l.quantity) > Number(l.stock),
    );
  const disabled = busy || fetching;
  async function update(action: string, b: Record<string, unknown> = {}) {
    if (!summary) return;
    await mutate("commerce", action, { ...b, cartToken: summary.cartToken });
    await refresh();
  }
  return (
    <main className="store-page">
      <header className="store-heading">
        <span className="eyebrow">Hành trình mua sắm</span>
        <h1>{checkout ? "Xác nhận đơn hàng" : "Giỏ hàng của bạn"}</h1>
      </header>
      <div className="store-row-actions">
        <button disabled={disabled} onClick={() => void refresh()}>
          Tải lại giỏ & phí giao
        </button>
        {!checkout && rows.length > 0 && (
          <>
            <button
              disabled={disabled}
              onClick={() => void run(() => update("cart-refresh"))}
            >
              Cập nhật giá mới
            </button>
            <button
              className="store-danger"
              disabled={disabled}
              onClick={() => {
                if (window.confirm("Xóa toàn bộ sản phẩm khỏi giỏ hàng?"))
                  void run(() => update("cart-clear"));
              }}
            >
              Xóa toàn bộ giỏ
            </button>
          </>
        )}
      </div>
      {fetching && <p aria-busy="true">Đang tải giỏ hàng…</p>}
      {error && (
        <p className="store-error" role="alert">
          {error}
        </p>
      )}
      {!fetching && summary && !rows.length ? (
        <section className="store-card">
          <p>Giỏ hàng đang trống.</p>
          <Link href="/products">Khám phá bộ sưu tập →</Link>
        </section>
      ) : (
        summary &&
        rows.length > 0 && (
          <div className="store-two">
            <section className="store-card">
              {rows.map((l) => (
                <div key={l.id} className="store-cart-line">
                  <div>
                    <strong>{String(l.name)}</strong>
                    <p>
                      {money(l.price)} × {String(l.quantity)}
                    </p>
                    {Boolean(l.priceChanged) && (
                      <p className="store-warning">
                        Giá mới: {money(l.currentPrice)}. Chọn “Cập nhật giá
                        mới” trước khi đặt.
                      </p>
                    )}
                    {!l.available ? (
                      <p className="store-error">
                        Sản phẩm hoặc danh mục đã ngừng bán. Hãy xóa khỏi giỏ.
                      </p>
                    ) : (
                      Number(l.quantity) > Number(l.stock) && (
                        <p className="store-error">
                          Chỉ còn {String(l.stock)} sản phẩm. Hãy giảm số lượng
                          hoặc xóa.
                        </p>
                      )
                    )}
                  </div>
                  {!checkout && (
                    <div>
                      <input
                        key={l.id + String(l.quantity) + String(l.version)}
                        aria-label={`Số lượng ${l.name}`}
                        type="number"
                        min={1}
                        max={100}
                        defaultValue={Number(l.quantity)}
                        disabled={disabled}
                        onBlur={(e) => {
                          const qty = Number(e.target.value);
                          if (qty !== Number(l.quantity))
                            void run(() =>
                              update("cart-set", {
                                productId: l.productId,
                                quantity: qty,
                              }),
                            );
                        }}
                      />
                      <button
                        disabled={disabled}
                        onClick={() =>
                          void run(() =>
                            update("cart-set", {
                              productId: l.productId,
                              quantity: 0,
                            }),
                          )
                        }
                      >
                        Bỏ
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {blocked && (
                <p className="store-warning">
                  Giỏ có thông tin thay đổi; cần xử lý các dòng được đánh dấu
                  trước khi checkout. <Link href="/cart">Mở giỏ hàng</Link>.
                </p>
              )}
              {!summary.shipping.enabled && (
                <p className="store-warning">
                  Cửa hàng đang tạm ngừng nhận đơn mới.
                </p>
              )}
              {checkout && (
                <form
                  className="store-form"
                  onSubmit={(e) => {
                    const b = fields(e);
                    void run(async () => {
                      if (blocked || !summary.shipping.enabled)
                        throw new Error("Giỏ chưa đủ điều kiện đặt hàng.");
                      const order = await mutate("commerce", "checkout", {
                        ...b,
                        cartToken: summary.cartToken,
                        shippingRevision: summary.shipping.revision,
                      });
                      router.push(`/account/orders?order=${order.id}`);
                    });
                  }}
                >
                  <h2>Thông tin nhận hàng</h2>
                  <label>
                    Người nhận
                    <input
                      name="recipient"
                      defaultValue={String(state.user.name)}
                      required
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Điện thoại
                    <input
                      name="phone"
                      type="tel"
                      defaultValue={String(state.user.phone)}
                      required
                      minLength={8}
                      maxLength={30}
                    />
                  </label>
                  <label>
                    Địa chỉ
                    <textarea
                      name="address"
                      defaultValue={String(state.user.address)}
                      required
                      maxLength={400}
                    />
                  </label>
                  <p>
                    Thanh toán khi nhận hàng (COD). Phí giao hàng được máy chủ
                    xác nhận tại thời điểm đặt.
                  </p>
                  <p className="store-subtle">
                    <Link href="/privacy-policy">Chính sách bảo mật</Link> ·{" "}
                    <Link href="/return-policy">Chính sách đổi trả</Link>
                  </p>
                  <button
                    className="primary-button"
                    disabled={disabled || blocked || !summary.shipping.enabled}
                  >
                    Xác nhận đặt hàng
                  </button>
                </form>
              )}
            </section>
            <aside className="store-card">
              <h2>Tóm tắt đơn</h2>
              <p>
                Tiền hàng <strong>{money(summary.subtotal)}</strong>
              </p>
              <p>
                Giao hàng <strong>{money(summary.shippingFee)}</strong>
              </p>
              {Number(summary.shipping.freeShippingThreshold) > 0 && (
                <p className="store-subtle">
                  Miễn phí giao từ{" "}
                  {money(summary.shipping.freeShippingThreshold)} tiền hàng.
                </p>
              )}
              <hr />
              <p>
                Tổng thanh toán <strong>{money(summary.total)}</strong>
              </p>
              {!checkout && (
                <button
                  className="primary-button"
                  disabled={disabled || blocked || !summary.shipping.enabled}
                  onClick={() => router.push("/checkout")}
                >
                  Tiến hành đặt hàng
                </button>
              )}
              <p className="store-subtle">
                Giá, tồn kho, nội dung giỏ và phiên bản phí giao đều được kiểm
                tra lại khi xác nhận.
              </p>
            </aside>
          </div>
        )
      )}
    </main>
  );
}

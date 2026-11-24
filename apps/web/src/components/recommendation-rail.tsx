"use client";

import { useEffect, useState } from "react";
import { api, type Row, useStore } from "@/lib/store";
import { ProductCard } from "./product/lan-primitives";

type Props = {
  surface: "home" | "cart";
  refreshKey?: string;
  categories?: Row[];
};

export function RecommendationRail(props: Props) {
  const { state } = useStore();
  if (process.env.NEXT_PUBLIC_RECOMMENDATIONS_ENABLED === "false") return null;
  return <Rail key={state?.user?.id ?? "guest"} {...props} />;
}

function Rail({ surface, refreshKey, categories = [] }: Props) {
  const [items, setItems] = useState<Row[]>([]);
  const [strategy, setStrategy] = useState("");
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const changed = () => setAttempt((value) => value + 1);
    window.addEventListener("ai-preferences-changed", changed);
    return () => window.removeEventListener("ai-preferences-changed", changed);
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setStatus("loading");
      try {
        const response = await api(
          `products/recommended?surface=${surface}&limit=4`,
        );
        if (active) {
          setItems(response.items ?? []);
          setStrategy(String(response.strategy));
          setStatus("ready");
        }
      } catch {
        if (active) setStatus("error");
      }
    });
    return () => {
      active = false;
    };
  }, [surface, refreshKey, attempt]);

  return (
    <section className="lan-section lan-recs" aria-label="Gợi ý sản phẩm">
      <header className="lan-section-heading">
        <div>
          <h2>
            {surface === "cart"
              ? "Gợi ý thêm cho giỏ hàng"
              : strategy === "PERSONALIZED"
                ? "Gợi ý cho bạn"
                : "Gợi ý từ cửa hàng"}
          </h2>
          {strategy === "PERSONALIZED" && (
            <p>Dựa trên danh mục bạn từng mua và lựa chọn cá nhân hóa.</p>
          )}
          {strategy === "BOUGHT_TOGETHER" && (
            <p>Thường được mua cùng trong các đơn đã giao.</p>
          )}
        </div>
      </header>
      {status === "loading" && <p role="status">Đang tải gợi ý…</p>}
      {status === "error" && (
        <p role="status">
          Chưa tải được gợi ý.{" "}
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Thử lại
          </button>
        </p>
      )}
      {status === "ready" && items.length === 0 && (
        <p>Chưa có sản phẩm còn hàng phù hợp để gợi ý thêm.</p>
      )}
      {status === "ready" && (
        <div className="lan-products">
          {items.map((product, index) => (
            <ProductCard
              key={product.id}
              list={{ id: "cart_recommendations", name: "Gợi ý cho giỏ hàng", instance: "cart", index }}
              product={product}
              category={String(
                categories.find(
                  (category) => category.code === product.category,
                )?.name ?? "Đặc sản Huế",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}

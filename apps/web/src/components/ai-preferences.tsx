"use client";

import { useEffect, useState } from "react";
import { api, money, useStore } from "@/lib/store";
import styles from "./ai-preferences.module.css";

type Preferences = {
  personalization: boolean;
  historyUse: boolean;
  memoryUse: boolean;
  revision: number;
};
type Memory = { budget?: number; recipient?: string; occasion?: string };

export function AiPreferences() {
  const { state } = useStore();
  if (state?.user.role !== "CUSTOMER") return null;
  return <Preferences key={state.user.id} />;
}

function Preferences() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [memory, setMemory] = useState<Memory>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([
      api("recommendations/consent"),
      api("agent/consent"),
      api("agent/history"),
    ])
      .then(([recommendations, agent, history]) => {
        if (!active) return;
        setPreferences({
          personalization: recommendations.granted,
          historyUse: agent.historyUse,
          memoryUse: agent.memoryUse,
          revision: agent.revision,
        });
        setMemory(history.memory ?? {});
      })
      .catch(() => {
        if (active) setError("Chưa tải được lựa chọn riêng tư.");
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    const changed = () => setAttempt((value) => value + 1);
    window.addEventListener("ai-preferences-changed", changed);
    window.addEventListener("ai-memory-updated", changed);
    return () => {
      window.removeEventListener("ai-preferences-changed", changed);
      window.removeEventListener("ai-memory-updated", changed);
    };
  }, []);

  async function change(
    field: "personalization" | "historyUse" | "memoryUse",
    checked: boolean,
  ) {
    if (!preferences || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const recommendation = field === "personalization";
      const body = recommendation
        ? { granted: checked, revision: preferences.revision }
        : {
            historyUse: preferences.historyUse,
            memoryUse: preferences.memoryUse,
            [field]: checked,
            revision: preferences.revision,
          };
      const result = await api(
        recommendation ? "recommendations/consent" : "agent/consent",
        "PUT",
        body,
        crypto.randomUUID(),
      );
      setPreferences({
        ...preferences,
        [field]: checked,
        revision: result.revision,
      });
      setNotice(
        checked
          ? "Đã lưu lựa chọn của bạn."
          : "Đã rút đồng ý và xóa dữ liệu tương ứng.",
      );
      window.dispatchEvent(new Event("ai-preferences-changed"));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Chưa lưu được lựa chọn.",
      );
      setAttempt((value) => value + 1);
    } finally {
      setSaving(false);
    }
  }

  async function forget() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await api("agent/history", "DELETE", {}, crypto.randomUUID());
      setMemory({});
      setNotice("Đã xóa lịch sử và sở thích đã ghi nhớ.");
      window.dispatchEvent(new Event("ai-preferences-changed"));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Chưa xóa được dữ liệu.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className={styles.panel}>
      <summary>Cá nhân hóa và ghi nhớ</summary>
      <p>
        Các lựa chọn dưới đây độc lập với tiếp thị. Bạn có thể rút đồng ý bất cứ
        lúc nào.
      </p>
      {!preferences && !error && <p role="status">Đang tải lựa chọn…</p>}
      {preferences && (
        <fieldset disabled={saving}>
          <legend className={styles.legend}>
            Lựa chọn riêng tư của trợ lý
          </legend>
          <label>
            <input
              type="checkbox"
              checked={preferences.personalization}
              onChange={(event) =>
                void change("personalization", event.target.checked)
              }
            />
            Gợi ý theo danh mục tôi từng mua
          </label>
          <label>
            <input
              type="checkbox"
              checked={preferences.historyUse}
              onChange={(event) =>
                void change("historyUse", event.target.checked)
              }
            />
            Lưu và dùng lại lịch sử trò chuyện trên tài khoản
          </label>
          <label>
            <input
              type="checkbox"
              checked={preferences.memoryUse}
              onChange={(event) =>
                void change("memoryUse", event.target.checked)
              }
            />
            Ghi nhớ ngân sách, người nhận và dịp tặng tôi cung cấp
          </label>
        </fieldset>
      )}
      <p>
        Lịch sử lưu tối đa 20 lượt hỏi đáp. Sở thích được giữ đến khi bạn xóa
        hoặc rút đồng ý.
      </p>
      {Object.keys(memory).length > 0 && (
        <p>
          Sở thích đã ghi nhớ{memory.budget ? ` · ${money(memory.budget)}` : ""}
          {memory.recipient ? ` · ${memory.recipient}` : ""}
          {memory.occasion ? ` · ${memory.occasion}` : ""}
        </p>
      )}
      <button
        type="button"
        disabled={saving || !preferences}
        onClick={() => void forget()}
      >
        Xóa lịch sử và ghi nhớ
      </button>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            type="button"
            onClick={() => {
              setError("");
              setAttempt((value) => value + 1);
            }}
          >
            Tải lại
          </button>
        </p>
      )}
    </details>
  );
}

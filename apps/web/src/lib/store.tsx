"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type Row = { id: string; [key: string]: unknown };
export type StoreState = {
  user: Row;
  addresses: Row[];
  orders: Row[];
  privacy: Row[];
  returns: Row[];
  consents: Row[];
  policy: Row;
  policyVersions?: Row[];
  audit?: Row[];
  cartCount: number;
};
export const labels: Record<string, string> = {
  PLACED: "Mới đặt",
  CONFIRMED: "Đã xác nhận",
  PACKED: "Đã đóng gói",
  SHIPPED: "Đang giao",
  DELIVERED: "Đã giao",
  DELIVERY_FAILED: "Giao thất bại",
  RETURNED: "Đã hoàn kho",
  CANCELLED: "Đã hủy",
  PAID: "Đã thu tiền",
  UNPAID: "Chưa thu tiền",
  REVIEW: "Chờ đối soát thanh toán",
  REFUNDED: "Đã hoàn tiền",
  RESOLVED_PAID: "Đã đối soát — ghi nhận thanh toán",
  EXPIRED: "Hết hạn thanh toán",
  PENDING: "Đang chờ thanh toán",
  VIETQR: "VietQR",
  COD: "COD",
  SUBMITTED: "Đã tiếp nhận",
  REQUESTED: "Mới tiếp nhận",
  CUSTOMER_CONFIRMATION: "Chờ khách xác nhận phương án",
  WITHDRAWN: "Khách đã rút yêu cầu",
  WAITING_STOCK: "Chờ hàng thay thế",
  PAYMENT_REVIEW: "Chờ đối soát thanh toán",
  EXCEPTION: "Chờ xử lý vướng mắc",
  RESUME: "Tiếp tục xử lý",
  REPLACEMENT_SENT: "Đã gửi hàng giao bù hoặc thay thế",
  NOT_RECEIVED: "Chưa nhận hàng",
  CHANGE_OF_MIND: "Đổi ý hoặc đặt nhầm",
  MAKE_UP: "Giao bù",
  ADJUST_DUE: "Điều chỉnh khoản phải thu",
  REVIEWING: "Đang xem xét",
  EVIDENCE_REQUIRED: "Cần bổ sung",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  RECEIVED: "Đã nhận hàng trả",
  INSPECTED: "Đã kiểm hàng",
  PROCESSING: "Đang xử lý",
  RESOLVED: "Đã hoàn tất",
  COMPLETED: "Đã xử lý",
  ACCESS: "Xem dữ liệu",
  EXPORT: "Xuất dữ liệu",
  DELETE: "Đóng tài khoản và xóa/ẩn danh",
  RESTRICT: "Hạn chế xử lý",
  COMPLAINT: "Khiếu nại dữ liệu",
  DAMAGED: "Hư hỏng",
  WRONG_ITEM: "Giao sai",
  MISSING_ITEM: "Giao thiếu",
  UNSAFE: "Nghi mất an toàn",
  QUALITY: "Chất lượng bất thường",
  REFUND: "Hoàn tiền",
  REPLACEMENT: "Đổi hàng",
  NOT_REQUIRED: "Không cần thu hồi",
  AWAITING_PICKUP: "Chờ thu hồi",
  QUARANTINE: "Cách ly",
  DISPOSE: "Tiêu hủy",
  NOT_STARTED: "Chưa thực hiện",
  MANUAL_PENDING: "Chờ thực hiện thủ công",
  MANUAL_CONFIRMED: "Đã xác nhận kết quả thủ công",
};
export const label = (x: unknown) => labels[String(x)] ?? String(x ?? "");
export const money = (x: unknown) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    Number(x ?? 0),
  );
export const date = (x: unknown) =>
  x ? new Date(String(x)).toLocaleString("vi-VN") : "";
export const fields = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget).entries());
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api(
  path: string,
  method = "GET",
  data?: unknown,
  key?: string,
) {
  const res = await fetch(`/api/store/${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers:
      data === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            ...(key ? { "Idempotency-Key": key } : {}),
          },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const payload = await res.json();
  if (!res.ok)
    throw new ApiError(
      res.status,
      payload.message ?? "Yêu cầu không thành công.",
    );
  return payload;
}
type StoreContext = {
  state: StoreState | null;
  loading: boolean;
  busy: boolean;
  error: string;
  notice: string;
  reload: () => Promise<void>;
  run: (work: () => Promise<void>) => Promise<void>;
  mutate: (
    path: string,
    action: string,
    data: Record<string, unknown>,
  ) => Promise<Row>;
  logout: () => Promise<void>;
};
const Context = createContext<StoreContext | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreState | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const pending = useRef<{ body: string; key: string } | null>(null);
  const reloadVersion = useRef(0);
  const reload = useCallback(async () => {
    const version = ++reloadVersion.current;
    try {
      const snapshot = await api("state");
      if (version === reloadVersion.current) setState(snapshot);
    } catch (e) {
      if (version !== reloadVersion.current) return;
      if (e instanceof ApiError && e.status === 401) setState(null);
      else throw e;
    }
  }, []);
  useEffect(() => {
    let active = true;
    void reload()
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);
  const userId = state?.user.id;
  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout>;
    let socket: WebSocket;
    let delay = 1000;
    const sync = () => { if (!disposed) void reload().catch(() => {}); };
    const connect = () => {
      const url = new URL("/api/store/live", location.href);
      url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
      url.port = "8088";
      socket = new WebSocket(url);
      socket.onopen = () => {
        delay = 1000;
        sync();
      };
      socket.onmessage = sync;
      socket.onclose = () => {
        if (disposed) return;
        sync();
        retry = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 15000);
      };
    };
    connect();
    window.addEventListener("focus", sync);
    return () => {
      disposed = true;
      clearTimeout(retry);
      socket.close();
      window.removeEventListener("focus", sync);
    };
  }, [userId, reload]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể xử lý.");
      if (e instanceof ApiError && e.status === 401) setState(null);
    } finally {
      setBusy(false);
    }
  }
  async function mutate(
    path: string,
    action: string,
    data: Record<string, unknown>,
  ) {
    const body = { action, ...data },
      fingerprint = JSON.stringify({ path, body });
    if (pending.current?.body !== fingerprint)
      pending.current = { body: fingerprint, key: crypto.randomUUID() };
    const result = await api(path, "POST", body, pending.current.key);
    pending.current = null;
    await reload();
    setNotice("Đã lưu thông tin.");
    return result;
  }
  async function logout() {
    await api("auth/logout", "POST", {});
    ++reloadVersion.current;
    setState(null);
  }
  return (
    <Context.Provider
      value={{
        state,
        loading,
        busy,
        error,
        notice,
        reload,
        run,
        mutate,
        logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("StoreProvider missing");
  return value;
}

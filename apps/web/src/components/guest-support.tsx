"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supportStatuses, supportTopics, type SupportTicket } from "@/lib/guest-support";
import { api, ApiError, date } from "@/lib/store";
import { Button } from "@/shared/ui";
import styles from "./guest-order.module.css";

export function GuestSupport({ number }: { number: string }) {
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [expired, setExpired] = useState(false);
  const sending = useRef(false);
  const pending = useRef<{ key: string; payload: string } | null>(null);
  const path = `guest/orders/${number}/support`;

  useEffect(() => {
    let active = true;
    void api(path).then((rows: SupportTicket[]) => {
      if (!active) return;
      setTickets((current) => {
        const result = new Map((current ?? []).map((row) => [row.id, row]));
        for (const row of rows) {
          if ((result.get(row.id)?.revision ?? 0) <= row.revision) result.set(row.id, row);
        }
        return [...result.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 30);
      });
      setLoadError("");
      setExpired(false);
    }).catch((error) => {
      if (!active) return;
      const lostAccess = error instanceof ApiError && error.status === 404;
      setExpired(lostAccess);
      if (lostAccess) setTickets(null);
      setLoadError(lostAccess ? "Hãy xác minh lại đơn để xem yêu cầu hỗ trợ." : "Chưa tải được yêu cầu hỗ trợ.");
    });
    return () => { active = false; };
  }, [path, reload]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = { topic: String(data.get("topic")), message: String(data.get("message")).trim() };
    const payload = JSON.stringify(body);
    if (pending.current?.payload !== payload) pending.current = { key: crypto.randomUUID(), payload };
    sending.current = true;
    setBusy(true);
    setMessage("");
    setSuccess("");
    try {
      const created: SupportTicket = await api(path, "POST", body, pending.current.key);
      pending.current = null;
      form.reset();
      setTickets((rows) => [created, ...(rows ?? []).filter((row) => row.id !== created.id)].slice(0, 30));
      setSuccess("Đã gửi yêu cầu. Bạn có thể xem phản hồi tại đây.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setExpired(true);
        setTickets(null);
        setLoadError("Hãy xác minh lại đơn để tiếp tục.");
      } else setMessage(error instanceof Error ? error.message : "Chưa gửi được yêu cầu hỗ trợ.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <section className={`${styles.card} ${styles.support}`} id="ho-tro-don-hang" aria-labelledby="guest-support-title">
      <h2 id="guest-support-title">Hỗ trợ đơn hàng</h2>
      {expired ? <p role="alert">{loadError} <Link href="/tra-cuu-don-hang#ho-tro-don-hang">Tra cứu lại đơn</Link>.</p> : (
        <>
          <p>Chọn chủ đề, mô tả vấn đề và quay lại đây để xem phản hồi. Giữ riêng mã tra cứu và thông tin thanh toán.</p>
          <form className={styles.form} onSubmit={submit}>
            <label>Chủ đề
              <select aria-label="Chủ đề" name="topic" defaultValue="" required disabled={busy}>
                <option value="" disabled>Chọn chủ đề</option>
                {Object.entries(supportTopics).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label>Nội dung yêu cầu
              <textarea name="message" rows={4} required maxLength={2000} disabled={busy} placeholder="Ví dụ: tên sản phẩm, số lượng và vấn đề bạn gặp" />
            </label>
            {message && <p role="alert" className={styles.error}>{message}</p>}
            {success && <p role="status">{success}</p>}
            <Button type="submit" loading={busy}>Gửi yêu cầu hỗ trợ</Button>
          </form>
          <div className={styles.supportHeading}>
            <h3>Yêu cầu đã gửi</h3>
            <Button variant="secondary" disabled={busy} onClick={() => setReload((n) => n + 1)}>Tải lại phản hồi</Button>
          </div>
          {loadError ? <p role="alert">{loadError}</p> : tickets === null ? <p role="status">Đang tải yêu cầu…</p> : !tickets.length ? <p>Bạn chưa gửi yêu cầu nào cho đơn này.</p> : (
            <ul className={styles.supportTickets}>{tickets.map((row) => (
              <li key={row.id}>
                <strong>{supportTopics[row.topic]} · {supportStatuses[row.status]}</strong>
                <small>{date(row.createdAt)}</small>
                <p>{row.message}</p>
                {row.reply && <div><strong>Phản hồi từ Gói Huế</strong><p>{row.reply}</p></div>}
              </li>
            ))}</ul>
          )}
        </>
      )}
    </section>
  );
}

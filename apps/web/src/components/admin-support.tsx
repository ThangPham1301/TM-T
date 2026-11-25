"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supportStatuses, supportTopics, type SupportTicket } from "@/lib/guest-support";
import { api, ApiError, date, useStore } from "@/lib/store";
import { Button, StatusBadge } from "@/shared/ui";
import { OperationsWorkspace } from "./operations";
import workbench from "./admin-workbench.module.css";
import styles from "./admin-support.module.css";

type Ticket = SupportTicket & { orderNumber: string };
type Inbox = { items: Ticket[]; hasMore: boolean };
type Filter = "ALL" | Ticket["status"];
type ReplyDraft = { revision: number; reply: string; status: "IN_REVIEW" | "RESOLVED" };
const filters: Filter[] = ["SUBMITTED", "IN_REVIEW", "RESOLVED", "ALL"];

function TicketStatus({ status }: { status: Ticket["status"] }) {
  const tone = status === "RESOLVED" ? "success" : status === "IN_REVIEW" ? "warning" : "neutral";
  return <StatusBadge tone={tone} className={workbench.badge}>{supportStatuses[status]}</StatusBadge>;
}

export function AdminSupport() {
  const { state, loading } = useStore();
  if (loading) return <main className="store-page" role="status">Đang tải tài khoản…</main>;
  if (state?.user.role !== "ADMIN") return <main className="store-page"><h1>Hỗ trợ khách vãng lai</h1><Link href="/login">Đăng nhập bằng tài khoản quản trị</Link></main>;
  return <SupportInbox />;
}

function SupportInbox() {
  const [filter, setFilter] = useState<Filter>("SUBMITTED");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, ReplyDraft>>({});
  const [notice, setNotice] = useState("");
  const [load, setLoad] = useState<{ key: string; data?: Inbox; error?: string }>();
  const detail = useRef<HTMLElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const query = new URLSearchParams({ status: filter, number: search, page: String(page) }).toString();
  const key = `${query}:${refresh}`;
  const result = load?.key === key ? load : undefined;
  const tickets = result?.data?.items ?? [];
  const selected = tickets.find((row) => row.id === selectedId) ?? tickets[0];

  useEffect(() => {
    let active = true;
    void api(`admin/support?${query}`).then((data: Inbox) => {
      if (active) setLoad({ key, data });
    }).catch((error) => {
      if (active) setLoad({ key, error: error instanceof Error ? error.message : "Chưa tải được danh sách." });
    });
    return () => { active = false; };
  }, [key, query]);

  function filterOrders(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(String(new FormData(event.currentTarget).get("number") ?? "").trim().toUpperCase());
    setPage(0);
    setNotice("");
  }

  function selectTicket(id: string) {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 740px)").matches) {
      detail.current?.focus({ preventScroll: true });
      detail.current?.scrollIntoView({ block: "start" });
    }
  }

  function finishReply(row: Ticket) {
    setNotice(`Đã lưu phản hồi cho đơn ${row.orderNumber}.`);
    setDrafts((items) => {
      const remaining = { ...items };
      delete remaining[row.id];
      return remaining;
    });
    setRefresh((n) => n + 1);
  }

  return (
    <OperationsWorkspace section="support" title="Hỗ trợ khách vãng lai" description="Tiếp nhận và phản hồi các yêu cầu gắn với đơn hàng đã xác minh.">
      <div className={workbench.workspace}>
        <div className={workbench.bar}>
          <div className={workbench.switcher} role="group" aria-label="Lọc theo trạng thái">
            {filters.map((status) => (
              <button type="button" key={status} aria-pressed={filter === status} onClick={() => {
                setFilter(status); setPage(0); setNotice("");
              }}>
                {status === "ALL" ? "Tất cả" : supportStatuses[status]}
              </button>
            ))}
          </div>
          <form className={styles.search} onSubmit={filterOrders}>
            <label htmlFor="support-order-number">Mã đơn</label>
            <input ref={searchInput} id="support-order-number" name="number" placeholder="GH-XXXXXXXX" maxLength={11} pattern="[Gg][Hh]-[0-9A-Za-z]{8}" />
            <Button size="small" variant="secondary" type="submit">Tìm</Button>
            {search && <Button size="small" variant="secondary" onClick={() => {
              if (searchInput.current) searchInput.current.value = "";
              setSearch(""); setPage(0); setNotice("");
            }}>Bỏ lọc</Button>}
          </form>
        </div>
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
        <div className={workbench.split}>
          <section className={workbench.pane} aria-labelledby="support-inbox-title">
            <header className={workbench.paneHead}>
              <div>
                <h2 id="support-inbox-title">Hộp yêu cầu</h2>
                {result?.data && <p className={workbench.quiet}>{tickets.length} yêu cầu trên trang</p>}
              </div>
              <Button size="small" variant="secondary" disabled={!result} onClick={() => setRefresh((n) => n + 1)}>Tải lại</Button>
            </header>
            {!result ? <p className={workbench.empty} role="status">Đang tải yêu cầu…</p> : result.error ? (
              <p className={workbench.empty} role="alert">{result.error}</p>
            ) : !tickets.length ? (
              <p className={workbench.empty}>Không có yêu cầu phù hợp với bộ lọc.</p>
            ) : (
              <ul className={workbench.itemList}>
                {tickets.map((row) => (
                  <li key={row.id}>
                    <button className={workbench.item} type="button" aria-pressed={selected?.id === row.id} onClick={() => selectTicket(row.id)}>
                      <span className={workbench.row}><strong>{row.orderNumber}</strong><TicketStatus status={row.status} /></span>
                      <span className={styles.topic}>{supportTopics[row.topic]}</span>
                      <span className={styles.excerpt}>{row.message}</span>
                      <small className={workbench.quiet}>{date(row.createdAt)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {(page > 0 || result?.data?.hasMore) && (
              <nav className={workbench.paneFoot} aria-label="Phân trang yêu cầu hỗ trợ">
                <Button size="small" variant="secondary" aria-label="Trang trước" disabled={page === 0 || !result} onClick={() => setPage(page - 1)}>←</Button>
                <span className={workbench.quiet}>Trang {page + 1}</span>
                <Button size="small" variant="secondary" aria-label="Trang sau" disabled={!result?.data?.hasMore} onClick={() => setPage(page + 1)}>→</Button>
              </nav>
            )}
          </section>
          <section ref={detail} tabIndex={-1} className={`${workbench.pane} ${styles.detail}`} aria-labelledby="support-detail-title">
            {selected ? (
              <SupportReply key={`${selected.id}:${selected.revision}`} row={selected} draft={drafts[selected.id]}
                onChange={(draft) => setDrafts((items) => ({ ...items, [selected.id]: draft }))}
                onSaved={() => finishReply(selected)} onReload={() => setRefresh((n) => n + 1)} />
            ) : (
              <>
                <header className={workbench.paneHead}><h2 id="support-detail-title">Chi tiết yêu cầu</h2></header>
                <p className={workbench.empty}>Nội dung và phản hồi sẽ hiển thị khi bạn chọn một yêu cầu.</p>
              </>
            )}
          </section>
        </div>
        <nav className={styles.related} aria-label="Khu vực quản trị liên quan">
          <Link className={workbench.shortcut} href="/admin/orders">Quản lý đơn hàng ↗</Link>
          <Link className={workbench.shortcut} href="/admin/returns">Hồ sơ đổi trả của tài khoản ↗</Link>
          <Link className={workbench.shortcut} href="/admin/privacy">Hồ sơ quyền riêng tư của tài khoản ↗</Link>
        </nav>
      </div>
    </OperationsWorkspace>
  );
}

function SupportReply({ row, draft, onChange, onSaved, onReload }: {
  row: Ticket;
  draft?: ReplyDraft;
  onChange: (draft: ReplyDraft) => void;
  onSaved: () => void;
  onReload: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const resolved = row.status === "RESOLVED";
  const current: ReplyDraft = draft?.revision === row.revision ? draft : { revision: row.revision, reply: row.reply, status: "IN_REVIEW" };

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || stale) return;
    setBusy(true);
    setError("");
    try {
      await api(`admin/support/${row.id}`, "PUT", current);
      onSaved();
    } catch (problem) {
      setStale(problem instanceof ApiError && problem.status === 409);
      setError(problem instanceof Error ? problem.message : "Chưa lưu được phản hồi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className={workbench.paneHead}>
        <div>
          <h2 id="support-detail-title">{supportTopics[row.topic]}</h2>
          <p className={workbench.quiet}>{row.orderNumber} · {date(row.createdAt)}</p>
        </div>
        <TicketStatus status={row.status} />
      </header>
      <div className={workbench.body}>
        <h3 className={styles.contentTitle}>Nội dung khách gửi</h3>
        <div className={styles.message} role="region" aria-label="Nội dung khách gửi" tabIndex={0}>{row.message}</div>
      </div>
      {resolved ? (
        <div className={`${workbench.body} ${styles.replyBody}`}>
          <h3 className={styles.contentTitle}>Phản hồi đã gửi</h3>
          <div className={styles.message} role="region" aria-label="Phản hồi đã gửi" tabIndex={0}>{row.reply}</div>
        </div>
      ) : (
        <>
          <form id="support-reply" className={`store-form ${workbench.body} ${styles.replyBody}`} onSubmit={reply}>
            <label>Phản hồi khách hàng
              <textarea aria-label="Phản hồi khách hàng" name="reply" rows={3} value={current.reply} maxLength={2000} required disabled={busy}
                onChange={(event) => onChange({ ...current, reply: event.target.value })} />
            </label>
            <small>{row.topic === "PRIVACY"
              ? "Hãy xác minh người yêu cầu trước khi cung cấp hoặc thay đổi dữ liệu. Phản hồi hiển thị cho người có quyền tra cứu đơn."
              : "Phản hồi hiển thị cho người có quyền tra cứu đơn."}</small>
            {error && <p className="store-warning" role="alert">{error}</p>}
          </form>
          <div className={`${workbench.paneFoot} ${styles.replyActions}`}>
            <label>Sau khi gửi
              <select aria-label="Sau khi gửi phản hồi" value={current.status} form="support-reply" disabled={busy}
                onChange={(event) => onChange({ ...current, status: event.target.value as ReplyDraft["status"] })}>
                <option value="IN_REVIEW">Tiếp tục xử lý</option>
                <option value="RESOLVED">Đóng yêu cầu</option>
              </select>
            </label>
            {stale ? <Button size="small" variant="secondary" onClick={onReload}>Tải lại hồ sơ</Button>
              : <Button size="small" type="submit" form="support-reply" loading={busy} loadingLabel="Đang lưu…">Gửi phản hồi</Button>}
          </div>
        </>
      )}
    </>
  );
}

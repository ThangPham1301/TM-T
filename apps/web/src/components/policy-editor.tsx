"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { policyInfo, policySections, type PolicyTopic, type PolicyVersion } from "@/lib/policies";
import { date, useStore } from "@/lib/store";
import { Button, Dialog, StatusBadge } from "@/shared/ui";
import { PolicyPreview } from "./policy-preview";
import workbench from "./admin-workbench.module.css";
import styles from "./policy-editor.module.css";

const topicLabels: Record<PolicyTopic, string> = {
  privacy: "Quyền riêng tư",
  shipping: "Đặt hàng và giao hàng",
  returns: "Đổi trả và hoàn tiền",
};
const topics = Object.keys(topicLabels) as PolicyTopic[];
const policyStatus = { DRAFT: "Bản nháp", PUBLISHED: "Đang công bố", SUPERSEDED: "Phiên bản trước" };

function VersionStatus({ row }: { row: PolicyVersion }) {
  const tone = row.status === "PUBLISHED" ? "success" : row.status === "DRAFT" ? "warning" : "neutral";
  return <StatusBadge tone={tone} className={workbench.badge}>{row.topic ? policyStatus[row.status] : "Bản nháp cũ"}</StatusBadge>;
}

export function PolicyEditor() {
  const { busy } = useStore();
  const [topic, setTopic] = useState<PolicyTopic>("privacy");

  return (
    <div className={workbench.workspace}>
      <div className={workbench.bar}>
        <div className={workbench.switcher} role="group" aria-label="Chủ đề chính sách">
          {topics.map((key) => (
            <button type="button" key={key} aria-pressed={topic === key} disabled={busy} onClick={() => setTopic(key)}>
              {topicLabels[key]}
            </button>
          ))}
        </div>
        <Link className={workbench.shortcut} href={policyInfo[topic].href} target="_blank" rel="noopener">Mở trang cửa hàng ↗</Link>
      </div>
      {topics.map((key) => (
        <div key={key} hidden={key !== topic}><PolicyDraftEditor topic={key} /></div>
      ))}
    </div>
  );
}

function PolicyDraftEditor({ topic }: { topic: PolicyTopic }) {
  const { state, busy, error, notice, run, mutate } = useStore();
  const versions = (state?.policyVersions ?? []).filter((row) => (row.topic ?? "privacy") === topic);
  const active = versions.find((row) => row.topic && row.status === "PUBLISHED");
  const [selectedId, setSelectedId] = useState(active?.id ?? "");
  const [draft, setDraft] = useState({ id: "", revision: 0, version: "", content: active?.content ?? "" });
  const [view, setView] = useState<"read" | "edit">("read");
  const [confirm, setConfirm] = useState(false);
  const selected = versions.find((row) => row.id === selectedId);
  const canPublish = Boolean(selected?.topic && active && selected.status !== "PUBLISHED");
  const inEditor = view === "edit";
  const editorId = `policy-draft-${topic}`;
  const editorHeading = `${editorId}-heading`;

  function loadDraft(row?: PolicyVersion, edit = false) {
    setDraft({ id: edit ? row?.id ?? "" : "", revision: row?.revision ?? 0, version: edit ? row?.version ?? "" : "", content: row?.content ?? "" });
    setSelectedId("");
    setView("edit");
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const saved = await mutate("command", "policy", { ...draft, topic });
      setDraft((current) => ({ ...current, id: saved.id, revision: Number(saved.revision) }));
      setSelectedId(saved.id);
      setView("read");
    });
  }

  function publish() {
    if (!selected || !active) return;
    setConfirm(false);
    void run(async () => {
      await mutate("command", "policy-publish", { id: selected.id, revision: selected.revision, publishedId: active.id });
      if (draft.id === selected.id) setDraft({ id: "", revision: 0, version: "", content: selected.content });
    });
  }

  return (
    <div className={workbench.split}>
      <section className={workbench.pane} aria-labelledby={`${editorId}-versions`}>
        <header className={workbench.paneHead}>
          <div>
            <h2 id={`${editorId}-versions`}>Lịch sử phiên bản</h2>
            <p className={workbench.quiet}>{versions.length} phiên bản</p>
          </div>
        </header>
        {versions.length === 0 ? <p className={workbench.empty}>Chưa có phiên bản cho chính sách này.</p> :
          <ul className={workbench.itemList}>
            {versions.map((row) => (
              <li key={row.id}>
                <button type="button" className={workbench.item} aria-pressed={selected?.id === row.id}
                  disabled={busy} onClick={() => { setSelectedId(row.id); setView("read"); }}>
                  <span className={workbench.row}><strong>Phiên bản {row.version}</strong><VersionStatus row={row} /></span>
                  <small className={workbench.quiet}>{date(row.publishedAt ?? row.createdAt)}</small>
                </button>
              </li>
            ))}
          </ul>}
        <div className={workbench.paneFoot}>
          <Button size="small" variant="secondary" disabled={busy} onClick={() => loadDraft(active)}>+ Tạo bản nháp</Button>
        </div>
      </section>
      <section className={workbench.pane} aria-labelledby={editorHeading}>
        <header className={workbench.paneHead}>
          <div className={styles.title}>
            <h2 id={editorHeading}>{policyInfo[topic].title}</h2>
            <p className={workbench.quiet}>{inEditor ? (draft.id ? `Sửa bản nháp ${draft.version}` : "Soạn bản nháp mới") :
              (selected ? `Phiên bản ${selected.version}` : (draft.version ? `Bản đang soạn · ${draft.version}` : "Bản đang soạn"))}</p>
          </div>
          {!inEditor && selected && <VersionStatus row={selected} />}
        </header>
        <div className={styles.viewBar}>
          <div className={workbench.switcher} role="group" aria-label="Chế độ xem chính sách">
            <button type="button" aria-pressed={!inEditor} disabled={busy} onClick={() => setView("read")}>Xem nội dung</button>
            <button type="button" aria-pressed={inEditor} disabled={busy} onClick={() => { setSelectedId(""); setView("edit"); }}>Soạn thảo</button>
          </div>
          {!inEditor && selected && draft.content !== selected.content && (
            <button className={styles.textAction} type="button" onClick={() => setSelectedId("")} disabled={busy}>Xem bản đang soạn</button>
          )}
        </div>
        {inEditor ? (
          <form className={`store-form ${workbench.body} ${styles.editor}`} id={editorId} onSubmit={save}>
            <div className={styles.editorTop}>
              <label>Mã phiên bản
                <input required maxLength={40} placeholder="Ví dụ 1.1" value={draft.version} readOnly={Boolean(draft.id)} disabled={busy}
                  onChange={(event) => setDraft({ ...draft, version: event.target.value })} />
              </label>
              <small>Mỗi mục bắt đầu bằng <code>###</code>. Dùng <code>-</code> cho danh sách, <code>**chữ**</code> để in đậm.</small>
            </div>
            <label>Nội dung chính sách
              <textarea aria-label="Nội dung chính sách" required maxLength={16000} value={draft.content} disabled={busy}
                onChange={(event) => setDraft({ ...draft, content: event.target.value })} />
            </label>
            <span className={styles.counter}>{new Intl.NumberFormat("vi-VN").format(draft.content.length)} / 16.000 ký tự</span>
          </form>
        ) : (
          <PolicyReader key={selected?.id ?? "writing"} content={selected?.content ?? draft.content} />
        )}
        <div className={workbench.paneFoot}>
          {error && <p className={styles.feedback} role="alert">{error}</p>}
          {notice && !error && <p className={styles.feedback} role="status">{notice}</p>}
          <div className={workbench.row}>
            {inEditor ? (
              <>
                <Button size="small" variant="secondary" disabled={busy} onClick={() => setView("read")}>Xem trước bản nháp</Button>
                <Button size="small" type="submit" form={editorId} loading={busy} loadingLabel="Đang lưu…">Lưu bản nháp</Button>
              </>
            ) : selected ? (
              <>
                {selected.topic && selected.status === "DRAFT"
                  ? <Button size="small" variant="secondary" disabled={busy} onClick={() => loadDraft(selected, true)}>Sửa bản nháp</Button>
                  : <Button size="small" variant="secondary" disabled={busy} onClick={() => loadDraft(selected)}>Tạo bản nháp từ phiên bản này</Button>}
                {canPublish && <Button size="small" disabled={busy} onClick={() => setConfirm(true)}>{selected.status === "SUPERSEDED" ? "Khôi phục phiên bản" : "Công bố phiên bản này"}</Button>}
              </>
            ) : <Button size="small" disabled={busy} onClick={() => setView("edit")}>Tiếp tục soạn thảo</Button>}
          </div>
        </div>
      </section>
      <Dialog open={confirm && canPublish} title="Công bố chính sách" onClose={() => setConfirm(false)}>
        <p>Website và chatbot sẽ chuyển từ phiên bản {active?.version} sang {selected?.version}.</p>
        <div className={workbench.row}>
          <Button variant="secondary" onClick={() => setConfirm(false)}>Quay lại</Button>
          <Button disabled={busy} onClick={publish}>Xác nhận công bố</Button>
        </div>
      </Dialog>
    </div>
  );
}

function PolicyReader({ content }: { content: string }) {
  const [position, setPosition] = useState(0);
  const reader = useRef<HTMLElement>(null);
  const sections = policySections(content);
  if (!sections.length) return <p className={workbench.empty}>Thêm nội dung trong phần Soạn thảo để xem trước.</p>;

  const index = Math.min(position, sections.length - 1);
  function navigate(next: number) {
    setPosition(next);
    reader.current?.scrollTo({ top: 0 });
  }
  const displayed = index === -1 ? sections : [sections[index]];
  return (
    <>
      {sections.length > 1 && (
        <div className={styles.readerNav}>
          <label>Đến mục
            <select aria-label="Đến mục trong chính sách" value={index} onChange={(event) => navigate(Number(event.target.value))}>
              {sections.map((section, i) => <option key={section.id} value={i}>{i + 1}. {section.title}</option>)}
              <option value={-1}>Toàn văn</option>
            </select>
          </label>
          {index >= 0 && <div className={workbench.row}>
            <Button size="small" variant="secondary" aria-label="Mục trước" disabled={index === 0} onClick={() => navigate(index - 1)}>←</Button>
            <span className={workbench.quiet}>{index + 1}/{sections.length}</span>
            <Button size="small" variant="secondary" aria-label="Mục sau" disabled={index === sections.length - 1} onClick={() => navigate(index + 1)}>→</Button>
          </div>}
        </div>
      )}
      <article ref={reader} className={styles.reader} aria-label="Nội dung chính sách" tabIndex={0}>
        {displayed.map((section) => (
          <section key={section.id}>
            <h3>{section.title}</h3>
            <PolicyPreview content={section.content} className={styles.copy} />
          </section>
        ))}
      </article>
    </>
  );
}

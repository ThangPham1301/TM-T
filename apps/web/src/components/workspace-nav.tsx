"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { accountNavigation, adminNavigation } from "@/shared/layout/navigation";
import { Button } from "@/shared/ui";
import styles from "./pagination.module.css";
export function WorkspaceNav({
  admin = false,
  section,
  showIcons = false,
}: {
  admin?: boolean;
  section: string;
  showIcons?: boolean;
}) {
  const sections = admin ? adminNavigation : accountNavigation;
  return (
    <nav
      className="store-tabs"
      aria-label={admin ? "Chức năng quản trị" : "Chức năng tài khoản"}
    >
      {sections.map(({ key, label: name, href, icon }) => (
        <Link
          className={section === key ? "active" : ""}
          key={key}
          href={href}
          aria-current={section === key ? "page" : undefined}
          aria-label={showIcons ? name : undefined}
        >
          {showIcons && icon && <span className="material-symbols-outlined operations-nav-icon" aria-hidden="true">{icon}</span>}
          {showIcons ? <span className="operations-nav-label">{name}</span> : name}
        </Link>
      ))}
    </nav>
  );
}
export function Pagination({
  page,
  total,
  pageSize,
  onChange,
  allowJump = false,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  allowJump?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.max(1, Math.min(page, pages));
  return (
    <nav className={styles.bar} aria-label="Phân trang">
      <span className={styles.summary} role="status">{total} kết quả · Trang {current}/{pages}</span>
      <div className={styles.controls}>
        <Button variant="secondary" size="small" aria-label="Trang trước" disabled={current <= 1} onClick={() => onChange(current - 1)}>← Trước</Button>
        <Button variant="secondary" size="small" aria-label="Trang sau" disabled={current >= pages} onClick={() => onChange(current + 1)}>Sau →</Button>
      </div>
      {allowJump && pages > 1 && <PageJump key={`${current}/${pages}`} current={current} pages={pages} onChange={onChange} />}
    </nav>
  );
}

function PageJump({ current, pages, onChange }: { current: number; pages: number; onChange: (page: number) => void }) {
  const id = useId();
  const [value, setValue] = useState("");
  return (
    <form className={styles.jump} onSubmit={(event) => {
      event.preventDefault();
      const page = Number(value);
      if (Number.isInteger(page) && page >= 1 && page <= pages) {
        onChange(page);
        setValue("");
      }
    }}>
      <label htmlFor={id}>Đến trang</label>
      <input id={id} type="number" min={1} max={pages} step={1} inputMode="numeric" required value={value} placeholder={String(current)}
        onChange={(event) => setValue(event.target.value)} />
      <Button type="submit" variant="secondary" size="small" disabled={!value}>Đi</Button>
    </form>
  );
}

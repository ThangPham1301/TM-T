import type { ReactNode } from "react";
import { AccountSidebar } from "./account-sidebar";
import { BrandMark } from "./brand-mark";
import { adminNavigation } from "./navigation";
import styles from "./layout.module.css";

export type AdminShellProps = { section: string; title: string; children: ReactNode; logoSrc?: string; headerActions?: ReactNode };
/** Presentation only: caller must retain existing authorization guard. */
export function AdminShell({ section, title, children, logoSrc, headerActions }: AdminShellProps) {
  return <div className={styles.shell}>
    <header className={styles.header}><BrandMark href="/admin" logoSrc={logoSrc} label="Gói Huế · Quản trị" /><span>{title}</span>{headerActions}</header>
    <div className={styles.grid}><AccountSidebar section={section} items={adminNavigation} label="Chức năng quản trị" /><div className={styles.content}>{children}</div></div>
  </div>;
}


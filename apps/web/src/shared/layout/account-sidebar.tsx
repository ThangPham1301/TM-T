import Link from "next/link";
import { accountNavigation, type NavigationItem } from "./navigation";
import styles from "./layout.module.css";

export type AccountSidebarProps = { section: string; items?: readonly NavigationItem[]; label?: string };
export function AccountSidebar({ section, items = accountNavigation, label = "Chức năng tài khoản" }: AccountSidebarProps) {
  return <nav aria-label={label} className={styles.nav}>{items.map(item => <Link key={item.key} href={item.href} aria-current={item.key === section ? "page" : undefined}>{item.label}</Link>)}</nav>;
}


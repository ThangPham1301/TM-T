import type { ReactNode } from "react";
import styles from "./ui.module.css";

export type EmptyStateProps = { title: string; description?: string; action?: ReactNode };
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return <section className={styles.empty}><h2 className={styles.emptyTitle}>{title}</h2>{description && <p>{description}</p>}{action}</section>;
}


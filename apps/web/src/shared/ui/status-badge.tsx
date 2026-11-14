import type { HTMLAttributes } from "react";
import styles from "./ui.module.css";

export type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "success" | "warning" | "errorTone" };
export function StatusBadge({ tone = "neutral", className = "", children, ...props }: StatusBadgeProps) {
  return <span {...props} className={[styles.badge, styles[tone], className].join(" ")}>{children}</span>;
}


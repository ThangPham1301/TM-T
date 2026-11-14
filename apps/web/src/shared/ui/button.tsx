import type { ButtonHTMLAttributes } from "react";
import styles from "./ui.module.css";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  size?: "small" | "medium" | "large";
  loading?: boolean;
  loadingLabel?: string;
};
export function Button({ variant = "primary", size = "medium", loading = false, loadingLabel = "Đang xử lý…", disabled, type = "button", className = "", children, ...props }: ButtonProps) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={[styles.button, styles[variant], styles[size], className].join(" ")}>{loading ? loadingLabel : children}</button>;
}


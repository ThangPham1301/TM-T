"use client";
import { useId, type SelectHTMLAttributes, type ReactNode } from "react";
import styles from "./ui.module.css";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: ReactNode;
  hint?: string;
  error?: string;
};
export function Select({ label, hint, error, id, className = "", children, "aria-describedby": describedBy, ...props }: SelectProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return <div className={styles.field}>
    <label htmlFor={fieldId}>{label}</label>
    <select {...props} id={fieldId} className={[styles.select, className].join(" ")} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={[describedBy, hint && fieldId + "-hint", error && fieldId + "-error"].filter(Boolean).join(" ") || undefined}>{children}</select>
    {hint && <p id={fieldId + "-hint"} className={styles.help}>{hint}</p>}
    {error && <p id={fieldId + "-error"} className={styles.error} role="alert">{error}</p>}
  </div>;
}


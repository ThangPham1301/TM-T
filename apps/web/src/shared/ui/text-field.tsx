"use client";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./ui.module.css";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  hint?: string;
  error?: string;
};
export function TextField({ label, hint, error, id, className = "", "aria-describedby": describedBy, ...props }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const description = [describedBy, hint && fieldId + "-hint", error && fieldId + "-error"].filter(Boolean).join(" ") || undefined;
  return <div className={styles.field}>
    <label htmlFor={fieldId}>{label}</label>
    <input {...props} id={fieldId} className={[styles.input, className].join(" ")} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={description} />
    {hint && <p id={fieldId + "-hint"} className={styles.help}>{hint}</p>}
    {error && <p id={fieldId + "-error"} className={styles.error} role="alert">{error}</p>}
  </div>;
}


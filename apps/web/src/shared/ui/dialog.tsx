"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";
import styles from "./ui.module.css";

export type DialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  className?: string;
};
/** Native modal provides focus containment, Escape and background inertness. */
export function Dialog({ open, title, children, onClose, closeLabel = "Đóng", className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      return () => {
        dialog.close();
        if (previous?.isConnected) previous.focus();
      };
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className={className ? `${styles.dialog} ${className}` : styles.dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className={styles.dialogHeader}><h2 id={titleId} className={styles.dialogTitle}>{title}</h2><Button variant="secondary" onClick={onClose}>{closeLabel}</Button></div>
    {children}
  </dialog>;
}


"use client";
import { useEffect, useRef, type ReactNode } from "react";
export function LanDialog({
  children,
  onClose,
  drawer = false,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
  label: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`lan-modal ${drawer ? "lan-drawer" : ""}`}
      aria-label={label}
      onClose={onClose}
    >
      {children}
    </dialog>
  );
}

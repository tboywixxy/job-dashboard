"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "default",
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  return <dialog ref={ref} className="confirm-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="confirm-dialog-body">
      <div className={`confirm-dialog-icon ${tone === "danger" ? "is-danger" : ""}`}>{tone === "danger" ? <AlertTriangle size={21} /> : <ShieldCheck size={21} />}</div>
      <button type="button" className="confirm-dialog-close" aria-label="Close confirmation" disabled={busy} onClick={onClose}><X size={18} /></button>
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{description}</p>
      <div className="confirm-dialog-actions"><button type="button" className="ui-button" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className={`ui-button ${tone === "danger" ? "ui-danger" : "ui-primary"}`} disabled={busy} onClick={onConfirm}>{confirmLabel}</button></div>
    </div>
  </dialog>;
}

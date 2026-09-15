"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function SidePanel({ open, title, description, onClose, busy = false, children, footer }: {
  open: boolean; title: string; description?: string; onClose: () => void;
  busy?: boolean; children: ReactNode; footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  return <dialog ref={ref} className="side-panel" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => {
    if (busy || event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <header className="side-panel-header"><div className="min-w-0"><h2 id={titleId} className="text-lg font-semibold">{title}</h2>{description && <p id={descriptionId} className="mt-1 break-words text-sm text-slate-500">{description}</p>}</div><button autoFocus type="button" className="ui-button !p-2" disabled={busy} aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}><X size={20} /></button></header>
    <div className="side-panel-body">{children}</div>
    {footer && <footer className="side-panel-footer">{footer}</footer>}
  </dialog>;
}

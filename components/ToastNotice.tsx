"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info";
export function ToastNotice({ tone, text, onClose, index = 0 }: {
  tone: ToastTone; text: string; onClose: () => void; index?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.showPopover?.(); }, []);
  const Icon = tone === "error" ? CircleAlert : tone === "success" ? CheckCircle2 : Info;
  return <div ref={ref} popover="manual" className={`toast-dropdown toast-${tone}`} style={{ top: `${20 + index * 116}px` }} role={tone === "error" ? "alert" : "status"}>
    <Icon className="toast-icon" size={21} />
    <div className="min-w-0 flex-1"><p className="font-semibold">{tone === "error" ? "Something needs attention" : tone === "success" ? "All done" : "Workspace update"}</p><p className="mt-1 text-sm leading-5 text-slate-500">{text}</p></div>
    <button type="button" onClick={onClose} aria-label="Dismiss notification"><X size={16} /></button>
  </div>;
}

type Notice = { id: number; tone: ToastTone; text: string };
export function useToasts() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextId = useRef(0);
  const notify = useCallback((tone: ToastTone, text: string) => {
    const id = ++nextId.current;
    setNotices((items) => [...items.filter((item) => item.text !== text), { id, tone, text }].slice(-3));
  }, []);
  const dismiss = useCallback((id: number) => setNotices((items) => items.filter((item) => item.id !== id)), []);
  useEffect(() => {
    if (!notices.length) return;
    const timer = window.setTimeout(() => dismiss(notices[0].id), notices[0].tone === "error" ? 10000 : 5000);
    return () => window.clearTimeout(timer);
  }, [notices, dismiss]);
  return { notify, toasts: notices.map((notice, index) => <ToastNotice key={notice.id} {...notice} index={index} onClose={() => dismiss(notice.id)} />) };
}

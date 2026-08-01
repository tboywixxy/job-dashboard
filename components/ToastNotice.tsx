"use client";

import { X } from "lucide-react";

export type ToastTone = "success" | "error" | "info";

export function ToastNotice({
  tone,
  text,
  onClose,
}: {
  tone: ToastTone;
  text: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed right-4 top-4 z-50 w-[calc(100vw-2rem)] max-w-sm sm:right-6 sm:top-6" role="status" aria-live="polite">
      <div
        className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${
          tone === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : tone === "success"
              ? "border-[#48C05C]/30 bg-white text-[#2f8f42]"
              : "border-amber-200 bg-white text-amber-700"
        }`}
      >
        <p className="min-w-0 flex-1 leading-5">{text}</p>
        <button
          type="button"
          onClick={onClose}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-current/70 transition hover:bg-black/5 hover:text-current"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

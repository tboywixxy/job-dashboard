"use client";

import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

export function FilterBar({ label = "Filters", summary = "All results", children }: { label?: string; summary?: string; children: ReactNode }) {
  return <section className="filter-disclosure" aria-label={label || "Filters"}>
    <div className="filter-bar-heading"><span className="filter-trigger"><SlidersHorizontal size={15} />{label && <span className="sr-only">{label}</span>}</span><span className="filter-summary">{summary}</span></div>
    <div className="filter-content">{children}</div>
  </section>;
}

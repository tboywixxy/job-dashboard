"use client";

import type { ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

export function FilterBar({ label = "Filters", summary = "All results", children }: { label?: string; summary?: string; children: ReactNode }) {
  return <details className="filter-disclosure">
    <summary><span className="filter-trigger"><SlidersHorizontal size={16} />{label}</span><span className="filter-summary">{summary}</span><ChevronDown size={16} className="filter-chevron" /></summary>
    <div className="filter-content">{children}</div>
  </details>;
}

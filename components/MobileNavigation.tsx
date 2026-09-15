"use client";

import { useRef } from "react";
import Link from "next/link";
import { LogOut, Menu, Moon, Sun, type LucideIcon } from "lucide-react";
import type { ThemeMode } from "@/lib/theme";

type Item = { label: string; href: string; icon: LucideIcon; active?: boolean };
export function MobileNavigation({ items, onNavigate, onLogout, themeMode, onToggleTheme }: {
  items: Item[]; onNavigate?: (href: string) => void; onLogout?: () => void;
  themeMode: ThemeMode; onToggleTheme: () => void;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  return <div className="mobile-header lg:hidden">
    <Link href="/" className="brand-lockup"><span className="brand-mark">M</span><span>Mastaskillz</span></Link>
    <div className="flex shrink-0 items-center gap-2">
    <button type="button" className="ui-button !px-3" onClick={onToggleTheme} aria-label={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={themeMode === "dark" ? "Light mode" : "Dark mode"}>
      {themeMode === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
    <details ref={disclosure} className="mobile-menu" onKeyDown={(event) => {
      if (event.key === "Escape" && disclosure.current) {
        disclosure.current.open = false;
        disclosure.current.querySelector("summary")?.focus();
      }
    }}>
      <summary aria-label="Open navigation menu"><Menu size={20} /><span className="sr-only">Menu</span></summary>
      <nav aria-label="Mobile dashboard navigation">
        {items.map((item) => <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} onClick={(event) => {
          if (disclosure.current) disclosure.current.open = false;
          if (onNavigate) { event.preventDefault(); onNavigate(item.href); }
        }}><item.icon size={19} /><span>{item.label}</span></Link>)}
        <button type="button" onClick={() => { if (disclosure.current) disclosure.current.open = false; onLogout?.(); }}><LogOut size={19} />Logout</button>
      </nav>
    </details>
    </div>
  </div>;
}

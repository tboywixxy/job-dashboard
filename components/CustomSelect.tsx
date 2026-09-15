"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption<T extends string> = { value: T; label: string };

export function CustomSelect<T extends string>({ value, options, onChange, ariaLabel, disabled, className = "" }: {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  function positionMenu() {
    if (!trigger.current || !menu.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const upwards = below < 200 && above > below;
    const height = Math.max(0, Math.min(256, upwards ? above : below));
    const width = Math.min(Math.max(rect.width, 160), window.innerWidth - 16);
    Object.assign(menu.current.style, {
      width: `${width}px`, maxHeight: `${height}px`,
      left: `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`,
      top: upwards ? "auto" : `${rect.bottom + 6}px`,
      bottom: upwards ? `${window.innerHeight - rect.top + 6}px` : "auto",
    });
  }

  function close() { menu.current?.hidePopover(); }
  function show(index = selectedIndex) {
    if (disabled || !options.length) return;
    setActive(index);
    positionMenu();
    menu.current?.showPopover();
  }
  function choose(index: number) {
    if (disabled || !options[index]) return;
    onChange(options[index].value);
    close();
    trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open]);
  useEffect(() => { if (disabled) menu.current?.hidePopover(); }, [disabled]);
  useEffect(() => {
    if (open) menu.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Tab") { close(); return; }
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (!open) { show(event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : selectedIndex); return; }
      if (event.key === "Enter" || event.key === " ") { choose(active); return; }
      setActive((index) => event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = (now - search.current.time < 700 ? search.current.text : "") + event.key.toLowerCase();
      search.current = { text, time: now };
      const index = options.findIndex((option) => option.label.toLowerCase().startsWith(text));
      if (index >= 0) { if (open) setActive(index); else show(index); }
    }
  }

  return <div className={`relative min-w-0 ${className}`}>
    <button ref={trigger} type="button" role="combobox" aria-label={ariaLabel} aria-haspopup="listbox" aria-controls={id} aria-expanded={open} aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled || !options.length} onKeyDown={onKeyDown} onClick={() => { if (open) close(); else show(); }} className="custom-select-trigger">
      <span className="truncate">{options[selectedIndex]?.label || "No options"}</span><ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
    </button>
    <div ref={menu} id={id} popover="auto" role="listbox" aria-label={ariaLabel} className="custom-select-menu" onToggle={(event) => setOpen(event.newState === "open")} onPointerDown={(event) => event.preventDefault()}>
      {options.map((option, index) => <div id={`${id}-${index}`} key={option.value} role="option" aria-selected={option.value === value} onPointerMove={() => setActive(index)} onClick={() => choose(index)} className={`custom-select-option ${index === active ? "custom-select-option-active" : ""}`}>
        <span className="truncate">{option.label}</span>{option.value === value && <Check className="h-4 w-4 shrink-0" />}
      </div>)}
    </div>
  </div>;
}

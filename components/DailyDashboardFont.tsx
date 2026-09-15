"use client";

import { useEffect } from "react";

// Locally available fonts keep the daily rotation usable without font downloads.
const fonts = [
  '"Trebuchet MS", sans-serif',
  'Georgia, serif',
  'Verdana, sans-serif',
  '"Palatino Linotype", Palatino, serif',
  'Tahoma, Geneva, sans-serif',
  'Cambria, "Times New Roman", serif',
  'Arial, Helvetica, sans-serif',
];

export function DailyDashboardFont() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const now = new Date();
      const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
      document.documentElement.style.setProperty("--dashboard-font", fonts[day % fonts.length]);
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(update, midnight.getTime() - now.getTime());
    };
    update();
    // Refresh after a sleeping device or background tab becomes active again.
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return null;
}

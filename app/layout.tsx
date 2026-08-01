// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Analytics Dashboard",
  description: "Frontend Intern Technical Interview: Job Analytics Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f5f7fb] text-slate-950">
        {children}
      </body>
    </html>
  );
}

// app/layout.tsx
import type { Metadata } from "next";
import { DailyDashboardFont } from "@/components/DailyDashboardFont";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mastaskillz | Admin Workspace",
  description: "Mastaskillz analytics, campaigns, and community feedback.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem("dashboard-theme");
                if (!theme) theme = "light";
                document.documentElement.classList.toggle("dark", theme === "dark");
              } catch {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen">
        <DailyDashboardFont />
        {children}
      </body>
    </html>
  );
}

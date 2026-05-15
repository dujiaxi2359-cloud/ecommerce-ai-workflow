import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HydrationErrorFilter } from "@/app/hydration-error-filter";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 生图工作流",
  description: "面向海报、产品图、电商图、封面图的本地 AI 生图工作流工具",
  other: {
    google: "notranslate",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN" translate="no" suppressHydrationWarning>
      <body translate="no" suppressHydrationWarning>
        <HydrationErrorFilter />
        {children}
      </body>
    </html>
  );
}

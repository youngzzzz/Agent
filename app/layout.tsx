import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { GenerationProvider } from "@/components/generation-provider";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "AI Transformation Canvas",
  description: "把任意行业场景，拆成一套可落地的 AI 产品方案",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-ink-50 text-ink-900">
        <ToastProvider>
          <GenerationProvider>{children}</GenerationProvider>
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}

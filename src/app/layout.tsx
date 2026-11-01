import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Canvas } from "@/components/common/canvas";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Product SOP", template: "%s · Product SOP" },
  description: "Product launch pipeline — SOPs, tasks and handoffs in one place.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f6f7f9",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Canvas />
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}

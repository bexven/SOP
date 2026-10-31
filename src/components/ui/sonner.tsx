"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "glass-strong !rounded-panel !border-white/70 !text-slate-900 !font-sans !text-body !shadow-[var(--glass-highlight),var(--glass-shadow)]",
          description: "!text-slate-600",
          success: "[&_[data-icon]]:!text-emerald-600",
          error: "[&_[data-icon]]:!text-rose-600",
        },
      }}
      {...props}
    />
  );
}

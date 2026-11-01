import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full rounded-control border border-slate-200 bg-white px-3 py-2 text-body text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-slate-400",
        "focus-visible:border-indigo-400 focus-visible:ring-[3px] focus-visible:ring-indigo-500/20 focus-visible:outline-none",
        "aria-invalid:border-rose-400 aria-invalid:ring-[3px] aria-invalid:ring-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

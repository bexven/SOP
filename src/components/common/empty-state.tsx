import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("surface flex flex-col items-center rounded-panel px-6 py-14 text-center", className)}>
      <div className="relative mb-4">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-indigo-400/10 blur-xl" />
        <div className="flex size-11 items-center justify-center rounded-control bg-gradient-to-b from-white to-slate-50 text-slate-500 shadow-[0_1px_2px_rgb(15_23_42/0.06)] ring-1 ring-slate-200">
          <Icon className="size-5" />
        </div>
      </div>
      <h2 className="text-section text-slate-900">{title}</h2>
      <p className="mt-1 max-w-sm text-body text-slate-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

import { cn } from "@/lib/utils";

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex size-7 items-center justify-center rounded-[8px] bg-gradient-to-br from-indigo-500 to-violet-500 shadow-[0_1px_2px_rgb(79_70_229/0.3),inset_0_1px_0_rgb(255_255_255/0.25)]">
        <svg viewBox="0 0 32 32" className="size-4" aria-hidden>
          <path d="M8 10h16M8 16h11M8 22h6" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </span>
      {withText ? <span className="text-section tracking-tight whitespace-nowrap text-slate-900">Product SOP</span> : null}
    </span>
  );
}

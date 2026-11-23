import { cn } from "@/lib/utils";

/** ClickUp-style property line in a task window: grey icon + label on the left, the value or a compact control on the right. */
export function PropertyRow({ icon: Icon, label, htmlFor, children, className }: { icon: React.ComponentType<{ className?: string }>; label: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  const Tag = htmlFor ? "label" : "span";
  return (
    <div className={cn("grid min-h-9 grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2", className)}>
      <Tag {...(htmlFor ? { htmlFor } : {})} className="flex items-center gap-2 text-meta font-normal text-slate-500">
        <Icon className="size-4 shrink-0 text-slate-400" aria-hidden />
        {label}
      </Tag>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Quiet trigger style for selects / inputs inside a property row (border shows on hover / focus). */
export const PROP_CONTROL = "h-8 border-transparent bg-transparent px-2 shadow-none hover:border-[var(--line)] hover:bg-hover focus-visible:border-[var(--input)] data-[state=open]:border-[var(--input)]";

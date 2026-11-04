import type { Role } from "@/generated/prisma/enums";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

export type PillTone = "slate" | "indigo" | "violet" | "sky" | "emerald" | "amber" | "orange" | "rose";

// Soft-tinted background with darker text of the same hue (AA contrast).
const TONES: Record<PillTone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  sky: "bg-sky-50 text-sky-800 ring-sky-100",
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  amber: "bg-amber-50 text-amber-800 ring-amber-100",
  orange: "bg-orange-50 text-orange-800 ring-orange-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
};

export function Pill({
  tone = "slate",
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: PillTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-2 text-meta whitespace-nowrap ring-1 ring-inset [&_svg]:size-3",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

const ROLE_TONES: Record<Role, PillTone> = {
  RESEARCHER: "sky",
  IMAGE_DESIGNER: "violet",
  VIDEO_EDITOR: "orange",
  MEDIA_BUYER: "emerald",
  REVIEWER: "amber",
  ADMIN: "indigo",
  CUSTOMER_SUPPORT: "sky",
  OFFICE_SECRETARY: "slate",
  SUPPLY_CHAIN: "orange",
};

export function RolePill({ role, className }: { role: Role; className?: string }) {
  return (
    <Pill tone={ROLE_TONES[role]} className={className}>
      {ROLE_LABELS[role]}
    </Pill>
  );
}

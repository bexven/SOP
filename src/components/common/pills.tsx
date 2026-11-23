import { CalendarIcon, CheckIcon, FlagIcon, LockIcon, RotateCcwIcon, SendIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampaignStatus, Priority, ProductStage, TaskStatus } from "@/generated/prisma/enums";
import { dueBucket, dueLabel } from "@/lib/domain/due";
import {
  CAMPAIGN_STATUS_LABELS,
  PRIORITY_LABELS,
  STAGE_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/domain/labels";
import type { MarginBand } from "@/lib/domain/margin";
import { Pill, type PillTone } from "./pill";
import { HEX_COLOR } from "@/lib/brand-color";

export const STAGE_TONE: Record<ProductStage, PillTone> = {
  RESEARCH: "sky",
  REVIEW: "indigo",
  CREATIVE: "violet",
  READY_TO_LAUNCH: "amber",
  LIVE: "emerald",
  COMPLETED: "slate",
  KILLED: "rose",
};

/** Solid dot colour per stage (stepper, kanban headers). */
export const STAGE_DOT: Record<ProductStage, string> = {
  RESEARCH: "bg-sky-500",
  REVIEW: "bg-indigo-500",
  CREATIVE: "bg-violet-500",
  READY_TO_LAUNCH: "bg-amber-500",
  LIVE: "bg-emerald-500",
  COMPLETED: "bg-slate-400",
  KILLED: "bg-rose-500",
};

/** Status-like tags read as ClickUp statuses: small caps, bold. */
const TAG = "h-[18px] px-1.5 text-[10.5px] font-semibold tracking-[0.03em] uppercase";

export function StagePill({ stage, className }: { stage: ProductStage; className?: string }) {
  return (
    <Pill tone={STAGE_TONE[stage]} className={cn(TAG, className)}>
      <span className={`size-1.5 rounded-full ${STAGE_DOT[stage]}`} aria-hidden />
      {STAGE_LABELS[stage]}
    </Pill>
  );
}

const PRIORITY_FLAG: Record<Priority, string> = {
  URGENT: "fill-rose-600 text-rose-600",
  HIGH: "fill-orange-500 text-orange-500",
  MEDIUM: "fill-sky-500 text-sky-500",
  LOW: "fill-slate-300 text-slate-400",
};

/** ClickUp-style priority: a coloured flag and the word, no box. */
export function PriorityPill({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 text-meta whitespace-nowrap text-slate-600", className)}>
      <FlagIcon className={cn("size-3.5", PRIORITY_FLAG[priority])} aria-hidden />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

const DUE_TITLE = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

/** Due date as quiet text: red only when overdue, amber when due today. */
export function DuePill({ dueAt, className }: { dueAt: string | Date | null; className?: string }) {
  if (!dueAt) return null;
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  const now = new Date();
  const bucket = dueBucket(due, now);
  const tone = bucket === "overdue" ? "text-rose-700" : bucket === "today" ? "text-amber-700" : "text-slate-600";
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 text-meta whitespace-nowrap", tone, className)} suppressHydrationWarning title={DUE_TITLE.format(due)}>
      <CalendarIcon className="size-3.5" aria-hidden />
      <span className="num" suppressHydrationWarning>
        {dueLabel(due, now)}
      </span>
    </span>
  );
}

const STATUS_TONE: Record<TaskStatus, PillTone> = {
  LOCKED: "slate",
  TODO: "slate",
  SUBMITTED: "indigo",
  REVISION: "rose",
  APPROVED: "emerald",
  CANCELLED: "slate",
};

const STATUS_ICON: Partial<Record<TaskStatus, React.ComponentType<{ className?: string }>>> = {
  LOCKED: LockIcon,
  SUBMITTED: SendIcon,
  REVISION: RotateCcwIcon,
  APPROVED: CheckIcon,
  CANCELLED: XIcon,
};

export function TaskStatusPill({
  status,
  className,
  label,
}: {
  status: TaskStatus;
  className?: string;
  /** Override the label (e.g. "Done" for tasks without a reviewer). */
  label?: string;
}) {
  const Icon = STATUS_ICON[status];
  return (
    <Pill tone={STATUS_TONE[status]} className={cn(TAG, className)}>
      {Icon ? <Icon /> : <span className="size-1.5 rounded-full border border-slate-400" aria-hidden />}
      {label ?? TASK_STATUS_LABELS[status]}
    </Pill>
  );
}

const CAMPAIGN_TONE: Record<CampaignStatus, PillTone> = {
  NOT_LAUNCHED: "slate",
  RUNNING: "emerald",
  SCALING: "indigo",
  PAUSED: "amber",
  STOPPED: "slate",
};

export function CampaignPill({ status }: { status: CampaignStatus }) {
  return (
    <Pill tone={CAMPAIGN_TONE[status]} className={TAG}>
      {CAMPAIGN_STATUS_LABELS[status]}
    </Pill>
  );
}

const BAND_TEXT: Record<MarginBand, string> = { healthy: "text-emerald-700", ok: "text-amber-700", thin: "text-rose-700" };
const BAND_LABEL: Record<MarginBand, string> = { healthy: "Healthy", ok: "OK", thin: "Thin" };

export function MarginBadge({
  pct,
  band,
  className,
}: {
  pct: string | null | undefined;
  band: MarginBand | null | undefined;
  className?: string;
}) {
  if (!pct || !band) return null;
  return (
    <span className={cn("num inline-flex h-5 items-center text-meta", BAND_TEXT[band], className)} title={`${BAND_LABEL[band]} margin`}>
      {pct}%<span className="sr-only"> margin, {BAND_LABEL[band]}</span>
    </span>
  );
}

/** Brand as a coloured dot and its name (ClickUp "space" style), not a coloured box. */
export function BrandPill({ brand, className }: { brand: { name: string; color: string } | null | undefined; className?: string }) {
  if (!brand) return null;
  const valid = HEX_COLOR.test(brand.color);
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 text-meta whitespace-nowrap text-slate-700", className)}>
      <span className="size-2 shrink-0 rounded-[3px]" style={{ backgroundColor: valid ? brand.color : "#94a3b8" }} aria-hidden />
      {brand.name}
    </span>
  );
}

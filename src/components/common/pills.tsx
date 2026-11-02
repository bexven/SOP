import { CheckIcon, ClockIcon, LockIcon, RotateCcwIcon, SendIcon, XIcon } from "lucide-react";
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
import { brandText, brandTint, HEX_COLOR } from "@/lib/brand-color";

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

export function StagePill({ stage, className }: { stage: ProductStage; className?: string }) {
  return (
    <Pill tone={STAGE_TONE[stage]} className={className}>
      <span className={`size-1.5 rounded-full ${STAGE_DOT[stage]}`} aria-hidden />
      {STAGE_LABELS[stage]}
    </Pill>
  );
}

const PRIORITY_TONE: Record<Priority, PillTone> = { URGENT: "rose", HIGH: "orange", MEDIUM: "amber", LOW: "slate" };

export function PriorityPill({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <Pill tone={PRIORITY_TONE[priority]} className={className}>
      {PRIORITY_LABELS[priority]}
    </Pill>
  );
}

const DUE_TITLE = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

export function DuePill({ dueAt, className }: { dueAt: string | Date | null; className?: string }) {
  if (!dueAt) return null;
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  const now = new Date();
  const bucket = dueBucket(due, now);
  const tone: PillTone = bucket === "overdue" ? "rose" : bucket === "today" ? "amber" : "slate";
  return (
    <Pill tone={tone} className={className} suppressHydrationWarning title={DUE_TITLE.format(due)}>
      <ClockIcon aria-hidden />
      <span className="num text-[11px]" suppressHydrationWarning>
        {dueLabel(due, now)}
      </span>
    </Pill>
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
    <Pill tone={STATUS_TONE[status]} className={className}>
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
  return <Pill tone={CAMPAIGN_TONE[status]}>{CAMPAIGN_STATUS_LABELS[status]}</Pill>;
}

const BAND_TONE: Record<MarginBand, PillTone> = { healthy: "emerald", ok: "amber", thin: "rose" };
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
    <Pill tone={BAND_TONE[band]} className={className} title={`${BAND_LABEL[band]} margin`}>
      <span className="num text-[11px]">{pct}%</span>
      <span className="sr-only"> margin, {BAND_LABEL[band]}</span>
    </Pill>
  );
}

export function BrandPill({ brand, className }: { brand: { name: string; color: string } | null | undefined; className?: string }) {
  if (!brand) return null;
  const valid = HEX_COLOR.test(brand.color);
  return (
    <Pill
      tone="slate"
      className={`font-semibold ${className ?? ""}`}
      style={
        valid
          ? ({ backgroundColor: brandTint(brand.color), color: brandText(brand.color), "--tw-ring-color": `${brand.color}40` } as React.CSSProperties)
          : undefined
      }
    >
      {brand.name}
    </Pill>
  );
}

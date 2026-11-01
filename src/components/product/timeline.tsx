import {
  ArrowRightIcon,
  CheckIcon,
  CircleDotIcon,
  CornerUpLeftIcon,
  FileTextIcon,
  LockIcon,
  LockOpenIcon,
  MessageSquareIcon,
  PencilLineIcon,
  PlusIcon,
  RocketIcon,
  RotateCcwIcon,
  SendIcon,
  SkullIcon,
  SparklesIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";
import type { ProductStage, TaskType } from "@/generated/prisma/enums";
import { StagePill } from "@/components/common/pills";
import { UserAvatar } from "@/components/common/user-avatar";
import {
  CAMPAIGN_STATUS_LABELS,
  KILL_REASON_LABELS,
  STAGE_LABELS,
  STAGES,
  TASK_TYPE_LABELS,
  TASK_TYPE_SHORT,
} from "@/lib/domain/labels";
import { formatDuration, timeInStages } from "@/lib/domain/stage-time";
import { formatBdt, formatDateTime, formatUsd } from "@/lib/format";
import type { ProductDetail } from "@/lib/server/queries/product";
import { cn } from "@/lib/utils";

type EventDTO = ProductDetail["events"][number];
type Line = { id: string; icon: React.ComponentType<{ className?: string }>; tone: string; actor: EventDTO["actor"]; text: React.ReactNode; note?: string | null; at: string };

const FIELD: Record<string, string> = {
  name: "name", supplierUrl: "supplier link", imageUrl: "image", chinaPriceRmb: "China price", shippingPerUnitRmb: "shipping",
  sellingPriceBdt: "selling price", rmbToBdtRate: "rate snapshot", courierChargePct: "courier %", targetCustomer: "target customer",
  problemSolved: "problem solved", sellingAngle: "selling angle", referenceLinks: "reference links", priority: "priority",
  targetLaunchDate: "target launch", mediaBuyerId: "media buyer", dueAt: "due date",
};

const task = (t: TaskType | null) => (t ? <strong className="font-medium text-slate-900">{TASK_TYPE_LABELS[t]}</strong> : "a task");
const str = (v: unknown) => (typeof v === "string" ? v : null);

function describe(e: EventDTO, people: Map<string, string>): Omit<Line, "id" | "actor" | "at"> {
  const d = e.data ?? {};
  switch (e.type) {
    case "PRODUCT_CREATED": return { icon: PlusIcon, tone: "text-sky-600", text: "created the product" };
    case "PRODUCT_UPDATED": return { icon: PencilLineIcon, tone: "text-slate-500", text: `updated ${(d.fields as string[] | undefined)?.join(", ") ?? "details"}` };
    case "RESEARCH_SUBMITTED": return { icon: SendIcon, tone: "text-sky-600", text: "submitted research" };
    case "STAGE_CHANGED": return { icon: ArrowRightIcon, tone: "text-indigo-600", text: <>moved to <StagePill stage={d.to as ProductStage} /></> };
    case "TASK_UNLOCKED": return { icon: LockOpenIcon, tone: "text-emerald-600", text: <>{task(e.taskType)} unlocked</> };
    case "TASK_SUBMITTED": return { icon: SendIcon, tone: "text-indigo-600", text: <>submitted {task(e.taskType)}</> };
    case "TASK_APPROVED": return { icon: CheckIcon, tone: "text-emerald-600", text: <>approved {task(e.taskType)}</> };
    case "TASK_REVISION_REQUESTED": return { icon: RotateCcwIcon, tone: "text-rose-600", text: <>requested a revision on {task(e.taskType)}</>, note: str(d.note) };
    case "TASK_REASSIGNED": {
      const to = str(d.to) && people.get(str(d.to)!) ? people.get(str(d.to)!) : str(d.to);
      const from = str(d.from) && people.get(str(d.from)!) ? people.get(str(d.from)!) : str(d.from);
      return { icon: UserRoundIcon, tone: "text-slate-500", text: <>reassigned {task(e.taskType)}{from ? ` from ${from}` : ""} to {to ?? "nobody"}{d.reason === "deactivated" ? " (deactivation)" : ""}</> };
    }
    case "TASK_CANCELLED": return { icon: XIcon, tone: "text-slate-400", text: <>{task(e.taskType)} cancelled</> };
    case "TASK_REOPENED": return { icon: CornerUpLeftIcon, tone: "text-rose-600", text: <>reopened {task(e.taskType)}</>, note: str(d.note) };
    case "TASK_RELOCKED": return { icon: LockIcon, tone: "text-slate-400", text: <>{task(e.taskType)} locked again</> };
    case "BRIEF_UPDATED": return { icon: FileTextIcon, tone: "text-violet-600", text: "updated the creative brief" };
    case "BATCH_REQUESTED": return { icon: SparklesIcon, tone: "text-violet-600", text: `requested creative batch #${d.number}`, note: str(d.reason) };
    case "CAMPAIGN_LAUNCHED": return { icon: RocketIcon, tone: "text-emerald-600", text: `launched the campaign${d.dailyBudgetUsd ? ` at ${formatUsd(String(d.dailyBudgetUsd))}/day` : ""}` };
    case "CAMPAIGN_STATUS_CHANGED":
      return { icon: CircleDotIcon, tone: "text-emerald-600", text: `set the campaign to ${CAMPAIGN_STATUS_LABELS[d.to as keyof typeof CAMPAIGN_STATUS_LABELS] ?? d.to}`, note: str(d.note) };
    case "PRODUCT_SENT_BACK": return { icon: CornerUpLeftIcon, tone: "text-rose-600", text: <>sent the product back to <StagePill stage={d.to as ProductStage} /></>, note: str(d.note) };
    case "PRODUCT_KILLED": return { icon: SkullIcon, tone: "text-rose-600", text: `killed the product (${KILL_REASON_LABELS[d.reason as keyof typeof KILL_REASON_LABELS] ?? d.reason})`, note: str(d.note) };
    case "PRODUCT_COMPLETED": return { icon: CheckIcon, tone: "text-slate-600", text: "marked the product completed" };
    case "OVERRIDE": {
      const changes = (d.changes ?? {}) as Record<string, { old: string | null; new: string | null }>;
      const fmt = (k: string, v: string | null) => {
        if (v === null) return "—";
        if (k === "sellingPriceBdt") return formatBdt(v);
        if (k === "mediaBuyerId") return people.get(v) ?? v;
        if (k === "dueAt") return formatDateTime(new Date(v));
        return v;
      };
      return {
        icon: PencilLineIcon,
        tone: "text-amber-600",
        text: (
          <>
            overrode{e.taskType ? <> {task(e.taskType)}</> : null}{" "}
            {Object.entries(changes).map(([k, c], i) => (
              <span key={k}>
                {i > 0 ? ", " : ""}
                {FIELD[k] ?? k}: <span className="num text-slate-500 line-through">{fmt(k, c.old)}</span> → <span className="num font-medium text-slate-900">{fmt(k, c.new)}</span>
              </span>
            ))}
          </>
        ),
      };
    }
    case "COMMENT_ADDED": return { icon: MessageSquareIcon, tone: "text-slate-500", text: "commented" };
    default: return { icon: CircleDotIcon, tone: "text-slate-400", text: e.type.toLowerCase().replaceAll("_", " ") };
  }
}

/** Collapse bursts of TASK_CREATED (and TASK_CANCELLED) into one line. */
function lines(events: EventDTO[], people: Map<string, string>): Line[] {
  const out: Line[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.type === "TASK_CREATED" || e.type === "TASK_CANCELLED") {
      const group = [e];
      while (
        events[i + 1] &&
        events[i + 1]!.type === e.type &&
        events[i + 1]!.actor.id === e.actor.id &&
        Math.abs(new Date(events[i + 1]!.createdAt).getTime() - new Date(e.createdAt).getTime()) < 10_000
      ) group.push(events[++i]!);
      const names = group.map((g) => (g.taskType ? TASK_TYPE_SHORT[g.taskType] : "task")).reverse();
      const created = e.type === "TASK_CREATED";
      out.push({
        id: e.id,
        icon: created ? PlusIcon : XIcon,
        tone: created ? "text-violet-600" : "text-slate-400",
        actor: e.actor,
        at: e.createdAt,
        text: group.length === 1 ? (created ? <>created {task(e.taskType)}{str(e.data?.assignee) ? ` → ${e.data!.assignee}` : ""}</> : <>{task(e.taskType)} cancelled</>) : `${created ? "created" : "cancelled"} ${group.length} tasks: ${names.join(", ")}`,
      });
      continue;
    }
    out.push({ id: e.id, actor: e.actor, at: e.createdAt, ...describe(e, people) });
  }
  return out;
}

export function Timeline({ product }: { product: ProductDetail }) {
  const people = new Map(product.people.map((p) => [p.id, p.name]));
  const totals = timeInStages(product.transitions.map((t) => ({ toStage: t.toStage, at: new Date(t.at) })), new Date());
  const rows = lines(product.events, people);
  return (
    <div className="grid gap-4">
      <section className="surface rounded-panel p-4" aria-label="Time in each stage">
        <h2 className="text-section text-slate-900">Time in each stage</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {STAGES.filter((s) => totals[s] !== undefined).map((s) => (
            <li key={s} className={cn("flex items-center gap-2 rounded-control border px-3 py-2", s === product.stage ? "border-indigo-200 bg-indigo-50/50" : "border-slate-200 bg-white")}>
              <StagePill stage={s} />
              <span className="num text-body font-medium text-slate-900" suppressHydrationWarning>
                {formatDuration(totals[s]!)}
              </span>
              {s === product.stage ? <span className="text-meta text-indigo-700">now</span> : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-meta font-normal text-slate-500">Includes every visit to a stage (e.g. after a send-back). {STAGE_LABELS[product.stage]} since {formatDateTime(new Date(product.stageEnteredAt))}.</p>
      </section>
      <ol className="surface rounded-panel px-4 py-2" aria-label="Activity">
        {rows.map((l, i) => (
          <li key={l.id} className="relative flex gap-3 py-2.5">
            {i < rows.length - 1 ? <span className="absolute top-9 bottom-0 left-[13px] w-px bg-slate-100" aria-hidden /> : null}
            <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
              <l.icon className={cn("size-3.5", l.tone)} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-body text-slate-700">
                <span className="inline-flex items-center gap-1.5 align-middle">
                  <UserAvatar name={l.actor.name} color={l.actor.avatarColor} imageId={l.actor.avatarAssetId} size="xs" />
                  <span className="font-medium text-slate-900">{l.actor.name}</span>
                </span>{" "}
                {l.text}
              </p>
              {l.note ? <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-body whitespace-pre-line text-slate-700">{l.note}</p> : null}
              <time className="num text-meta font-normal text-slate-500" dateTime={l.at}>
                {formatDateTime(new Date(l.at))}
              </time>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

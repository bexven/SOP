"use client";

import { useState } from "react";
import { ChevronDownIcon, FilmIcon, ImageIcon, ListTodoIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { DuePill } from "@/components/common/pills";
import { laneOf } from "@/lib/domain/labels";
import { can } from "@/lib/domain/permissions";
import { isTerminalStage } from "@/lib/domain/workflow";
import { formatDate } from "@/lib/format";
import type { ProductDetail, TaskDTO } from "@/lib/server/queries/product";
import { cn } from "@/lib/utils";
import { TaskCard } from "@/components/task/task-card";
import { BriefCard } from "./brief-card";
import type { Viewer } from "./product-view";

export function TasksTab({
  product,
  viewer,
  launchPanel,
  focusTaskId,
}: {
  product: ProductDetail;
  viewer: Viewer;
  focusTaskId?: string;
  /** Rendered inside the Campaign Launch task (Phase 4). */
  launchPanel?: (task: TaskDTO) => React.ReactNode;
}) {
  const creative = product.tasks.filter((t) => t.batchId);
  // Newest first: after a send-back the open launch task sits above the cancelled one.
  const launch = product.tasks.filter((t) => t.type === "CAMPAIGN_LAUNCH").reverse();
  const research = product.tasks.filter((t) => t.type === "RESEARCH");
  const batches = [...product.batches].sort((a, b) => b.number - a.number);
  const showBrief = product.stage !== "RESEARCH" || Boolean(product.creativeBrief);
  const canEditBrief = can(viewer.role, "brief.edit") && !isTerminalStage(product.stage);

  if (creative.length === 0 && launch.length === 0) {
    return (
      <div className="grid gap-4">
        {showBrief ? (
          <BriefCard productId={product.id} brief={product.creativeBrief} updatedAt={product.creativeBriefUpdatedAt} canEdit={canEditBrief} />
        ) : null}
        <EmptyState
          icon={ListTodoIcon}
          title="No creative tasks yet"
          description="Seven creative and store tasks are created and assigned automatically when research is submitted."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      {showBrief ? (
        <BriefCard productId={product.id} brief={product.creativeBrief} updatedAt={product.creativeBriefUpdatedAt} canEdit={canEditBrief} />
      ) : null}

      {launch.length ? (
        <Group title="Campaign launch">
          {launch.map((t) => (
            <TaskCard key={t.id} task={t} product={product} viewer={viewer} extra={launchPanel?.(t)} focus={t.id === focusTaskId} />
          ))}
        </Group>
      ) : null}

      {batches.map((b, i) => {
        const tasks = creative.filter((t) => t.batchId === b.id);
        return (
          <BatchSection
            key={b.id}
            batch={b}
            tasks={tasks}
            product={product}
            viewer={viewer}
            defaultOpen={i === 0 || tasks.some((t) => t.id === focusTaskId)}
            focusTaskId={focusTaskId}
          />
        );
      })}

      {research.length ? (
        <Group title="Research">
          {research.map((t) => (
            <TaskCard key={t.id} task={t} product={product} viewer={viewer} focus={t.id === focusTaskId} />
          ))}
        </Group>
      ) : null}
    </div>
  );
}

/** Orders lane tasks: Phase 1 before Phase 2, and each follow-up right after the task it came from. */
function laneOrder(tasks: TaskDTO[]): TaskDTO[] {
  const roots = tasks.filter((t) => !t.followUpOfId || !tasks.some((x) => x.id === t.followUpOfId)).sort((a, b) => a.phase - b.phase);
  const out: TaskDTO[] = [];
  const visit = (t: TaskDTO) => {
    out.push(t);
    tasks.filter((x) => x.followUpOfId === t.id).forEach(visit);
  };
  roots.forEach(visit);
  return out;
}

function BatchSection({
  batch,
  tasks,
  product,
  viewer,
  defaultOpen,
  focusTaskId,
}: {
  batch: ProductDetail["batches"][number];
  tasks: TaskDTO[];
  product: ProductDetail;
  viewer: Viewer;
  defaultOpen: boolean;
  focusTaskId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const live = tasks.filter((t) => t.status !== "CANCELLED");
  const approved = live.filter((t) => t.status === "APPROVED").length;
  const images = laneOrder(tasks.filter((t) => laneOf(t.type) === "images"));
  const videos = laneOrder(tasks.filter((t) => laneOf(t.type) === "videos"));
  const phased = tasks.some((t) => t.phase === 2);
  const lanes = [
    {
      key: "images",
      title: "Images",
      icon: ImageIcon,
      who: images.find((t) => t.assignee)?.assignee?.name,
      hint: phased ? "Website image first — approving it unlocks the 3 ad sizes and the store listing." : "Requested formats.",
      tasks: images,
    },
    {
      key: "videos",
      title: "Videos",
      icon: FilmIcon,
      who: videos.find((t) => t.assignee)?.assignee?.name,
      hint: phased ? "Main video first — approving it unlocks the square video." : "Requested formats.",
      tasks: videos,
    },
  ].filter((l) => l.tasks.length);

  return (
    <section aria-labelledby={`batch-${batch.id}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mb-2 flex w-full items-center gap-2 text-left">
        <h2 id={`batch-${batch.id}`} className="text-section text-slate-900">
          {batch.number === 1 ? "Creative work" : `Creative batch #${batch.number}`}
        </h2>
        <span className="num text-meta text-slate-500">
          {approved}/{live.length} approved
        </span>
        {batch.dueAt ? <DuePill dueAt={batch.dueAt} /> : null}
        <span className="ml-auto flex items-center gap-2 text-meta font-normal text-slate-500">
          <span className="hidden sm:inline">
            {batch.requestedBy ? `${batch.requestedBy} · ` : ""}
            <span className="num">{formatDate(new Date(batch.createdAt))}</span>
          </span>
          <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {batch.reason ? <p className="-mt-1 mb-2 text-meta font-normal text-slate-600">“{batch.reason}”</p> : null}
      {open ? (
        <div className="grid gap-5">
          {lanes.map((lane) => (
            <div key={lane.key}>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                <h3 className="flex items-center gap-1.5 text-body font-semibold text-slate-900">
                  <lane.icon className="size-4 text-slate-500" /> {lane.title}
                </h3>
                {lane.who ? <span className="text-meta text-slate-600">{lane.who}</span> : null}
                <span className="text-meta font-normal text-slate-500">{lane.hint}</span>
              </div>
              <div className="grid gap-2">
                {lane.tasks.map((t) => (
                  <TaskCard key={t.id} task={t} product={product} viewer={viewer} focus={t.id === focusTaskId} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-section text-slate-900">{title}</h2>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

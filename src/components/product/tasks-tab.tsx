"use client";

import { ListTodoIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { DuePill, TaskStatusPill } from "@/components/common/pills";
import { UserAvatar } from "@/components/common/user-avatar";
import { TASK_TYPE_LABELS } from "@/lib/domain/labels";
import type { ProductDetail } from "@/lib/server/queries/product";
import type { Viewer } from "./product-view";

export function TasksTab({ product }: { product: ProductDetail; viewer: Viewer }) {
  const tasks = product.tasks.filter((t) => t.type !== "RESEARCH");
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListTodoIcon}
        title="No creative tasks yet"
        description="Creative tasks are created automatically when research is submitted."
      />
    );
  }
  return (
    <ul className="surface divide-y divide-slate-100 rounded-panel">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-body text-slate-900">{TASK_TYPE_LABELS[t.type]}</span>
          <DuePill dueAt={t.dueAt} />
          <TaskStatusPill status={t.status} />
          {t.assignee ? <UserAvatar name={t.assignee.name} color={t.assignee.avatarColor} size="sm" /> : null}
        </li>
      ))}
    </ul>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, UserRoundIcon } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@/generated/prisma/enums";
import { UserAvatar } from "@/components/common/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { reassignTaskAction } from "@/lib/server/actions/task";
import { cn } from "@/lib/utils";

type PersonOpt = { id: string; name: string; avatarColor: string; avatarAssetId?: string | null; role: Role };

/** Avatar button; opens a menu of eligible people when the viewer may reassign. */
export function ReassignMenu({
  taskId,
  assignee,
  people,
  taskRole,
  canReassign,
  viewerIsAdmin,
}: {
  taskId: string;
  assignee: { id: string; name: string; avatarColor: string; avatarAssetId?: string | null } | null;
  people: PersonOpt[];
  taskRole: Role;
  canReassign: boolean;
  viewerIsAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const options = people.filter((p) => p.role === taskRole || (viewerIsAdmin && p.role === "ADMIN"));

  const face = assignee ? (
    <UserAvatar name={assignee.name} color={assignee.avatarColor} imageId={assignee.avatarAssetId} size="sm" />
  ) : (
    <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400">
      <UserRoundIcon className="size-3.5" />
    </span>
  );

  if (!canReassign) {
    return (
      <span title={assignee ? assignee.name : "Unassigned"} className="inline-flex">
        {face}
        <span className="sr-only">{assignee ? `Assigned to ${assignee.name}` : "Unassigned"}</span>
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
      >
        {face}
        <span className="sr-only">{assignee ? `Reassign (assigned to ${assignee.name})` : "Assign someone (unassigned)"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Assign to a {ROLE_LABELS[taskRole].toLowerCase()}</DropdownMenuLabel>
        {options.length === 0 ? (
          <p className="px-2 py-1.5 text-meta font-normal text-slate-500">Nobody else is available in this role.</p>
        ) : (
          options.map((p) => (
            <DropdownMenuItem
              key={p.id}
              disabled={p.id === assignee?.id}
              onSelect={() =>
                startTransition(async () => {
                  const r = await reassignTaskAction({ taskId, assigneeId: p.id });
                  if (r.ok) {
                    toast.success(r.message);
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              <UserAvatar name={p.name} color={p.avatarColor} imageId={p.avatarAssetId} size="xs" />
              <span className={cn("flex-1", p.id === assignee?.id && "font-medium")}>{p.name}</span>
              {p.id === assignee?.id ? <CheckIcon /> : null}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useState, useTransition } from "react";
import {
  KeyRoundIcon,
  LockKeyholeOpenIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  UserCheckIcon,
  UserXIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Pill, RolePill } from "@/components/common/pill";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setMemberActiveAction, unlockMemberAction } from "@/lib/server/actions/team";
import type { TeamRow } from "@/lib/server/queries/team";
import { cn } from "@/lib/utils";
import { MemberDialog, ResetPinDialog } from "./member-dialogs";

export function AddMemberButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon /> Add person
      </Button>
      <MemberDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function TeamList({ team, currentUserId }: { team: TeamRow[]; currentUserId: string }) {
  const active = team.filter((m) => m.active);
  const inactive = team.filter((m) => !m.active);
  return (
    <div className="grid gap-6">
      <section aria-labelledby="active-heading">
        <h2 id="active-heading" className="mb-2 flex items-center gap-2 text-section text-slate-900">
          Active <span className="num text-meta text-slate-500">{active.length}</span>
        </h2>
        <MemberRows rows={active} currentUserId={currentUserId} />
      </section>
      {inactive.length > 0 ? (
        <section aria-labelledby="inactive-heading">
          <h2 id="inactive-heading" className="mb-2 flex items-center gap-2 text-section text-slate-900">
            Inactive <span className="num text-meta text-slate-500">{inactive.length}</span>
          </h2>
          <MemberRows rows={inactive} currentUserId={currentUserId} />
        </section>
      ) : null}
    </div>
  );
}

function MemberRows({ rows, currentUserId }: { rows: TeamRow[]; currentUserId: string }) {
  return (
    <ul className="surface divide-y divide-slate-100 overflow-hidden rounded-panel">
      {rows.map((m) => (
        <MemberRow key={m.id} member={m} isSelf={m.id === currentUserId} />
      ))}
    </ul>
  );
}

function MemberRow({ member, isSelf }: { member: TeamRow; isSelf: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const r = await action();
      if (r.ok) toast.success(r.message ?? "Saved");
      else toast.error(r.error ?? "Something went wrong");
    });
  }

  return (
    <li className={cn("flex items-center gap-3 px-4 py-3", !member.active && "bg-slate-50/60")}>
      <UserAvatar name={member.name} color={member.avatarColor} imageId={member.avatarAssetId} className={cn(!member.active && "opacity-60")} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("truncate font-medium", member.active ? "text-slate-900" : "text-slate-600")}>
            {member.name}
          </span>
          {isSelf ? <span className="text-meta text-slate-500">(you)</span> : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <RolePill role={member.role} />
          {member.locked ? <Pill tone="rose">Locked</Pill> : null}
          {member.active && member.mustChangePin ? <Pill tone="amber">PIN not set yet</Pill> : null}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${member.name}`} disabled={pending}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <PencilIcon /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPinOpen(true)}>
            <KeyRoundIcon /> Reset PIN
          </DropdownMenuItem>
          {member.locked ? (
            <DropdownMenuItem onSelect={() => run(() => unlockMemberAction({ id: member.id }))}>
              <LockKeyholeOpenIcon /> Unlock now
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {member.active ? (
            <DropdownMenuItem variant="destructive" disabled={isSelf} onSelect={() => setConfirmOpen(true)}>
              <UserXIcon /> Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => run(() => setMemberActiveAction({ id: member.id, active: true }))}>
              <UserCheckIcon /> Reactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <MemberDialog open={editOpen} onOpenChange={setEditOpen} member={member} />
      <ResetPinDialog open={pinOpen} onOpenChange={setPinOpen} member={member} />
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {member.name}?</DialogTitle>
            <DialogDescription>
              They&apos;ll be signed out everywhere and removed from the login screen. Their open tasks are
              reassigned automatically to others in the same role (or flagged to Admins if nobody is free). Their
              history stays intact, and you can reactivate them later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setConfirmOpen(false);
                run(() => setMemberActiveAction({ id: member.id, active: false }));
              }}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

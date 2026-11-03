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
  Trash2Icon,
  UsersRoundIcon,
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
import { removeMemberAction, setMemberActiveAction, setTeamPinAction, unlockMemberAction } from "@/lib/server/actions/team";
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
      <UserAvatar name={member.name} color={member.avatarColor} imageId={member.avatarAssetId} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("truncate font-medium", member.active ? "text-slate-900" : "text-slate-600")}>
            {member.name}
          </span>
          {isSelf ? <span className="text-meta text-slate-500">(you)</span> : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <RolePill role={member.role} />
          {member.isMaster ? <Pill tone="indigo">Master Admin</Pill> : member.adminAccess ? <Pill tone="indigo">Admin access</Pill> : null}
          {member.locked ? <Pill tone="rose">Locked</Pill> : null}
          {member.active && member.pinNotSet ? <Pill tone="rose">No PIN yet — set one</Pill> : member.active && member.mustChangePin ? <Pill tone="amber">Must choose own PIN</Pill> : null}
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
            <KeyRoundIcon /> Change PIN
          </DropdownMenuItem>
          {member.locked ? (
            <DropdownMenuItem onSelect={() => run(() => unlockMemberAction({ id: member.id }))}>
              <LockKeyholeOpenIcon /> Unlock now
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {member.active ? (
            <DropdownMenuItem variant="destructive" disabled={isSelf || member.isMaster} onSelect={() => setConfirmOpen(true)}>
              <UserXIcon /> Deactivate
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => run(() => setMemberActiveAction({ id: member.id, active: true }))}>
                <UserCheckIcon /> Reactivate
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => run(() => removeMemberAction({ id: member.id }))}>
                <Trash2Icon /> Remove from team
              </DropdownMenuItem>
            </>
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

/** Master Admin: give everyone (except you) the same temporary PIN. */
export function TeamPinButton() {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pending, startTransition] = useTransition();
  const valid = /^\d{4,6}$/.test(pin);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UsersRoundIcon /> PIN for everyone
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Same temporary PIN for everyone</DialogTitle>
            <DialogDescription>
              Everyone except you gets this PIN and is signed out. At their next sign-in they must choose their own PIN.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="team-pin" className="text-meta text-slate-700">
            Temporary PIN (4–6 digits)
          </label>
          <input
            id="team-pin"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="num h-10 w-40 rounded-control border border-slate-200 bg-white px-3 text-[18px] tracking-[0.3em] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !valid}
              onClick={() =>
                startTransition(async () => {
                  const r = await setTeamPinAction({ pin });
                  if (r.ok) {
                    toast.success(r.message);
                    setOpen(false);
                    setPin("");
                  } else toast.error(r.error);
                })
              }
            >
              Set PIN for everyone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

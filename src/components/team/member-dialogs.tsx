"use client";

import { useState, useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@/generated/prisma/enums";
import { Field, fieldA11y } from "@/components/common/field";
import { AVATAR_SWATCH, UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AVATAR_COLORS, ROLE_LABELS, ROLES, type AvatarColor } from "@/lib/domain/labels";
import { createMemberAction, resetPinAction, updateMemberAction } from "@/lib/server/actions/team";
import type { TeamRow } from "@/lib/server/queries/team";
import { cn } from "@/lib/utils";

type Errors = Record<string, string[] | undefined>;

export function MemberDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: TeamRow;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Remount on open so the form starts fresh each time. */}
        {open ? <MemberForm member={member} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function MemberForm({ member, onDone }: { member?: TeamRow; onDone: () => void }) {
  const editing = Boolean(member);
  const [name, setName] = useState(member?.name ?? "");
  const [role, setRole] = useState<Role | "">(member?.role ?? "");
  const [color, setColor] = useState<AvatarColor>((member?.avatarColor as AvatarColor) ?? "indigo");
  const [pin, setPin] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = member
        ? await updateMemberAction({ id: member.id, name, role, avatarColor: color })
        : await createMemberAction({ name, role, avatarColor: color, pin });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved");
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${member!.name}` : "Add a person"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Changes apply immediately. Role changes take effect on their next page load."
            : "They'll choose their own PIN the first time they sign in."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-3">
        <UserAvatar name={name || "?"} color={color} size="lg" />
        <Field id="member-name" label="Name" error={errors.name?.[0]} className="flex-1">
          <Input
            {...fieldA11y("member-name", errors.name?.[0])}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nusrat"
            autoComplete="off"
            autoFocus
          />
        </Field>
      </div>

      <Field id="member-role" label="Role" error={errors.role?.[0]}>
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger {...fieldA11y("member-role", errors.role?.[0])}>
            <SelectValue placeholder="Choose a role" />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-meta text-slate-700">Avatar colour</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar colour">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={cn(
                "flex size-7 items-center justify-center rounded-full ring-offset-2 transition-shadow",
                AVATAR_SWATCH[c],
                color === c ? "ring-2 ring-slate-900/70" : "hover:ring-2 hover:ring-slate-300",
              )}
            >
              {color === c ? <CheckIcon className="size-3.5 text-white" /> : null}
            </button>
          ))}
        </div>
      </fieldset>

      {!editing ? (
        <Field
          id="member-pin"
          label="Temporary PIN"
          hint="4–6 digits. Share it privately; they'll replace it at first sign-in."
          error={errors.pin?.[0]}
        >
          <Input
            {...fieldA11y("member-pin", errors.pin?.[0], true)}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="off"
            className="num tracking-[0.3em]"
            placeholder="••••"
          />
        </Field>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {editing ? "Save changes" : "Add person"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ResetPinDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamRow;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await resetPinAction({ id: member.id, pin });
      if (!r.ok) {
        setError(r.fieldErrors?.pin?.[0] ?? r.error);
        return;
      }
      toast.success(r.message ?? "PIN reset");
      setPin("");
      setError(undefined);
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setPin("");
          setError(undefined);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <form onSubmit={submit} className="grid gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>Reset PIN for {member.name}</DialogTitle>
            <DialogDescription>
              They&apos;ll be signed out everywhere, any lock is cleared, and they must choose a new PIN at next
              sign-in.
            </DialogDescription>
          </DialogHeader>
          <Field id="reset-pin" label="Temporary PIN" hint="4–6 digits" error={error}>
            <Input
              {...fieldA11y("reset-pin", error, true)}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              className="num tracking-[0.3em]"
              placeholder="••••"
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Reset PIN
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

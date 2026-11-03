"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CrownIcon, LockIcon, RotateCcwIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@/generated/prisma/enums";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROLE_LABELS, ROLES } from "@/lib/domain/labels";
import { CAPABILITIES, CAPABILITY_KEYS, defaultPermissions, type Capability } from "@/lib/domain/permissions";
import { setAccessAction } from "@/lib/server/actions/team";
import type { TeamRow } from "@/lib/server/queries/team";
import { cn } from "@/lib/utils";

/**
 * Everyone in rows, every permission in columns. The Master Admin ticks boxes
 * and saves each row. Admin access (or the Master Admin) means everything.
 */
type RestrictedBrand = { id: string; name: string; color: string };

export function RolesMatrix({ team, brands }: { team: TeamRow[]; brands: RestrictedBrand[] }) {
  const people = team.filter((p) => p.active);
  return (
    <div className="surface relative overflow-x-auto rounded-panel">
      <table className="w-full min-w-[72rem] border-separate border-spacing-0 text-left text-body">
        <thead>
          <tr className="text-meta text-slate-600">
            <th scope="col" className="sticky left-0 z-20 border-b border-slate-100 bg-white px-3 py-3 font-medium shadow-[1px_0_0_rgb(241_245_249)]">
              Person
            </th>
            <th scope="col" className="border-b border-slate-100 px-2 py-3 font-medium">
              Job role
            </th>
            <th scope="col" className="border-b border-slate-100 px-2 py-3 text-center font-medium">
              Admin access
            </th>
            {CAPABILITY_KEYS.map((k) => (
              <th key={k} scope="col" className="w-[5.5rem] border-b border-slate-100 px-1.5 py-3 text-center align-bottom font-medium">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block cursor-help leading-tight underline decoration-slate-300 decoration-dotted underline-offset-2">
                      {CAPABILITIES[k].label}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{CAPABILITIES[k].hint}</TooltipContent>
                </Tooltip>
              </th>
            ))}
            {brands.map((b) => (
              <th key={b.id} scope="col" className="w-[5.5rem] border-b border-l border-slate-100 bg-slate-50/70 px-1.5 py-3 text-center align-bottom font-medium">
                <span className="inline-flex flex-col items-center gap-1 leading-tight">
                  <LockIcon className="size-3.5 text-slate-500" aria-hidden />
                  See {b.name}
                </span>
              </th>
            ))}
            <th scope="col" className="border-b border-slate-100 px-3 py-3">
              <span className="sr-only">Save</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <Row key={p.id + p.role + p.adminAccess + p.permissions.join() + p.brandAccess.join()} person={p} brands={brands} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ person, brands }: { person: TeamRow; brands: RestrictedBrand[] }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(person.role);
  const [admin, setAdmin] = useState(person.adminAccess);
  const [perms, setPerms] = useState<Capability[]>(person.permissions as Capability[]);
  const [access, setAccess] = useState<string[]>(person.brandAccess);
  const [pending, startTransition] = useTransition();
  const fixed = person.isMaster;
  const everything = fixed || admin || role === "ADMIN";
  const dirty =
    role !== person.role ||
    admin !== person.adminAccess ||
    perms.slice().sort().join() !== [...person.permissions].sort().join() ||
    access.slice().sort().join() !== [...person.brandAccess].sort().join();

  function changeRole(r: Role) {
    setRole(r);
    if (r !== person.role) setPerms(defaultPermissions(r)); // new job → that job's defaults
  }

  function save() {
    startTransition(async () => {
      const r = await setAccessAction({ id: person.id, role, adminAccess: admin, permissions: perms, brandAccess: access });
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <tr className={cn("transition-colors hover:bg-slate-50/60 [&:hover>th]:bg-slate-50", dirty && "bg-amber-50/50 [&>th]:bg-amber-50")}>
      <th scope="row" className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2.5 font-normal whitespace-nowrap shadow-[1px_0_0_rgb(241_245_249)]">
        <span className="flex items-center gap-2.5">
          <UserAvatar name={person.name} color={person.avatarColor} imageId={person.avatarAssetId} size="sm" />
          <span className="font-medium text-slate-900">{person.name}</span>
          {fixed ? (
            <span className="inline-flex items-center gap-1 text-meta text-amber-800">
              <CrownIcon className="size-3.5" /> Master
            </span>
          ) : null}
        </span>
      </th>
      <td className="border-b border-slate-100 px-2 py-2.5">
        <Select value={role} onValueChange={(v) => changeRole(v as Role)} disabled={fixed || pending}>
          <SelectTrigger className="h-8 w-40 whitespace-nowrap" aria-label={`${person.name}'s job role`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="border-b border-slate-100 px-2 py-2.5 text-center">
        <Checkbox
          checked={everything}
          disabled={fixed || role === "ADMIN" || pending}
          onCheckedChange={(v) => setAdmin(v === true)}
          aria-label={`${person.name}: admin access (everything)`}
        />
      </td>
      {CAPABILITY_KEYS.map((k) => (
        <td key={k} className="border-b border-slate-100 px-1.5 py-2.5 text-center">
          <Checkbox
            checked={everything || perms.includes(k)}
            disabled={everything || pending}
            onCheckedChange={(v) => setPerms(v === true ? [...perms, k] : perms.filter((x) => x !== k))}
            aria-label={`${person.name}: ${CAPABILITIES[k].label}`}
          />
        </td>
      ))}
      {brands.map((b) => (
        <td key={b.id} className="border-b border-l border-slate-100 bg-slate-50/70 px-1.5 py-2.5 text-center">
          <Checkbox
            checked={fixed || access.includes(b.id)}
            disabled={fixed || pending}
            onCheckedChange={(v) => setAccess(v === true ? [...access, b.id] : access.filter((x) => x !== b.id))}
            aria-label={`${person.name}: can see ${b.name}`}
          />
        </td>
      ))}
      <td className="border-b border-slate-100 px-3 py-2.5">
        {fixed ? null : (
          <span className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              onClick={() => setPerms(defaultPermissions(role))}
              aria-label={`Reset ${person.name} to ${ROLE_LABELS[role]} defaults`}
              title={`Reset to ${ROLE_LABELS[role]} defaults`}
            >
              <RotateCcwIcon />
            </Button>
            <Button size="sm" disabled={!dirty || pending} onClick={save}>
              <SaveIcon /> Save
            </Button>
          </span>
        )}
      </td>
    </tr>
  );
}

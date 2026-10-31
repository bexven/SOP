"use client";

import Link from "next/link";
import { ChevronsUpDownIcon, KeyRoundIcon, LogOutIcon, RepeatIcon } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { RolePill } from "@/components/common/pill";
import { UserAvatar } from "@/components/common/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/server/actions/auth";

export function UserMenu({ user }: { user: { name: string; role: Role; avatarColor: string } }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-control p-1.5 text-left transition-colors hover:bg-white/60 data-[state=open]:bg-white/70">
        <UserAvatar name={user.name} color={user.avatarColor} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-medium text-slate-900">{user.name}</span>
          <span className="block truncate text-meta text-slate-600">Signed in</span>
        </span>
        <ChevronsUpDownIcon className="size-4 text-slate-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="truncate text-slate-900">{user.name}</span>
          <RolePill role={user.role} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/change-pin">
            <KeyRoundIcon /> Change PIN
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logoutAction()}>
          <RepeatIcon /> Switch user
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void logoutAction()}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

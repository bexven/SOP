"use client";

import Link from "next/link";
import { ChevronDownIcon, KeyRoundIcon, LogOutIcon, RepeatIcon, UserRoundIcon } from "lucide-react";
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

export function UserMenu({ user }: { user: { name: string; role: Role; avatarColor: string; avatarAssetId?: string | null } }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-control p-1 pr-1.5 text-left transition-colors outline-none hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-indigo-500/40 data-[state=open]:bg-white/70">
        <UserAvatar name={user.name} color={user.avatarColor} imageId={user.avatarAssetId} size="sm" />
        <span className="hidden max-w-[7rem] truncate text-body font-medium text-slate-900 xl:inline">{user.name}</span>
        <ChevronDownIcon className="hidden size-3.5 text-slate-500 sm:block" />
        <span className="sr-only">Account menu for {user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="truncate text-slate-900">{user.name}</span>
          <RolePill role={user.role} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRoundIcon /> My profile & photo
          </Link>
        </DropdownMenuItem>
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

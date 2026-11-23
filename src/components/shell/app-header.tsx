"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { Logo } from "@/components/common/logo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { NavItem, NavKey } from "@/lib/domain/nav";
import { cn } from "@/lib/utils";
import { NAV_ICONS } from "./nav-icons";
import { NotificationBell } from "./notification-bell";
import { SearchButton } from "./search-button";
import { isActive, navGroups, useNavPath } from "./sidebar";
import { UserMenu } from "./user-menu";

type ShellUser = { name: string; role: Role; avatarColor: string; avatarAssetId: string | null };

/** Slim header over every page: where you are (breadcrumb) on the left; search, alerts and you on the right. */
export function AppHeader({ items, user, canSettings }: { items: NavItem[]; user: ShellUser; canSettings: boolean }) {
  const pathname = useNavPath();
  const group = navGroups(items).find((g) => g.items.some((i) => isActive(pathname, i.href)));
  const item = group?.items.find((i) => isActive(pathname, i.href));
  const Icon = item ? NAV_ICONS[item.key] : null;
  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-white/95 px-3 sm:px-4 lg:px-6">
      <Link href="/dashboard" className="flex items-center rounded-control p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
        <Logo />
      </Link>
      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-body lg:flex">
        {group?.label && group.label !== item?.label ? (
          <>
            <span className="text-slate-500">{group.label}</span>
            <ChevronRightIcon className="size-3.5 text-slate-400" aria-hidden />
          </>
        ) : null}
        {item && Icon ? (
          <Link href={item.href} className="flex items-center gap-1.5 rounded-[6px] px-1 py-0.5 font-medium text-slate-900 hover:bg-hover">
            <Icon className="size-4 text-slate-500" aria-hidden />
            {item.label}
          </Link>
        ) : null}
        {item && pathname !== item.href && pathname.startsWith(`${item.href}/`) && !items.some((i) => i.href !== item.href && isActive(pathname, i.href)) ? (
          <>
            <ChevronRightIcon className="size-3.5 text-slate-400" aria-hidden />
            <span className="text-slate-600">{item.key === "products" ? "Product" : "Details"}</span>
          </>
        ) : null}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <span className="lg:hidden">
          <SearchButton />
        </span>
        <NotificationBell />
        <UserMenu user={user} canSettings={canSettings} />
      </div>
    </header>
  );
}

const TAB_KEYS: NavKey[] = ["dashboard", "creative", "tasks", "products"];

/** Phones: the most used pages as a bottom tab bar; everything else under More. */
export function MobileTabBar({ items, badges }: { items: NavItem[]; badges: Partial<Record<string, number>> }) {
  const pathname = useNavPath();
  const [open, setOpen] = useState(false);
  const tabs = TAB_KEYS.map((k) => items.find((i) => i.key === k)).filter((i): i is NavItem => Boolean(i));
  const rest = items.filter((i) => !TAB_KEYS.includes(i.key));
  const moreActive = rest.some((i) => isActive(pathname, i.href));
  const tabClass = (active: boolean) =>
    cn(
      "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-control py-1.5 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active ? "text-primary" : "text-slate-600",
    );
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-white/95 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden">
      <ul className="flex items-stretch">
        {tabs.map((item) => {
          const Icon = NAV_ICONS[item.key];
          const active = isActive(pathname, item.href);
          return (
            <li key={item.key} className="flex flex-1">
              <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                <Icon className="size-5" aria-hidden />
                <span className="truncate">{item.label}</span>
                {badges[item.key] ? (
                  <span className="num absolute top-0.5 left-1/2 ml-1.5 rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-white">{badges[item.key]}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
        {rest.length ? (
          <li className="flex flex-1">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger className={tabClass(moreActive)}>
                <MoreHorizontalIcon className="size-5" aria-hidden />
                More
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-[min(20rem,calc(100vw-1rem))] p-1.5">
                <ul className="grid gap-px">
                  {rest.map((item) => {
                    const Icon = NAV_ICONS[item.key];
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={cn("flex items-center gap-3 rounded-[6px] px-2.5 py-2", active ? "bg-accent text-accent-foreground" : "hover:bg-hover")}
                        >
                          <Icon className={cn("size-4", active ? "text-primary" : "text-slate-500")} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block text-body font-medium text-slate-900">{item.label}</span>
                            <span className="block text-meta font-normal text-slate-500">{item.hint}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </PopoverContent>
            </Popover>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeftIcon, ChevronsRightIcon, SearchIcon } from "lucide-react";
import { Logo } from "@/components/common/logo";
import type { NavItem } from "@/lib/domain/nav";
import { cn } from "@/lib/utils";
import { OPEN_PALETTE_EVENT } from "./command-palette";
import { NAV_ICONS } from "./nav-icons";
import { usePendingPath } from "./nav-progress";

export const SIDEBAR_COOKIE = "sop_sidebar";

export function isActive(pathname: string, href: string) {
  if (href === "/team") return pathname === "/team";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Sidebar sections, ClickUp style: Home on top, then Work, Products, Admin. */
export function navGroups(items: NavItem[]) {
  return [
    { label: null, items: items.filter((i) => i.key === "dashboard") },
    { label: "Work", items: items.filter((i) => i.section === "main" && i.key !== "dashboard") },
    { label: "Products", items: items.filter((i) => i.section === "products") },
    { label: "Admin", items: items.filter((i) => i.section === "admin") },
  ].filter((g) => g.items.length > 0);
}

/** The current path, or the one being opened (so the clicked item highlights straight away). */
export function useNavPath() {
  const pending = usePendingPath();
  const current = usePathname();
  return pending ?? current;
}

/**
 * Left sidebar (desktop): every page one click away, grouped like ClickUp's spaces.
 * Collapses to icons; the choice is kept in a cookie so the page renders the same way next time.
 */
export function Sidebar({ items, badges, collapsed: initial }: { items: NavItem[]; badges: Partial<Record<string, number>>; collapsed: boolean }) {
  const pathname = useNavPath();
  const [collapsed, setCollapsed] = useState(initial);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
    document.getElementById("app-frame")?.style.setProperty("--sidebar-w", next ? "64px" : "240px");
  };

  return (
    <aside
      aria-label="Sidebar"
      className="fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-[var(--sidebar-border)] bg-sidebar transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex"
      style={{ width: collapsed ? 64 : 240 }}
    >
      <div className={cn("flex h-12 shrink-0 items-center gap-2 px-3", collapsed && "justify-center px-0")}>
        <Link href="/dashboard" className="flex min-w-0 items-center rounded-control p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo withText={!collapsed} />
        </Link>
      </div>

      <div className={cn("px-3 pb-2", collapsed && "px-2")}>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-control border border-[var(--line)] bg-white px-2.5 text-meta font-normal text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700",
            collapsed && "justify-center px-0",
          )}
          aria-label="Search (⌘K)"
          title="Search (⌘K)"
        >
          <SearchIcon className="size-3.5 shrink-0" aria-hidden />
          {collapsed ? null : (
            <>
              <span className="flex-1 text-left">Search</span>
              <kbd className="rounded border border-[var(--line)] bg-sidebar px-1 text-[10px] text-slate-500">⌘K</kbd>
            </>
          )}
        </button>
      </div>

      <nav aria-label="Main" className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {navGroups(items).map((g) => (
          <div key={g.label ?? "home"} className="mt-1">
            {g.label && !collapsed ? <p className="px-2.5 pt-3 pb-1 text-[11px] font-semibold tracking-[0.04em] text-slate-500 uppercase">{g.label}</p> : null}
            {g.label && collapsed ? <div className="mx-3 my-2 border-t border-[var(--sidebar-border)]" aria-hidden /> : null}
            <ul className="grid gap-px">
              {g.items.map((item) => {
                const Icon = NAV_ICONS[item.key];
                const active = isActive(pathname, item.href);
                const badge = badges[item.key];
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? `${item.label} — ${item.hint}` : item.hint}
                      className={cn(
                        "group relative flex h-8 items-center gap-2.5 rounded-[6px] px-2.5 text-body transition-colors duration-100 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        collapsed && "justify-center px-0",
                        active ? "bg-accent font-medium text-accent-foreground" : "text-slate-700 hover:bg-slate-900/[0.05] hover:text-slate-900",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-slate-500 group-hover:text-slate-700")} aria-hidden />
                      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                      {badge ? (
                        <span
                          className={cn(
                            "num rounded-full bg-primary px-1.5 text-[11px] leading-[18px] font-semibold text-white",
                            collapsed && "absolute -top-0.5 right-1 px-1 text-[10px] leading-4",
                          )}
                          aria-label={`${badge} waiting`}
                        >
                          {badge > 99 ? "99+" : badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-[var(--sidebar-border)] p-2", collapsed && "flex justify-center")}>
        <button
          type="button"
          onClick={toggle}
          className={cn("flex h-8 w-full items-center gap-2 rounded-[6px] px-2.5 text-meta font-normal text-slate-500 hover:bg-slate-900/[0.05] hover:text-slate-800", collapsed && "w-8 justify-center px-0")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRightIcon className="size-4" /> : <ChevronsLeftIcon className="size-4" />}
          {collapsed ? null : "Collapse"}
        </button>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/domain/nav";
import { cn } from "@/lib/utils";
import { NAV_ICONS } from "./nav-icons";

export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const work = items.filter((i) => i.section === "work");
  const admin = items.filter((i) => i.section === "admin");

  const render = (list: NavItem[]) =>
    list.map((item) => {
      const Icon = NAV_ICONS[item.key];
      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
      return (
        <li key={item.key}>
          <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex h-9 items-center gap-2.5 rounded-control px-2.5 text-body transition-colors duration-150",
              active
                ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.06)] ring-1 ring-slate-900/[0.06]"
                : "text-slate-700 hover:bg-white/60 hover:text-slate-900",
            )}
          >
            <Icon
              className={cn(
                "size-4 transition-colors",
                active ? "text-indigo-600" : "text-slate-500 group-hover:text-slate-700",
              )}
            />
            <span className="font-medium">{item.label}</span>
          </Link>
        </li>
      );
    });

  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      <ul className="flex flex-col gap-0.5">{render(work)}</ul>
      {admin.length > 0 ? (
        <div>
          <p className="mb-1.5 px-2.5 text-meta text-slate-500">Admin</p>
          <ul className="flex flex-col gap-0.5">{render(admin)}</ul>
        </div>
      ) : null}
    </nav>
  );
}

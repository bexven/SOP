"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/settings", label: "General" },
  { href: "/settings/checklists", label: "Checklists" },
  { href: "/settings/brands", label: "Brands" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="mb-6 inline-flex rounded-control bg-slate-900/[0.04] p-1">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-[8px] px-3 py-1 text-body font-medium transition-colors",
              active ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.08)]" : "text-slate-600 hover:text-slate-900",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

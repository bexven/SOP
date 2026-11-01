"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/team", label: "People & PINs" },
  { href: "/team/roles", label: "Roles & permissions" },
];

export function TeamNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Team sections" className="mb-6 inline-flex rounded-control bg-slate-900/[0.04] p-1">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={pathname === l.href ? "page" : undefined}
          className={cn(
            "rounded-[8px] px-3 py-1.5 text-body font-medium transition-colors",
            pathname === l.href ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.08)]" : "text-slate-600 hover:text-slate-900",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

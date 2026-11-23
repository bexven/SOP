"use client";

import { usePathname } from "next/navigation";
import { ViewTabs } from "@/components/common/list-view";

const LINKS = [
  { href: "/team", label: "People & PINs" },
  { href: "/team/roles", label: "Roles & permissions" },
];

export function TeamNav() {
  const pathname = usePathname();
  return <ViewTabs label="Team sections" tabs={LINKS.map((l) => ({ key: l.href, label: l.label, href: l.href, current: pathname === l.href }))} />;
}

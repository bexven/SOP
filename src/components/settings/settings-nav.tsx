"use client";

import { usePathname } from "next/navigation";
import { ViewTabs } from "@/components/common/list-view";

const LINKS = [
  { href: "/settings", label: "General" },
  { href: "/settings/checklists", label: "Checklists" },
  { href: "/settings/brands", label: "Brands" },
  { href: "/settings/notifications", label: "Notifications" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return <ViewTabs label="Settings sections" tabs={LINKS.map((l) => ({ key: l.href, label: l.label, href: l.href, current: pathname === l.href }))} />;
}

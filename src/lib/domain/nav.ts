import type { Role } from "@/generated/prisma/enums";
import { can } from "./permissions";

export type NavKey = "queue" | "pipeline" | "products" | "overview" | "team" | "settings";

export type NavItem = { key: NavKey; label: string; href: string; section: "work" | "admin" };

const ALL: (NavItem & { visible: (role: Role) => boolean })[] = [
  { key: "queue", label: "My Queue", href: "/queue", section: "work", visible: () => true },
  { key: "pipeline", label: "Pipeline", href: "/pipeline", section: "work", visible: () => true },
  { key: "products", label: "Products", href: "/products", section: "work", visible: () => true },
  {
    key: "overview",
    label: "Overview",
    href: "/overview",
    section: "admin",
    visible: (r) => can(r, "overview.view"),
  },
  { key: "team", label: "Team", href: "/team", section: "admin", visible: (r) => can(r, "team.manage") },
  {
    key: "settings",
    label: "Settings",
    href: "/settings",
    section: "admin",
    visible: (r) => can(r, "settings.manage"),
  },
];

/** Sidebar items for a role. Cosmetic: every page re-checks on the server. */
export function navItemsFor(role: Role): NavItem[] {
  return ALL.filter((i) => i.visible(role)).map(({ key, label, href, section }) => ({ key, label, href, section }));
}

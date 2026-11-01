import type { Role } from "@/generated/prisma/enums";
import { can } from "./permissions";

export type NavKey = "dashboard" | "research" | "creative" | "pipeline" | "products" | "overview" | "team" | "settings";

export type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  /** Short help shown under the label in the menu. */
  hint: string;
  section: "main" | "admin";
};

const CREATIVE_ROLES: Role[] = ["IMAGE_DESIGNER", "VIDEO_EDITOR", "MEDIA_BUYER", "ADMIN"];

const ALL: (NavItem & { visible: (role: Role) => boolean })[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", hint: "What's waiting on you", section: "main", visible: () => true },
  {
    key: "research",
    label: "Research",
    href: "/research",
    hint: "Add and research products",
    section: "main",
    visible: (r) => can(r, "product.create"),
  },
  {
    key: "creative",
    label: "Creative",
    href: "/creative",
    hint: "Images and videos in progress",
    section: "main",
    visible: (r) => CREATIVE_ROLES.includes(r),
  },
  { key: "pipeline", label: "Pipeline", href: "/pipeline", hint: "Every product by stage", section: "main", visible: () => true },
  { key: "products", label: "Products", href: "/products", hint: "Search all products", section: "main", visible: () => true },
  { key: "overview", label: "Overview", href: "/overview", hint: "Workload and bottlenecks", section: "admin", visible: (r) => can(r, "overview.view") },
  { key: "team", label: "Team", href: "/team", hint: "People, roles and PINs", section: "admin", visible: (r) => can(r, "team.manage") },
  { key: "settings", label: "Settings", href: "/settings", hint: "Rates, SLAs and checklists", section: "admin", visible: (r) => can(r, "settings.manage") },
];

/** Menu items for a role. Cosmetic: every page re-checks on the server. */
export function navItemsFor(role: Role): NavItem[] {
  return ALL.filter((i) => i.visible(role)).map(({ key, label, href, hint, section }) => ({ key, label, href, hint, section }));
}

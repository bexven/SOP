import {
  InboxIcon,
  KanbanSquareIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  PackageIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import type { NavKey } from "@/lib/domain/nav";

export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  queue: InboxIcon,
  pipeline: KanbanSquareIcon,
  products: PackageIcon,
  overview: LayoutDashboardIcon,
  team: UsersIcon,
  settings: SettingsIcon,
};

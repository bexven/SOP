import {
  FlaskConicalIcon,
  ImagesIcon,
  KanbanSquareIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  PackageIcon,
  PieChartIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import type { NavKey } from "@/lib/domain/nav";

export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  research: FlaskConicalIcon,
  creative: ImagesIcon,
  pipeline: KanbanSquareIcon,
  products: PackageIcon,
  overview: PieChartIcon,
  team: UsersIcon,
  settings: SettingsIcon,
};

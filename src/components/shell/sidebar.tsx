import type { Role } from "@/generated/prisma/enums";
import { Logo } from "@/components/common/logo";
import type { NavItem } from "@/lib/domain/nav";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";

export function Sidebar({
  items,
  user,
}: {
  items: NavItem[];
  user: { name: string; role: Role; avatarColor: string };
}) {
  return (
    <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-60 flex-col rounded-[18px] p-3 lg:flex">
      <div className="px-2 pt-1.5 pb-5">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavLinks items={items} />
      </div>
      <div className="border-t border-slate-900/[0.06] pt-2">
        <UserMenu user={user} />
      </div>
    </aside>
  );
}

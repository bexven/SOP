import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { navItemsFor } from "@/lib/domain/nav";
import { can } from "@/lib/domain/permissions";
import { CommandPalette } from "@/components/shell/command-palette";
import { requireUser } from "@/lib/server/auth/current-user";
import { getQueueCount } from "@/lib/server/queries/queue";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = navItemsFor(user.role);
  const shellUser = { name: user.name, role: user.role, avatarColor: user.avatarColor };
  const canCreate = can(user.role, "product.create");
  const badges = { queue: await getQueueCount(user) };

  return (
    <div className="min-h-dvh lg:pl-[16.5rem]">
      <Sidebar items={items} user={shellUser} badges={badges} />
      <div className="flex min-h-dvh flex-col pb-6">
        <Topbar items={items} user={shellUser} canCreate={canCreate} badges={badges} />
        <main id="main" className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 pt-6 sm:px-6 lg:pt-8">
          {children}
        </main>
      </div>
      <CommandPalette items={items} canCreate={canCreate} />
    </div>
  );
}

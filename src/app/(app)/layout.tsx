import { CommandPalette } from "@/components/shell/command-palette";
import { TopNav } from "@/components/shell/top-nav";
import { navItemsFor } from "@/lib/domain/nav";
import { can } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/server/auth/current-user";
import { getQueueCount } from "@/lib/server/queries/queue";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = navItemsFor(user.role, { isMaster: user.isMaster });
  const shellUser = { name: user.name, role: user.jobRole, avatarColor: user.avatarColor, avatarAssetId: user.avatarAssetId };
  const badges = { dashboard: await getQueueCount(user) };

  return (
    <div className="flex min-h-dvh flex-col pb-8">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-white focus:px-3 focus:py-2 focus:shadow-lg">
        Skip to content
      </a>
      <TopNav items={items} user={shellUser} badges={badges} />
      <main id="main" className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 pt-6 sm:px-6 lg:pt-8">
        {children}
      </main>
      <CommandPalette items={items} canCreate={can(user.role, "product.create")} />
    </div>
  );
}

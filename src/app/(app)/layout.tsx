import { cookies } from "next/headers";
import { AppHeader, MobileTabBar } from "@/components/shell/app-header";
import { CommandPalette } from "@/components/shell/command-palette";
import { NavProgress } from "@/components/shell/nav-progress";
import { PushSync } from "@/components/shell/push-sync";
import { Sidebar, SIDEBAR_COOKIE } from "@/components/shell/sidebar";
import { TopNav } from "@/components/shell/top-nav";
import { navItemsFor } from "@/lib/domain/nav";
import { can } from "@/lib/domain/permissions";
import { canAddProduct } from "@/lib/domain/resources";
import { requireUser } from "@/lib/server/auth/current-user";
import { getQueueCount } from "@/lib/server/queries/queue";
import { vapidKeys } from "@/lib/server/services/alerts";

/**
 * "sidebar" = ClickUp-style left sidebar + slim header + phone tab bar (Nov 2026 redesign).
 * "top" = the earlier top menu bar. Switch back by changing this one value.
 */
const NAV_LAYOUT: "sidebar" | "top" = "sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = navItemsFor(user, { isMaster: user.isMaster });
  const shellUser = { name: user.name, role: user.jobRole, avatarColor: user.avatarColor, avatarAssetId: user.avatarAssetId };
  const [queueCount, vapidPublicKey] = await Promise.all([
    getQueueCount(user),
    vapidKeys().then((k) => k.publicKey).catch(() => null),
  ]);
  const badges = { dashboard: queueCount };

  const skip = (
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-white focus:px-3 focus:py-2 focus:shadow-lg">
      Skip to content
    </a>
  );

  if (NAV_LAYOUT === "top") {
    return (
      <div className="flex min-h-dvh flex-col pb-8">
        <NavProgress />
        {skip}
        <TopNav items={items} user={shellUser} badges={badges} canSettings={can(user, "settings.manage")} />
        <main id="main" className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 pt-6 sm:px-6 lg:pt-8">
          {children}
        </main>
        <CommandPalette items={items} canCreate={canAddProduct(user)} />
        <PushSync vapidPublicKey={vapidPublicKey} />
      </div>
    );
  }

  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  return (
    <div id="app-frame" className="min-h-dvh lg:pl-[var(--sidebar-w)]" style={{ "--sidebar-w": collapsed ? "64px" : "240px" } as React.CSSProperties}>
      <NavProgress />
      {skip}
      <Sidebar items={items} badges={badges} collapsed={collapsed} />
      <div className="flex min-h-dvh min-w-0 flex-col transition-[padding] duration-200">
        <AppHeader items={items} user={shellUser} canSettings={can(user, "settings.manage")} />
        <main id="main" className="mx-auto w-full max-w-[1480px] min-w-0 flex-1 px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:pt-6 lg:pb-10">
          {children}
        </main>
      </div>
      <MobileTabBar items={items} badges={badges} />
      <CommandPalette items={items} canCreate={canAddProduct(user)} />
      <PushSync vapidPublicKey={vapidPublicKey} />
    </div>
  );
}

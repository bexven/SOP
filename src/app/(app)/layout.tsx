import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { navItemsFor } from "@/lib/domain/nav";
import { requireUser } from "@/lib/server/auth/current-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = navItemsFor(user.role);
  const shellUser = { name: user.name, role: user.role, avatarColor: user.avatarColor };

  return (
    <div className="min-h-dvh lg:pl-[16.5rem]">
      <Sidebar items={items} user={shellUser} />
      <div className="flex min-h-dvh flex-col pb-6">
        <Topbar items={items} user={shellUser} />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 sm:px-6 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}

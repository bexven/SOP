"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ChevronRightIcon, MenuIcon, XIcon } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { Logo } from "@/components/common/logo";
import type { NavItem } from "@/lib/domain/nav";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";

function useBreadcrumbs(items: NavItem[]) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const root = items.find((i) => i.href === `/${segments[0] ?? ""}`);
  const crumbs: string[] = [];
  if (root) crumbs.push(root.label);
  for (const seg of segments.slice(1)) crumbs.push(seg.charAt(0).toUpperCase() + seg.slice(1));
  return crumbs;
}

export function Topbar({ items, user }: { items: NavItem[]; user: { name: string; role: Role; avatarColor: string } }) {
  const crumbs = useBreadcrumbs(items);
  const [open, setOpen] = useState(false);

  return (
    <header className="glass sticky top-3 z-20 mx-3 flex h-14 items-center gap-3 rounded-[16px] px-3 sm:px-4">
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Trigger
          className="-ml-1 inline-flex size-9 items-center justify-center rounded-control text-slate-700 hover:bg-white/70 lg:hidden"
          aria-label="Open navigation"
        >
          <MenuIcon className="size-5" />
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-900/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 lg:hidden" />
          <DialogPrimitive.Content className="glass-strong fixed inset-y-3 left-3 z-50 flex w-[min(18rem,calc(100vw-1.5rem))] flex-col rounded-[18px] p-3 duration-200 data-[state=open]:animate-in data-[state=open]:slide-in-from-left-4 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-left-4 lg:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <div className="flex items-center justify-between px-2 pt-1.5 pb-5">
              <Logo />
              <DialogPrimitive.Close className="rounded-md p-1 text-slate-600 hover:bg-slate-900/5" aria-label="Close navigation">
                <XIcon className="size-4" />
              </DialogPrimitive.Close>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks items={items} onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-slate-900/[0.06] pt-2">
              <UserMenu user={user} />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-body">
          {crumbs.map((c, i) => (
            <li key={`${c}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 ? <ChevronRightIcon className="size-3.5 shrink-0 text-slate-400" /> : null}
              <span
                className={i === crumbs.length - 1 ? "truncate font-medium text-slate-900" : "truncate text-slate-600"}
                aria-current={i === crumbs.length - 1 ? "page" : undefined}
              >
                {c}
              </span>
            </li>
          ))}
        </ol>
      </nav>
    </header>
  );
}

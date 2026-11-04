"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BellIcon, CheckCheckIcon, SmartphoneIcon } from "lucide-react";
import { UserAvatar } from "@/components/common/user-avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatRelative } from "@/lib/format";
import { fetchNotificationsAction, markNotificationsReadAction, type NotificationDTO } from "@/lib/server/actions/notifications";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const load = useCallback(async () => {
    const r = await fetchNotificationsAction({});
    if (r.ok && r.data) {
      setItems(r.data.items);
      setUnread((prev) => {
        // New activity elsewhere: refresh server data so lists stay current.
        if (r.data!.unread > prev && prev !== 0) router.refresh();
        return r.data!.unread;
      });
    }
  }, [router]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(load, POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  function openItem(n: NotificationDTO) {
    setOpen(false);
    if (!n.read) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      startTransition(async () => {
        await markNotificationsReadAction({ ids: [n.id] });
      });
    }
    if (n.link) router.push(n.link);
    else if (n.productId) router.push(`/products/${n.productId}`);
  }

  function markAll() {
    setItems((list) => list.map((x) => ({ ...x, read: true })));
    setUnread(0);
    startTransition(async () => {
      await markNotificationsReadAction({ all: true });
    });
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) void load(); }}>
      <PopoverTrigger
        className="relative inline-flex size-9 items-center justify-center rounded-control text-slate-700 transition-colors hover:bg-white/70"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <BellIcon className="size-[18px]" />
        {unread ? (
          <span className="num absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b border-slate-900/[0.06] px-4 py-2.5">
          <h2 className="text-section text-slate-900">Notifications</h2>
          {unread ? (
            <button type="button" onClick={markAll} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-meta text-indigo-700 hover:bg-indigo-50">
              <CheckCheckIcon className="size-3.5" /> Mark all read
            </button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <BellIcon className="mx-auto mb-2 size-5 text-slate-400" />
            <p className="text-body font-medium text-slate-800">No notifications yet</p>
            <p className="mt-0.5 text-meta font-normal text-slate-500">Assignments, reviews and mentions show up here.</p>
          </div>
        ) : (
          <ul className="max-h-[min(28rem,70vh)] divide-y divide-slate-900/[0.05] overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openItem(n)}
                  className={cn("flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-white/70", !n.read && "bg-indigo-50/50")}
                >
                  {n.actor ? <UserAvatar name={n.actor.name} color={n.actor.avatarColor} imageId={n.actor.avatarAssetId} size="sm" /> : <span className="size-7 shrink-0 rounded-full bg-slate-200" />}
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-body [overflow-wrap:anywhere]", n.read ? "text-slate-600" : "font-medium text-slate-900")}>{n.message}</span>
                    <span className="num text-meta font-normal text-slate-500" suppressHydrationWarning>
                      {formatRelative(new Date(n.createdAt))}
                    </span>
                  </span>
                  {!n.read ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-indigo-500" aria-label="Unread" /> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/profile#alerts"
          onClick={() => setOpen(false)}
          className="flex items-center justify-center gap-1.5 border-t border-slate-900/[0.06] px-4 py-2.5 text-meta text-indigo-700 transition-colors hover:bg-white/70"
        >
          <SmartphoneIcon className="size-3.5" /> Get alerts on your phone &amp; Telegram
        </Link>
      </PopoverContent>
    </Popover>
  );
}

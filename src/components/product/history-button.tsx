"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { HistoryIcon, XIcon } from "lucide-react";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatRelative } from "@/lib/format";
import { productHistoryAction } from "@/lib/server/actions/history";

type Entry = { id: string; at: string; text: string; actor: { name: string; avatarColor: string; avatarAssetId: string | null } };

const dayLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

/** "History" side panel: every change on the product — who did what, and when (ClickUp-style activity). */
export function HistoryButton({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const r = await productHistoryAction({ productId });
    if (r.ok && r.data) setEntries(r.data);
    else if (!r.ok) setError(r.error);
  }

  const days: { day: string; items: Entry[] }[] = [];
  for (const e of entries ?? []) {
    const day = dayLabel(e.at);
    const last = days.at(-1);
    if (last?.day === day) last.items.push(e);
    else days.push({ day, items: [e] });
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void load();
      }}
    >
      <DialogPrimitive.Trigger asChild>
        <Button variant="outline" size="sm">
          <HistoryIcon /> History
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/20 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="glass-strong fixed inset-y-0 right-0 z-50 flex w-[min(28rem,100vw)] flex-col rounded-none border-y-0 border-r-0 outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right-8 data-[state=open]:duration-200 motion-reduce:animate-none"
        >
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
            <DialogPrimitive.Title className="text-section text-slate-900">History</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close history">
                <XIcon />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {error ? <p className="text-body text-rose-700">{error}</p> : null}
            {entries === null && !error ? (
              <div className="grid gap-3" aria-hidden>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex gap-2.5">
                    <Skeleton className="size-6 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : null}
            {entries && entries.length === 0 ? <p className="text-body text-slate-600">Nothing has happened on this product yet. Every change will be listed here.</p> : null}
            {days.map((d) => (
              <section key={d.day} className="mb-5">
                <h3 className="mb-2 text-[11px] font-semibold tracking-[0.04em] text-slate-500 uppercase">{d.day}</h3>
                <ol className="grid gap-3 border-l border-[var(--line)] pl-4">
                  {d.items.map((e) => (
                    <li key={e.id} className="relative flex gap-2.5">
                      <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-slate-300 ring-2 ring-white" aria-hidden />
                      <UserAvatar name={e.actor.name} color={e.actor.avatarColor} imageId={e.actor.avatarAssetId} size="xs" />
                      <p className="min-w-0 flex-1 text-body text-slate-700">
                        <span className="font-medium text-slate-900">{e.actor.name}</span> {e.text}
                        <time dateTime={e.at} title={formatDateTime(new Date(e.at))} className="ml-1.5 text-meta font-normal whitespace-nowrap text-slate-500">
                          {formatRelative(new Date(e.at))}
                        </time>
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

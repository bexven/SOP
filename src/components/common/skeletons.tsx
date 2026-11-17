import { Skeleton } from "@/components/ui/skeleton";

function Header() {
  return (
    <div className="mb-6 grid gap-2" aria-hidden>
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  );
}

function Status() {
  return <span className="sr-only" role="status">Loading…</span>;
}

export function ListSkeleton({ groups = 2, rows = 3 }: { groups?: number; rows?: number }) {
  return (
    <div data-skeleton>
      <Status />
      <Header />
      <div className="grid gap-6" aria-hidden>
        {Array.from({ length: groups }).map((_, g) => (
          <div key={g}>
            <Skeleton className="mb-2 h-5 w-32" />
            <div className="surface divide-y divide-slate-100 rounded-panel">
              {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-10 rounded-[10px]" />
                  <div className="grid flex-1 gap-1.5">
                    <Skeleton className="h-4 w-48 max-w-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="hidden h-5 w-20 rounded-full md:block" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div data-skeleton>
      <Status />
      <Header />
      <div className="grid auto-cols-[minmax(15.5rem,1fr)] grid-flow-col gap-3 overflow-hidden" aria-hidden>
        {[3, 2, 1, 2, 1, 1].map((n, i) => (
          <div key={i} className="rounded-panel bg-slate-900/[0.025] p-2">
            <Skeleton className="mx-1.5 mt-1 mb-3 h-4 w-24" />
            <div className="grid gap-2">
              {Array.from({ length: n }).map((_, j) => (
                <div key={j} className="surface grid gap-3 rounded-panel p-3">
                  <div className="flex gap-2.5">
                    <Skeleton className="size-9 rounded-[10px]" />
                    <div className="grid flex-1 gap-1.5">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-1 w-28" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div data-skeleton>
      <Status />
      <Header />
      <Skeleton className="mb-3 h-9 w-full" aria-hidden />
      <div className="surface rounded-panel" aria-hidden>
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          <Skeleton className="h-3 w-2/3" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-0">
            <Skeleton className="size-9 rounded-[10px]" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-5 w-20 rounded-full" />
            <Skeleton className="hidden h-1 w-24 sm:block" />
            <Skeleton className="hidden h-5 w-14 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shaped like the product page: back link, header, stepper, phase tabs, then the panel. */
export function DetailSkeleton() {
  return (
    <div data-skeleton className="grid gap-5">
      <Status />
      <div className="grid gap-5" aria-hidden>
        <Skeleton className="h-4 w-16" />
        <div className="flex items-start gap-4">
          <Skeleton className="size-16 rounded-[12px]" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-72 max-w-full" />
            <div className="flex gap-1.5">
              {[16, 12, 16, 18].map((w, i) => (
                <Skeleton key={i} className="h-5 rounded-full" style={{ width: `${w * 4}px` }} />
              ))}
            </div>
          </div>
        </div>
        <div className="surface flex items-center justify-between gap-2 rounded-panel px-5 py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-1 items-center gap-2 last:flex-none">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              {i < 5 ? <Skeleton className="h-0.5 flex-1" /> : null}
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          {[28, 26, 26, 20, 18].map((w, i) => (
            <Skeleton key={i} className="h-9 rounded-control" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
        <div className="surface grid gap-3 rounded-panel p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 rounded-panel" />
            <Skeleton className="h-20 rounded-panel" />
            <Skeleton className="h-20 rounded-panel" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Four stat tiles, a filter row and a table (Shipments, Ad budget, Orders). */
export function TilesTableSkeleton() {
  return (
    <div data-skeleton>
      <Status />
      <Header />
      <div className="grid gap-5" aria-hidden>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface grid gap-3 rounded-panel p-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {[14, 22, 30, 18].map((w, i) => (
            <Skeleton key={i} className="h-8 rounded-full" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
        <div className="surface rounded-panel">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-4 py-3.5 last:border-0">
              <Skeleton className="size-10 rounded-[10px]" />
              <div className="grid flex-1 gap-1.5">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="hidden h-4 w-20 sm:block" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CardsSkeleton() {
  return (
    <div data-skeleton>
      <Status />
      <Header />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-panel" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-panel" />
        ))}
      </div>
    </div>
  );
}

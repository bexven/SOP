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
    <>
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
    </>
  );
}

export function KanbanSkeleton() {
  return (
    <>
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
    </>
  );
}

export function TableSkeleton() {
  return (
    <>
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
    </>
  );
}

export function DetailSkeleton() {
  return (
    <div className="grid gap-5" aria-hidden>
      <Status />
      <div className="flex items-start gap-4">
        <Skeleton className="size-16 rounded-[12px]" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-72 max-w-full" />
          <Skeleton className="h-5 w-52" />
        </div>
      </div>
      <Skeleton className="h-20 w-full rounded-panel" />
      <Skeleton className="h-9 w-72 rounded-control" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 rounded-panel" />
        <Skeleton className="h-56 rounded-panel" />
      </div>
    </div>
  );
}

export function CardsSkeleton() {
  return (
    <>
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
    </>
  );
}

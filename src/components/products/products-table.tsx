"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, SearchIcon, SearchXIcon } from "lucide-react";
import type { Priority, ProductStage } from "@/generated/prisma/enums";
import { EmptyState } from "@/components/common/empty-state";
import { DuePill, MarginBadge, PriorityPill, StagePill } from "@/components/common/pills";
import { MiniStepper } from "@/components/common/stepper";
import { Thumbnail } from "@/components/common/thumbnail";
import { UserAvatar } from "@/components/common/user-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KILL_REASON_LABELS, PRIORITIES, PRIORITY_LABELS, PRIORITY_RANK, STAGE_LABELS, STAGES } from "@/lib/domain/labels";
import { formatRelative } from "@/lib/format";
import type { ProductRow } from "@/lib/server/queries/products";
import { cn } from "@/lib/utils";

const STAGE_ORDER: Record<ProductStage, number> = { RESEARCH: 0, CREATIVE: 1, READY_TO_LAUNCH: 2, LIVE: 3, COMPLETED: 4, KILLED: 5 };

export function ProductsTable({
  rows,
  people,
  initialStage,
}: {
  rows: ProductRow[];
  people: { id: string; name: string; avatarColor: string }[];
  initialStage?: ProductStage;
}) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<ProductStage | "ALL">(initialStage ?? "ALL");
  const [priority, setPriority] = useState<Priority | "ALL">("ALL");
  const [assignee, setAssignee] = useState<string>("ALL");
  const [overdue, setOverdue] = useState(false);
  const [showKilled, setShowKilled] = useState(initialStage === "KILLED");
  const [sorting, setSorting] = useState<SortingState>([]);

  const data = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (stage !== "ALL" && r.stage !== stage) return false;
      if (stage === "ALL" && !showKilled && r.stage === "KILLED") return false;
      if (priority !== "ALL" && r.priority !== priority) return false;
      if (assignee !== "ALL" && !r.assignees.some((a) => a.id === assignee)) return false;
      if (overdue && !r.overdue) return false;
      if (needle && !r.name.toLowerCase().includes(needle) && !r.ref.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, q, stage, priority, assignee, overdue, showKilled]);

  const columns = useMemo<ColumnDef<ProductRow>[]>(
    () => [
      {
        id: "product",
        header: "Product",
        accessorFn: (r) => r.name.toLowerCase(),
        cell: ({ row: { original: r } }) => (
          <Link href={`?product=${r.id}`} scroll={false} className="flex min-w-0 items-center gap-3 outline-none after:absolute after:inset-0 focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-indigo-500/40">
            <Thumbnail src={r.imageUrl} alt="" className="size-9" />
            <span className="min-w-0">
              <span className="block max-w-[18rem] truncate font-medium text-slate-900">{r.name}</span>
              <span className="num text-meta text-slate-500">{r.ref}</span>
            </span>
          </Link>
        ),
      },
      {
        id: "stage",
        header: "Stage",
        accessorFn: (r) => STAGE_ORDER[r.stage],
        cell: ({ row: { original: r } }) => (
          <span className="flex flex-col items-start gap-1">
            <StagePill stage={r.stage} />
            {r.stage === "KILLED" && r.killReason ? <span className="text-meta text-rose-700">{KILL_REASON_LABELS[r.killReason]}</span> : null}
          </span>
        ),
      },
      { id: "progress", header: "Progress", enableSorting: false, cell: ({ row: { original: r } }) => <MiniStepper stepper={r.stepper} /> },
      { id: "priority", header: "Priority", accessorFn: (r) => PRIORITY_RANK[r.priority], cell: ({ row: { original: r } }) => <PriorityPill priority={r.priority} /> },
      {
        id: "margin",
        header: "Margin",
        accessorFn: (r) => (r.marginPct === null ? -Infinity : Number(r.marginPct)),
        cell: ({ row: { original: r } }) => (r.marginPct ? <MarginBadge pct={r.marginPct} band={r.marginBand} /> : <span className="text-slate-400">—</span>),
      },
      {
        id: "people",
        header: "Working on it",
        enableSorting: false,
        cell: ({ row: { original: r } }) =>
          r.assignees.length ? (
            <span className="flex -space-x-1.5">
              {r.assignees.slice(0, 4).map((a) => (
                <UserAvatar key={a.id} name={a.name} color={a.avatarColor} size="xs" className="ring-2 ring-white" />
              ))}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          ),
      },
      {
        id: "due",
        header: "Next due",
        accessorFn: (r) => r.nextDueAt ?? "9999",
        cell: ({ row: { original: r } }) => (r.nextDueAt ? <DuePill dueAt={r.nextDueAt} /> : <span className="text-slate-400">—</span>),
      },
      {
        id: "updated",
        header: "Updated",
        accessorFn: (r) => r.updatedAt,
        sortDescFirst: true,
        cell: ({ row: { original: r } }) => (
          <span className="num text-meta whitespace-nowrap text-slate-500" suppressHydrationWarning>
            {formatRelative(new Date(r.updatedAt))}
          </span>
        ),
      },
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 manages its own memoisation
  const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  const filtersActive = q || stage !== "ALL" || priority !== "ALL" || assignee !== "ALL" || overdue;

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or PRD-…" className="pl-9" aria-label="Search products" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <FilterSelect label="Stage" value={stage} onChange={(v) => setStage(v as ProductStage | "ALL")} options={[["ALL", "All stages"], ...STAGES.map((s) => [s, STAGE_LABELS[s]] as [string, string])]} />
          <FilterSelect label="Priority" value={priority} onChange={(v) => setPriority(v as Priority | "ALL")} options={[["ALL", "Any priority"], ...PRIORITIES.map((p) => [p, PRIORITY_LABELS[p]] as [string, string])]} />
          <FilterSelect label="Assignee" value={assignee} onChange={setAssignee} options={[["ALL", "Anyone"], ...people.map((p) => [p.id, p.name] as [string, string])]} />
          <label className="flex h-9 items-center gap-2 rounded-control border border-slate-200 bg-white px-3 text-body text-slate-700">
            <Checkbox checked={overdue} onCheckedChange={(v) => setOverdue(v === true)} /> Overdue
          </label>
          <label className={cn("flex h-9 items-center gap-2 rounded-control border border-slate-200 bg-white px-3 text-body text-slate-700", stage !== "ALL" && "opacity-50")}>
            <Checkbox checked={showKilled || stage === "KILLED"} disabled={stage !== "ALL"} onCheckedChange={(v) => setShowKilled(v === true)} /> Killed
          </label>
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={SearchXIcon}
          title="No products match"
          description={filtersActive ? "Try clearing a filter or searching for something else." : "Killed products are hidden — tick “Killed” to include them."}
        />
      ) : (
        <div className="surface relative overflow-x-auto rounded-panel">
          <table className="w-full min-w-[56rem] text-left text-body">
            <thead className="border-b border-slate-100 bg-slate-50/60">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => {
                    const sorted = h.column.getIsSorted();
                    return (
                      <th key={h.id} scope="col" className="px-4 py-2.5 text-meta whitespace-nowrap text-slate-600" aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}>
                        {h.column.getCanSort() ? (
                          <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 hover:text-slate-900">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {sorted === "asc" ? <ArrowUpIcon className="size-3" /> : sorted === "desc" ? <ArrowDownIcon className="size-3" /> : <ChevronsUpDownIcon className="size-3 text-slate-400" />}
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="relative transition-colors hover:bg-slate-50/70">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-4 py-2 text-meta font-normal text-slate-500">
            <span className="num">{data.length}</span> of <span className="num">{rows.length}</span> products
          </p>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="sm:w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

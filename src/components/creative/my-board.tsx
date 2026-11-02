import type { CreativeRow } from "@/lib/server/queries/creative";
import { cn } from "@/lib/utils";
import { CreativeCard } from "./creative-card";

type Col = "todo" | "revision" | "review";
const COLS: { key: Col; title: string; hint: string; dot: string }[] = [
  { key: "todo", title: "To do", hint: "Open a card, tick ready and add the links", dot: "bg-slate-400" },
  { key: "revision", title: "Needs changes", hint: "Open it to see what to fix", dot: "bg-rose-500" },
  { key: "review", title: "In review", hint: "Waiting for a Senior", dot: "bg-indigo-500" },
];

function colOf(r: CreativeRow): Col | null {
  if (r.status === "TODO") return "todo";
  if (r.status === "REVISION") return "revision";
  if (r.status === "SUBMITTED") return "review";
  return null;
}

/** The maker's own open tasks by status. Click a card to open it on its product. */
export function MyBoard({ rows }: { rows: CreativeRow[] }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3">
      {COLS.map((c) => {
        const items = rows.filter((r) => colOf(r) === c.key);
        return (
          <div key={c.key} className="rounded-panel bg-slate-900/[0.025] p-2">
            <h3 className="flex items-center gap-2 px-1.5 pt-1 text-body font-semibold text-slate-800">
              <span className={cn("size-2 rounded-full", c.dot)} aria-hidden />
              {c.title} <span className="num ml-auto text-meta text-slate-500">{items.length}</span>
            </h3>
            <p className="px-1.5 pb-2.5 text-meta font-normal text-slate-500">{c.hint}</p>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
              {items.map((r) => (
                <li key={r.id}>
                  <CreativeCard t={r} />
                </li>
              ))}
            </ul>
            {items.length === 0 ? <p className="px-2 py-5 text-center text-meta font-normal text-slate-500">Nothing here</p> : null}
          </div>
        );
      })}
    </div>
  );
}

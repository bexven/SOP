import type { Metadata } from "next";
import { FilmIcon, ImageIcon, ImagesIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { CreativeCard } from "@/components/creative/creative-card";
import { MyBoard } from "@/components/creative/my-board";
import { requireUser } from "@/lib/server/auth/current-user";
import { getCreativeBoard, type CreativeRow } from "@/lib/server/queries/creative";

export const metadata: Metadata = { title: "Creative" };

const COLUMNS: { key: string; title: string; match: (r: CreativeRow) => boolean; empty: string }[] = [
  { key: "todo", title: "To do", match: (r) => r.status === "TODO", empty: "Nothing to start" },
  { key: "review", title: "In review", match: (r) => r.status === "SUBMITTED", empty: "Nothing waiting for review" },
  { key: "revision", title: "Needs changes", match: (r) => r.status === "REVISION", empty: "No changes requested" },
];

export default async function CreativePage() {
  const user = await requireUser();
  const [mine, team] = await Promise.all([getCreativeBoard(user, "mine"), getCreativeBoard(user, "all")]);
  const { lanes, rows } = team;
  const myRows = mine.rows.filter((r) => r.status !== "LOCKED");
  const lockedMine = mine.rows.length - myRows.length;

  return (
    <>
      <PageHeader
        title="Creative"
        description={
          "Your own creative tasks first — drag a card to “In review” when it's in the Drive folder, or click it to open the product. The whole team's work is below."
        }
      />
      <section aria-labelledby="my-tasks" className="mb-10">
        <h2 id="my-tasks" className="mb-3 text-section text-slate-900">
          My tasks <span className="num text-meta text-slate-500">{myRows.length}</span>
          {lockedMine ? <span className="ml-2 text-meta font-normal text-slate-500">· {lockedMine} more unlock after step 1 is approved</span> : null}
        </h2>
        {myRows.length ? (
          <MyBoard rows={myRows} />
        ) : (
          <p className="surface rounded-panel px-4 py-6 text-center text-body text-slate-600">No creative tasks assigned to you right now.</p>
        )}
      </section>

      <h2 className="mb-3 text-section text-slate-900">Whole team</h2>
      {rows.filter((r) => r.status !== "LOCKED").length === 0 ? (
        <EmptyState
          icon={ImagesIcon}
          title="No creative work in progress"
          description="Creative tasks appear here as soon as a product's research is submitted."
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
          {lanes.map((lane) => {
            const laneRows = rows.filter((r) => r.lane === lane);
            const waiting = laneRows.filter((r) => r.status === "LOCKED").length;
            const Icon = lane === "images" ? ImageIcon : FilmIcon;
            return (
              <section key={lane} aria-labelledby={`lane-${lane}`}>
                <h3 id={`lane-${lane}`} className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-section text-slate-900">
                  <Icon className="size-4 text-slate-500" /> {lane === "images" ? "Images" : "Videos"}
                  {waiting ? (
                    <span className="text-meta font-normal text-slate-500">
                      · {waiting} more waiting for step 1 to be approved
                    </span>
                  ) : null}
                </h3>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3">
                  {COLUMNS.map((col) => {
                    const items = laneRows.filter(col.match);
                    return (
                      <div key={col.key} className="rounded-panel bg-slate-900/[0.025] p-2">
                        <h4 className="flex items-center justify-between px-1.5 pt-1 pb-2.5 text-body font-semibold text-slate-800">
                          {col.title} <span className="num text-meta text-slate-500">{items.length}</span>
                        </h4>
                        {items.length ? (
                          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
                            {items.map((t) => (
                              <li key={t.id}>
                                <CreativeCard t={t} />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="px-2 py-5 text-center text-meta font-normal text-slate-500">{col.empty}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

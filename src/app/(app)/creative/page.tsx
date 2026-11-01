import type { Metadata } from "next";
import Link from "next/link";
import { FilmIcon, ImageIcon, ImagesIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { CreativeCard } from "@/components/creative/creative-card";
import { requireUser } from "@/lib/server/auth/current-user";
import { getCreativeBoard, type CreativeRow } from "@/lib/server/queries/creative";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Creative" };

const COLUMNS: { key: string; title: string; match: (r: CreativeRow) => boolean; empty: string }[] = [
  { key: "todo", title: "To do", match: (r) => r.status === "TODO", empty: "Nothing to start" },
  { key: "review", title: "In review", match: (r) => r.status === "SUBMITTED", empty: "Nothing waiting for review" },
  { key: "revision", title: "Needs changes", match: (r) => r.status === "REVISION", empty: "No changes requested" },
];

export default async function CreativePage({ searchParams }: PageProps<"/creative">) {
  const user = await requireUser();
  if (!["IMAGE_DESIGNER", "VIDEO_EDITOR", "MEDIA_BUYER", "ADMIN"].includes(user.role)) redirect("/dashboard");
  const sp = await searchParams;
  const maker = user.role === "IMAGE_DESIGNER" || user.role === "VIDEO_EDITOR";
  const scope = sp.scope === "all" || (!maker && sp.scope !== "mine") ? "all" : "mine";
  const { lanes, rows } = await getCreativeBoard(user, scope);

  return (
    <>
      <PageHeader
        title="Creative"
        description={
          user.role === "IMAGE_DESIGNER"
            ? "Your image work across all products. Open a card to upload images."
            : user.role === "VIDEO_EDITOR"
              ? "Your video work across all products. Open a card to add your video links."
              : "All image and video work in progress. Open a card to review."
        }
        actions={
          <nav aria-label="Show" className="inline-flex rounded-control bg-slate-900/[0.04] p-1">
            {(["mine", "all"] as const).map((s) => (
              <Link
                key={s}
                href={`/creative?scope=${s}`}
                aria-current={scope === s ? "page" : undefined}
                className={cn("rounded-[8px] px-3 py-1 text-body font-medium", scope === s ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.08)]" : "text-slate-600 hover:text-slate-900")}
              >
                {s === "mine" ? "Assigned to me" : "Everyone"}
              </Link>
            ))}
          </nav>
        }
      />
      {rows.filter((r) => r.status !== "LOCKED").length === 0 ? (
        <EmptyState
          icon={ImagesIcon}
          title={scope === "mine" ? "No creative work for you right now" : "No creative work in progress"}
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
                <h2 id={`lane-${lane}`} className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-section text-slate-900">
                  <Icon className="size-4 text-slate-500" /> {lane === "images" ? "Images" : "Videos"}
                  {waiting ? (
                    <span className="text-meta font-normal text-slate-500">
                      · {waiting} more waiting for step 1 to be approved
                    </span>
                  ) : null}
                </h2>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3">
                  {COLUMNS.map((col) => {
                    const items = laneRows.filter(col.match);
                    return (
                      <div key={col.key} className="rounded-panel bg-slate-900/[0.025] p-2">
                        <h3 className="flex items-center justify-between px-1.5 pt-1 pb-2.5 text-body font-semibold text-slate-800">
                          {col.title} <span className="num text-meta text-slate-500">{items.length}</span>
                        </h3>
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

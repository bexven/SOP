import type { Metadata } from "next";
import { FilmIcon, ImageIcon, ImagesIcon, KanbanSquareIcon, ListIcon, UserRoundIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { BoardColumn, ListColumns, ListGroup, ListRow, ViewTabs, type GroupTone } from "@/components/common/list-view";
import { PageHeader } from "@/components/common/page-header";
import { BrandPill, DuePill } from "@/components/common/pills";
import { Thumbnail } from "@/components/common/thumbnail";
import { UserAvatar } from "@/components/common/user-avatar";
import { CreativeCard } from "@/components/creative/creative-card";
import { FOLLOW_UP_LABELS, TASK_TYPE_LABELS } from "@/lib/domain/labels";
import { requireUser } from "@/lib/server/auth/current-user";
import { getCreativeBoard, type CreativeRow } from "@/lib/server/queries/creative";

export const metadata: Metadata = { title: "Creative" };

const COLUMNS: { key: string; title: string; tone: GroupTone; match: (r: CreativeRow) => boolean; empty: string }[] = [
  { key: "todo", title: "To do", tone: "slate", match: (r) => r.status === "TODO", empty: "Nothing to start" },
  { key: "revision", title: "Needs changes", tone: "orange", match: (r) => r.status === "REVISION", empty: "No changes asked" },
  { key: "review", title: "In review", tone: "violet", match: (r) => r.status === "SUBMITTED", empty: "Nothing waiting for review" },
];

const LIST_COLS = "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_7.5rem_2rem]";

export default async function CreativePage({ searchParams }: PageProps<"/creative">) {
  const user = await requireUser();
  const sp = await searchParams;
  const [mine, team] = await Promise.all([getCreativeBoard(user, "mine"), getCreativeBoard(user, "all")]);
  const myOpen = mine.rows.filter((r) => r.status !== "LOCKED");
  // Makers land on their own work; everyone else on the whole team.
  const who: "mine" | "all" = sp.who === "mine" || sp.who === "all" ? sp.who : myOpen.length ? "mine" : "all";
  const view: "board" | "list" = sp.view === "list" ? "list" : "board";
  const source = who === "mine" ? mine : team;
  const rows = source.rows.filter((r) => r.status !== "LOCKED");
  const locked = source.rows.length - rows.length;
  const href = (w: string, v: string) => `/creative?who=${w}&view=${v}`;

  return (
    <>
      <PageHeader title="Creative" description="Image and video work across products. Open a task to add links, tick ready or review it." />
      <ViewTabs
        label="Whose work"
        tabs={[
          { key: "mine", label: "Mine", href: href("mine", view), icon: UserRoundIcon, current: who === "mine", count: myOpen.length },
          { key: "all", label: "Everyone", href: href("all", view), icon: UsersIcon, current: who === "all", count: team.rows.filter((r) => r.status !== "LOCKED").length },
        ]}
        right={
          <div role="group" aria-label="View" className="inline-flex rounded-control border border-[var(--line)] bg-white p-0.5">
            {(
              [
                ["board", "Board", KanbanSquareIcon],
                ["list", "List", ListIcon],
              ] as const
            ).map(([k, label, Icon]) => (
              <Link
                key={k}
                href={href(who, k)}
                scroll={false}
                aria-current={view === k ? "true" : undefined}
                className={`inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-meta transition-colors ${view === k ? "bg-accent text-accent-foreground" : "text-slate-600 hover:bg-hover"}`}
              >
                <Icon className="size-3.5" aria-hidden /> {label}
              </Link>
            ))}
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ImagesIcon}
          title={who === "mine" ? "No creative tasks for you right now" : "No creative work in progress"}
          description={
            who === "mine"
              ? `New image and video tasks appear here when a product is approved.${locked ? ` ${locked} more unlock after the step before is approved.` : ""}`
              : "Creative tasks appear here as soon as a product is approved for testing."
          }
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
          {source.lanes.map((lane) => {
            const laneRows = rows.filter((r) => r.lane === lane);
            const waiting = source.rows.filter((r) => r.lane === lane && r.status === "LOCKED").length;
            if (laneRows.length === 0 && who === "mine") return null;
            const Icon = lane === "images" ? ImageIcon : FilmIcon;
            return (
              <section key={lane} aria-labelledby={`lane-${lane}`}>
                <h2 id={`lane-${lane}`} className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-section text-slate-900">
                  <Icon className="size-4 text-slate-500" aria-hidden /> {lane === "images" ? "Images" : "Videos"}
                  <span className="num text-meta font-normal text-slate-500">{laneRows.length}</span>
                  {waiting ? <span className="text-meta font-normal text-slate-500">· {waiting} more unlock after the step before is approved</span> : null}
                </h2>
                {view === "board" ? (
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 md:grid-cols-3">
                    {COLUMNS.map((col) => {
                      const items = laneRows.filter(col.match);
                      return (
                        <BoardColumn key={col.key} label={col.title} tone={col.tone} count={items.length} empty={col.empty}>
                          {items.map((t) => (
                            <li key={t.id}>
                              <CreativeCard t={t} />
                            </li>
                          ))}
                        </BoardColumn>
                      );
                    })}
                  </div>
                ) : (
                  COLUMNS.map((col) => {
                    const items = laneRows.filter(col.match);
                    if (!items.length) return null;
                    return (
                      <ListGroup
                        key={col.key}
                        label={col.title}
                        tone={col.tone}
                        count={items.length}
                        columns={
                          <ListColumns className={LIST_COLS}>
                            <span>Task</span>
                            <span>Product</span>
                            <span>Due</span>
                            <span className="sr-only">Person</span>
                          </ListColumns>
                        }
                      >
                        {items.map((t) => (
                          <ListRow key={t.id} href={`/products/${t.product.id}?task=${t.id}`} className={LIST_COLS}>
                            <span className="flex min-w-0 items-center gap-2.5">
                              <Thumbnail src={t.product.imageUrl} alt="" className="size-7 rounded-[6px]" />
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-slate-900 group-hover/row:text-primary">
                                  {TASK_TYPE_LABELS[t.type]}
                                  {t.requestKind ? <span className="font-normal text-indigo-700"> · {FOLLOW_UP_LABELS[t.requestKind]}</span> : null}
                                </span>
                                {t.status === "REVISION" && t.revisionNote ? <span className="block truncate text-meta font-normal text-rose-700">“{t.revisionNote}”</span> : null}
                                <span className="block truncate text-meta font-normal text-slate-500 md:hidden">{t.product.name}</span>
                              </span>
                            </span>
                            <span className="hidden min-w-0 items-center gap-2 md:flex">
                              <span className="truncate text-slate-700">{t.product.name}</span>
                              <BrandPill brand={t.product.brand} className="shrink-0" />
                            </span>
                            <span className="flex items-center gap-2 md:contents">
                              <DuePill dueAt={t.dueAt} />
                              <span className="max-md:ml-auto">
                                {t.assignee ? <UserAvatar name={t.assignee.name} color={t.assignee.avatarColor} imageId={t.assignee.avatarAssetId} size="xs" /> : null}
                              </span>
                            </span>
                          </ListRow>
                        ))}
                      </ListGroup>
                    );
                  })
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

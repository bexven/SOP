import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangleIcon, CheckCircle2Icon, SkullIcon } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DuePill, STAGE_DOT, StagePill } from "@/components/common/pills";
import { UserAvatar } from "@/components/common/user-avatar";
import { BarList } from "@/components/overview/bar-list";
import { KILL_REASON_LABELS, ROLE_LABELS, STAGE_LABELS, STAGES, TASK_TYPE_LABELS } from "@/lib/domain/labels";
import { formatDuration } from "@/lib/domain/stage-time";
import { formatDate } from "@/lib/format";
import { requireCapability } from "@/lib/server/auth/current-user";
import { getOverview } from "@/lib/server/queries/overview";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  await requireCapability("overview.view");
  const o = await getOverview();
  const measured = o.averages.filter((a) => a.avgMs !== null);
  const bottleneck = measured.reduce<(typeof measured)[number] | null>((m, a) => (!m || a.avgMs! > m.avgMs! ? a : m), null);

  return (
    <>
      <PageHeader title="Overview" description="Where products are, who's loaded, and where time goes." />

      <section aria-label="Products per stage" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s) => (
          <Link key={s} href={`/products?stage=${s}`} className="surface rounded-panel p-4 transition-shadow hover:shadow-[var(--raised-shadow)]">
            <span className="flex items-center gap-2 text-meta text-slate-600">
              <span className={`size-2 rounded-full ${STAGE_DOT[s]}`} aria-hidden /> {STAGE_LABELS[s]}
            </span>
            <span className="num mt-2 block text-[28px] leading-none font-semibold tracking-tight text-slate-900">{o.stageCounts[s]}</span>
          </Link>
        ))}
      </section>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <section className="surface rounded-panel p-4 sm:p-5" aria-labelledby="bottleneck">
          <h2 id="bottleneck" className="text-section text-slate-900">Average time per stage</h2>
          <p className="mt-0.5 mb-4 text-meta font-normal text-slate-500">
            Finished stints only.{" "}
            {bottleneck ? (
              <>
                Bottleneck: <span className="font-medium text-slate-800">{STAGE_LABELS[bottleneck.stage]}</span> ({formatDuration(bottleneck.avgMs!)} on average).
              </>
            ) : null}
          </p>
          {measured.length === 0 ? (
            <p className="text-body text-slate-600">Averages appear once products have moved through at least one stage.</p>
          ) : (
            <BarList
              emphasize={bottleneck?.stage}
              rows={o.averages.map((a) => ({
                key: a.stage,
                label: STAGE_LABELS[a.stage],
                value: a.avgMs ?? 0,
                display: a.avgMs === null ? "—" : formatDuration(a.avgMs),
                title: a.avgMs === null ? `${STAGE_LABELS[a.stage]}: no finished stints yet` : `${STAGE_LABELS[a.stage]}: ${formatDuration(a.avgMs)} average across ${a.count} stint${a.count === 1 ? "" : "s"}`,
              }))}
            />
          )}
        </section>

        <section className="surface rounded-panel p-4 sm:p-5" aria-labelledby="workload">
          <h2 id="workload" className="text-section text-slate-900">Open tasks per person</h2>
          <p className="mt-0.5 mb-4 text-meta font-normal text-slate-500">
            To do + revision, in review and locked (waiting on Phase 1).
            {o.unassigned ? <span className="font-medium text-amber-800"> {o.unassigned} unassigned.</span> : null}
          </p>
          <BarList
            rows={o.workload.map((p) => ({
              key: p.id,
              label: (
                <span className="flex min-w-0 items-center gap-2">
                  <UserAvatar name={p.name} color={p.avatarColor} imageId={p.avatarAssetId} size="xs" />
                  <span className="truncate">{p.name}</span>
                </span>
              ),
              value: p.total,
              display: String(p.total),
              title: `${p.name} (${ROLE_LABELS[p.role]}): ${p.todo} to do, ${p.review} in review, ${p.locked} locked`,
            }))}
          />
        </section>

        <section className="surface rounded-panel p-4 sm:p-5" aria-labelledby="overdue">
          <h2 id="overdue" className="mb-3 flex items-center gap-2 text-section text-slate-900">
            <AlertTriangleIcon className="size-4 text-rose-600" /> Overdue tasks
          </h2>
          {o.overdue.length === 0 ? (
            <p className="flex items-center gap-2 text-body text-slate-600">
              <CheckCircle2Icon className="size-4 text-emerald-600" /> Nothing overdue. Nice.
            </p>
          ) : (
            <ul className="-mx-2 divide-y divide-slate-100">
              {o.overdue.map((t) => (
                <li key={t.id}>
                  <Link href={`/products/${t.product.id}?task=${t.id}`} className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-slate-50">
                    {t.assignee ? <UserAvatar name={t.assignee.name} color={t.assignee.avatarColor} imageId={t.assignee.avatarAssetId} size="sm" /> : <span className="size-7 rounded-full border border-dashed border-slate-300" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body text-slate-900">{TASK_TYPE_LABELS[t.type]}</span>
                      <span className="block truncate text-meta font-normal text-slate-500">
                        <span className="num">{t.product.ref}</span> · {t.product.name} · {t.assignee?.name ?? "Unassigned"}
                      </span>
                    </span>
                    <DuePill dueAt={t.dueAt} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface rounded-panel p-4 sm:p-5" aria-labelledby="killed">
          <h2 id="killed" className="flex items-center gap-2 text-section text-slate-900">
            <SkullIcon className="size-4 text-rose-600" /> Killed products <span className="num text-meta text-slate-500">{o.killedTotal}</span>
          </h2>
          {o.killedTotal === 0 ? (
            <p className="mt-3 text-body text-slate-600">No killed products yet. Reasons are tallied here so the team can learn from them.</p>
          ) : (
            <>
              <BarList
                className="mt-4"
                rows={o.killReasons.map((r) => ({
                  key: r.reason,
                  label: KILL_REASON_LABELS[r.reason],
                  value: r.count,
                  display: String(r.count),
                  title: `${KILL_REASON_LABELS[r.reason]}: ${r.count} product${r.count === 1 ? "" : "s"}`,
                }))}
              />
              <ul className="-mx-2 mt-4 divide-y divide-slate-100 border-t border-slate-100">
                {o.killed.map((k) => (
                  <li key={k.id}>
                    <Link href={`/products/${k.id}`} className="block rounded-md px-2 py-2.5 hover:bg-slate-50">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-body text-slate-900">{k.name}</span>
                        {k.stageBeforeKill ? <StagePill stage={k.stageBeforeKill} /> : null}
                      </span>
                      <span className="block truncate text-meta font-normal text-slate-500">
                        {k.killReason ? KILL_REASON_LABELS[k.killReason] : ""} · {k.killNote}
                        {k.killedAt ? <> · <span className="num">{formatDate(new Date(k.killedAt))}</span></> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}

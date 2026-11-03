import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, TruckIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { BrandPill, CampaignPill } from "@/components/common/pills";
import { Pill } from "@/components/common/pill";
import { Thumbnail } from "@/components/common/thumbnail";
import { SCALE_PLAN_LABELS, SCALE_VERDICT_LABELS } from "@/lib/domain/orders";
import { can } from "@/lib/domain/permissions";
import { formatBdt, formatDate } from "@/lib/format";
import { requireUser } from "@/lib/server/auth/current-user";
import { getOrdersBoard } from "@/lib/server/queries/orders";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const user = await requireUser();
  const board = await getOrdersBoard(user);
  const canManage = can(user, "orders.manage");

  return (
    <>
      <PageHeader
        title="Orders"
        description="Products that performed well in their campaign and are being ordered. Open one to add an order or update its scaling plan."
      />

      {board.inOrdering.length === 0 ? (
        <EmptyState
          icon={TruckIcon}
          title="No products in ordering yet"
          description={
            canManage
              ? "When a live campaign performs well, open the product's Meta ads tab and click “Move to ordering”."
              : "Products appear here when the media buyer moves a well-performing live product to ordering."
          }
        />
      ) : (
        <ul className="surface divide-y divide-slate-100 overflow-hidden rounded-panel">
          {board.inOrdering.map((p) => (
            <li key={p.id}>
              <Link
                href={`/products/${p.id}?phase=orders`}
                className="grid gap-3 px-3 py-3.5 transition-colors hover:bg-slate-50/80 sm:px-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Thumbnail src={p.imageUrl} alt="" className="size-11" />
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <BrandPill brand={p.brand} />
                      <span className="truncate text-body font-medium text-slate-900">{p.name}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="num text-meta text-slate-500">{p.ref}</span>
                      {p.campaignStatus ? <CampaignPill status={p.campaignStatus} /> : null}
                      {p.scalable ? (
                        <Pill tone={p.scalable === "YES" ? "emerald" : p.scalable === "NO" ? "rose" : "amber"}>{SCALE_VERDICT_LABELS[p.scalable]}</Pill>
                      ) : null}
                      {p.scalePlans.map((s) => (
                        <Pill key={s} tone="sky">
                          {SCALE_PLAN_LABELS[s].replace(/ \(.*\)$/, "")}
                        </Pill>
                      ))}
                    </span>
                  </span>
                </span>
                <span className="grid grid-cols-3 gap-3 text-meta text-slate-600">
                  <span>
                    Orders
                    <span className="num block text-body font-semibold text-slate-900">{p.summary.orders}</span>
                  </span>
                  <span>
                    Units
                    <span className="num block text-body font-semibold text-slate-900">{p.summary.units.toLocaleString("en-IN")}</span>
                  </span>
                  <span>
                    Expected profit
                    <span className={`num block text-body font-semibold ${Number(p.summary.expectedProfit) < 0 ? "text-rose-700" : "text-slate-900"}`}>
                      {formatBdt(p.summary.expectedProfit)}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-2 text-meta font-normal text-slate-500 lg:justify-self-end">
                  {p.lastOrderOn ? (
                    <>
                      Last order <span className="num">{formatDate(new Date(`${p.lastOrderOn}T00:00:00Z`))}</span>
                    </>
                  ) : (
                    <span className="font-medium text-amber-800">No order yet</span>
                  )}
                  <ArrowRightIcon className="size-4 text-slate-400" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canManage && board.live.length ? (
        <section className="mt-8" aria-labelledby="live-h">
          <h2 id="live-h" className="mb-1 text-section text-slate-900">
            Live campaigns <span className="num text-meta text-slate-500">{board.live.length}</span>
          </h2>
          <p className="mb-3 text-meta font-normal text-slate-600">When one performs well, open it and move it to ordering.</p>
          <ul className="surface divide-y divide-slate-100 overflow-hidden rounded-panel">
            {board.live.map((p) => (
              <li key={p.id}>
                <Link href={`/products/${p.id}?phase=ads`} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50/80 sm:px-4">
                  <Thumbnail src={p.imageUrl} alt="" className="size-9" />
                  <BrandPill brand={p.brand} />
                  <span className="min-w-0 flex-1 truncate text-body text-slate-900">{p.name}</span>
                  {p.campaignStatus ? <CampaignPill status={p.campaignStatus} /> : null}
                  {p.launchedAt ? (
                    <span className="num hidden text-meta text-slate-500 sm:inline">since {formatDate(new Date(p.launchedAt))}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

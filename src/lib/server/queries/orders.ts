import "server-only";
import { overallCampaignStatus } from "@/lib/domain/campaigns";
import { orderSummary } from "@/lib/domain/orders";
import { productRef } from "@/lib/format";
import { db } from "../db";
import { productScope } from "../services/brand-scope";
import type { BrandViewer } from "@/lib/domain/permissions";

const brand = { select: { id: true, name: true, color: true } } as const;

/** Products in ordering (with totals), plus live campaigns that could move to ordering. */
export async function getOrdersBoard(viewer: BrandViewer) {
  const scope = productScope(viewer);
  const [inOrdering, live] = await Promise.all([
    db.product.findMany({
      where: { AND: [scope], orderingSince: { not: null } },
      orderBy: { orderingSince: "desc" },
      include: { brand, adCampaigns: { select: { status: true } }, orders: { orderBy: { number: "desc" } } },
    }),
    db.product.findMany({
      where: { AND: [scope], stage: "LIVE", orderingSince: null },
      orderBy: { stageEnteredAt: "asc" },
      include: { brand, adCampaigns: { select: { status: true, launchedAt: true } } },
    }),
  ]);
  return {
    inOrdering: inOrdering.map((p) => {
      const orders = p.orders.map((o) => ({
        quantity: o.quantity,
        buyingPriceBdt: o.buyingPriceBdt.toString(),
        shippingCostBdt: o.shippingCostBdt.toString(),
        sellingPriceBdt: o.sellingPriceBdt.toString(),
        courierChargePct: o.courierChargePct.toString(),
      }));
      return {
        id: p.id,
        ref: productRef(p.number),
        name: p.name,
        imageUrl: p.imageUrl,
        brand: p.brand,
        stage: p.stage,
        campaignStatus: overallCampaignStatus(p.adCampaigns.map((c) => c.status)),
        orderingSince: p.orderingSince!.toISOString(),
        scalable: p.scalable,
        scalePlans: p.scalePlans,
        lastOrderOn: p.orders[0]?.orderedOn.toISOString().slice(0, 10) ?? null,
        summary: orderSummary(orders),
      };
    }),
    live: live.map((p) => ({
      id: p.id,
      ref: productRef(p.number),
      name: p.name,
      imageUrl: p.imageUrl,
      brand: p.brand,
      campaignStatus: overallCampaignStatus(p.adCampaigns.map((c) => c.status)),
      launchedAt: firstLaunch(p.adCampaigns),
    })),
  };
}

/** When the product's first campaign launched. */
function firstLaunch(cs: { launchedAt: Date | null }[]): string | null {
  const times = cs.map((c) => c.launchedAt?.getTime()).filter((t): t is number => t !== undefined);
  return times.length ? new Date(Math.min(...times)).toISOString() : null;
}

/** Test orders still in progress (to place, or on their way), for the dashboard of whoever places them. */
export async function getOpenTestOrders(viewer: BrandViewer) {
  const rows = await db.testOrder.findMany({
    where: { confirmedAt: null, product: { AND: [productScope(viewer)], stage: { notIn: ["KILLED"] } } },
    orderBy: [{ placedAt: { sort: "asc", nulls: "first" } }, { expectedOn: "asc" }, { createdAt: "asc" }],
    take: 50,
    include: { product: { select: { id: true, name: true, imageUrl: true, brand: { select: { name: true, color: true } } } } },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name ?? "Test order",
    note: t.note,
    placedAt: t.placedAt?.toISOString() ?? null,
    confirmedAt: null as string | null,
    expectedOn: t.expectedOn ? t.expectedOn.toISOString().slice(0, 10) : null,
    product: t.product,
  }));
}

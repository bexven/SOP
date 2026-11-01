import "server-only";
import { orderSummary } from "@/lib/domain/orders";
import { productRef } from "@/lib/format";
import { db } from "../db";

const brand = { select: { id: true, name: true, color: true } } as const;

/** Products in ordering (with totals), plus live campaigns that could move to ordering. */
export async function getOrdersBoard() {
  const [inOrdering, live] = await Promise.all([
    db.product.findMany({
      where: { orderingSince: { not: null } },
      orderBy: { orderingSince: "desc" },
      include: { brand, campaign: { select: { status: true } }, orders: { orderBy: { number: "desc" } } },
    }),
    db.product.findMany({
      where: { stage: "LIVE", orderingSince: null },
      orderBy: { stageEnteredAt: "asc" },
      include: { brand, campaign: { select: { status: true, launchedAt: true } } },
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
        campaignStatus: p.campaign?.status ?? null,
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
      campaignStatus: p.campaign?.status ?? null,
      launchedAt: p.campaign?.launchedAt?.toISOString() ?? null,
    })),
  };
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon, SaveIcon, TruckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { ScalePlan, ScaleVerdict } from "@/generated/prisma/enums";
import { Field, fieldA11y } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addOrderError, orderMath, orderSummary, SCALE_PLAN_LABELS, SCALE_PLANS, SCALE_VERDICT_LABELS, SCALE_VERDICTS } from "@/lib/domain/orders";
import { can } from "@/lib/domain/permissions";
import { formatBdt, formatDate } from "@/lib/format";
import { moveToOrderingAction, saveOrderAction, saveScalingAction } from "@/lib/server/actions/orders";
import type { OrderDTO, ProductDetail } from "@/lib/server/queries/product";
import { cn } from "@/lib/utils";
import { Discussion } from "./discussion";
import type { Viewer } from "./product-view";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
}

export function OrdersTab({ product, viewer }: { product: ProductDetail; viewer: Viewer }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canManage = can(viewer, "orders.manage");
  const blocked = addOrderError(product);
  const summary = orderSummary(product.orders);
  const [editing, setEditing] = useState<OrderDTO | "new" | null>(null);

  if (!product.orderingSince) {
    return (
      <div className="grid gap-6">
        <section className="surface grid justify-items-start gap-3 rounded-panel p-5">
          <TruckIcon className="size-6 text-slate-400" aria-hidden />
          <h2 className="text-section text-slate-900">Not in ordering yet</h2>
          <p className="max-w-xl text-body text-slate-600">
            When the campaign performs well, the media buyer moves the product to ordering. Then you can add stock orders, each with its own
            buying price, shipping cost and selling price, and set the scaling plan.
          </p>
          {canManage && product.stage === "LIVE" ? (
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await moveToOrderingAction({ productId: product.id });
                  if (r.ok) {
                    toast.success(r.message);
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              <TruckIcon /> Move to ordering
            </Button>
          ) : null}
        </section>
        <Discussion product={product} viewer={viewer} phase="ORDERS" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <section aria-label="Order totals" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Orders" value={String(summary.orders)} />
        <Tile label="Units ordered" value={summary.units.toLocaleString("en-IN")} />
        <Tile label="Total cost" value={formatBdt(summary.totalCost)} />
        <Tile label="Expected profit" value={formatBdt(summary.expectedProfit)} tone={Number(summary.expectedProfit) < 0 ? "text-rose-700" : "text-emerald-800"} />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="orders-h" className="grid content-start gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="orders-h" className="text-section text-slate-900">
              Order history
            </h2>
            {canManage && !blocked && editing !== "new" ? (
              <Button size="sm" onClick={() => setEditing("new")}>
                <PlusIcon /> {product.orders.length ? "New order" : "First order"}
              </Button>
            ) : null}
          </div>
          {editing ? (
            <OrderForm
              key={editing === "new" ? "new" : editing.id}
              product={product}
              order={editing === "new" ? null : editing}
              onDone={() => setEditing(null)}
            />
          ) : null}
          {product.orders.length === 0 ? (
            !editing ? (
              <p className="surface rounded-panel px-4 py-6 text-center text-body text-slate-600">
                No orders yet. {canManage ? "Add the first order with how many units to buy and today's prices." : "The media buyer adds orders here."}
              </p>
            ) : null
          ) : (
            <div className="surface relative overflow-x-auto rounded-panel">
              <table className="w-full min-w-[46rem] text-left text-body">
                <thead className="border-b border-slate-100 text-meta text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Order</th>
                    <th className="px-3 py-2.5 text-right font-medium">Units</th>
                    <th className="px-3 py-2.5 text-right font-medium">Buying / unit</th>
                    <th className="px-3 py-2.5 text-right font-medium">Shipping / unit</th>
                    <th className="px-3 py-2.5 text-right font-medium">Selling / unit</th>
                    <th className="px-3 py-2.5 text-right font-medium">Profit / unit</th>
                    <th className="px-3 py-2.5 text-right font-medium">Total cost</th>
                    <th className="px-3 py-2.5 text-right font-medium">Expected profit</th>
                    {canManage ? <th className="px-2 py-2.5"><span className="sr-only">Edit</span></th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {product.orders.map((o) => {
                    const m = orderMath(o);
                    return (
                      <tr key={o.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-3 py-2.5">
                          <span className="num font-semibold text-slate-900">#{o.number}</span>
                          <span className="num ml-2 text-meta text-slate-500">{formatDate(new Date(`${o.orderedOn}T00:00:00Z`))}</span>
                          {o.note ? <span className="block max-w-[14rem] truncate text-meta font-normal text-slate-600">{o.note}</span> : null}
                        </td>
                        <td className="num px-3 py-2.5 text-right">{o.quantity.toLocaleString("en-IN")}</td>
                        <td className="num px-3 py-2.5 text-right">{formatBdt(o.buyingPriceBdt)}</td>
                        <td className="num px-3 py-2.5 text-right">{formatBdt(o.shippingCostBdt)}</td>
                        <td className="num px-3 py-2.5 text-right">{formatBdt(o.sellingPriceBdt)}</td>
                        <td className={cn("num px-3 py-2.5 text-right", m && Number(m.profitPerUnit) < 0 && "text-rose-700")}>
                          {m ? formatBdt(m.profitPerUnit) : "—"}
                          {m?.marginPct ? <span className="block text-meta text-slate-500">{m.marginPct}%</span> : null}
                        </td>
                        <td className="num px-3 py-2.5 text-right">{m ? formatBdt(m.totalCost) : "—"}</td>
                        <td className={cn("num px-3 py-2.5 text-right font-medium", m && Number(m.expectedProfit) < 0 ? "text-rose-700" : "text-slate-900")}>
                          {m ? formatBdt(m.expectedProfit) : "—"}
                        </td>
                        {canManage ? (
                          <td className="px-2 py-2.5">
                            <Button variant="ghost" size="icon-sm" aria-label={`Edit order ${o.number}`} onClick={() => setEditing(o)} disabled={Boolean(blocked)}>
                              <PencilIcon />
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-meta font-normal text-slate-500">
            Each order keeps its own prices, separate from the research prices. Profit = selling − buying − shipping − courier ({product.thresholds?.courierChargePct ?? product.courierChargePct}% of selling).
          </p>
        </section>

        <ScalingPanel product={product} canManage={canManage} />
      </div>

      <Discussion product={product} viewer={viewer} phase="ORDERS" />
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="surface rounded-panel p-4">
      <p className="text-meta text-slate-600">{label}</p>
      <p className={cn("num mt-1.5 text-[22px] leading-none font-semibold tracking-tight text-slate-900", tone)}>{value}</p>
    </div>
  );
}

function OrderForm({ product, order, onDone }: { product: ProductDetail; order: OrderDTO | null; onDone: () => void }) {
  const router = useRouter();
  const last = product.orders[0];
  const [v, setV] = useState({
    quantity: order ? String(order.quantity) : "",
    buyingPriceBdt: order?.buyingPriceBdt ?? last?.buyingPriceBdt ?? product.chinaPriceBdt ?? "",
    shippingCostBdt: order?.shippingCostBdt ?? last?.shippingCostBdt ?? product.shippingPerUnitBdt ?? "",
    sellingPriceBdt: order?.sellingPriceBdt ?? last?.sellingPriceBdt ?? product.sellingPriceBdt ?? "",
    orderedOn: order?.orderedOn ?? today(),
    note: order?.note ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const courier = order?.courierChargePct ?? product.thresholds?.courierChargePct ?? product.courierChargePct;
  const preview = useMemo(() => orderMath({ ...v, quantity: Number(v.quantity), courierChargePct: courier }), [v, courier]);
  const set = (k: keyof typeof v, numeric = false) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: numeric ? e.target.value.replace(/[^\d.]/g, "") : e.target.value });
  const err = (k: string) => errors[k]?.[0];

  return (
    <form
      className="surface grid gap-3 rounded-panel p-4 ring-2 ring-primary/25"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await saveOrderAction({ productId: product.id, orderId: order?.id, ...v });
          if (r.ok) {
            toast.success(r.message);
            onDone();
            router.refresh();
          } else {
            setErrors(r.fieldErrors ?? {});
            toast.error(r.error);
          }
        });
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-section text-slate-900">{order ? `Edit order #${order.number}` : `New order #${(last?.number ?? 0) + 1}`}</h3>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={onDone}>
          <XIcon />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="o-qty" label="Units to order *" error={err("quantity")}>
          <Input {...fieldA11y("o-qty", err("quantity"))} value={v.quantity} onChange={(e) => setV({ ...v, quantity: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className="num" placeholder="500" autoFocus />
        </Field>
        <Field id="o-date" label="Order date *" error={err("orderedOn")}>
          <Input {...fieldA11y("o-date", err("orderedOn"))} type="date" value={v.orderedOn} onChange={set("orderedOn")} className="num" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {([
          ["buyingPriceBdt", "Buying price / unit *"],
          ["shippingCostBdt", "Shipping cost / unit *"],
          ["sellingPriceBdt", "Selling price / unit *"],
        ] as const).map(([k, label]) => (
          <Field key={k} id={`o-${k}`} label={label} error={err(k)}>
            <div className="relative">
              <Input {...fieldA11y(`o-${k}`, err(k))} value={v[k]} onChange={set(k, true)} inputMode="decimal" className="num pr-12" />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-meta text-slate-500">BDT</span>
            </div>
          </Field>
        ))}
      </div>
      <Field id="o-note" label="Note" error={err("note")}>
        <Textarea {...fieldA11y("o-note", err("note"))} value={v.note} onChange={set("note")} rows={2} placeholder="Supplier, payment, expected arrival…" />
      </Field>
      <dl className="grid grid-cols-2 gap-2 rounded-control bg-slate-50 p-3 text-body sm:grid-cols-4">
        {[
          ["Cost / unit", preview?.costPerUnit],
          ["Profit / unit", preview?.profitPerUnit],
          ["Total cost", preview?.totalCost],
          ["Expected profit", preview?.expectedProfit],
        ].map(([k, val]) => (
          <div key={k}>
            <dt className="text-meta text-slate-500">{k}</dt>
            <dd className={cn("num font-semibold text-slate-900", val && Number(val) < 0 && "text-rose-700")}>{val ? formatBdt(val) : "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !preview}>
          <SaveIcon /> {order ? "Save changes" : "Add order"}
        </Button>
      </div>
    </form>
  );
}

function ScalingPanel({ product, canManage }: { product: ProductDetail; canManage: boolean }) {
  const router = useRouter();
  const [scalable, setScalable] = useState<ScaleVerdict | null>(product.scalable);
  const [plans, setPlans] = useState<ScalePlan[]>(product.scalePlans);
  const [note, setNote] = useState(product.scaleNote ?? "");
  const [pending, startTransition] = useTransition();
  const dirty =
    scalable !== product.scalable || note !== (product.scaleNote ?? "") || plans.slice().sort().join() !== product.scalePlans.slice().sort().join();

  return (
    <section className="surface grid content-start gap-4 rounded-panel p-4" aria-labelledby="scale-h">
      <h2 id="scale-h" className="text-section text-slate-900">
        Scaling
      </h2>
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-meta text-slate-700">Is this product scalable?</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Is this product scalable?">
          {SCALE_VERDICTS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scalable === s}
              disabled={!canManage}
              onClick={() => setScalable(scalable === s ? null : s)}
              className={cn(
                "rounded-full px-3 py-1.5 text-meta ring-1 transition-colors ring-inset disabled:cursor-not-allowed",
                scalable === s
                  ? s === "YES"
                    ? "bg-emerald-700 text-white ring-emerald-700"
                    : s === "NO"
                      ? "bg-rose-700 text-white ring-rose-700"
                      : "bg-amber-700 text-white ring-amber-700"
                  : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {SCALE_VERDICT_LABELS[s]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-meta text-slate-700">Our plan</legend>
        {SCALE_PLANS.map((p) => (
          <label key={p} className={cn("flex items-center gap-2.5 text-body text-slate-800", canManage ? "cursor-pointer" : "cursor-default")}>
            <Checkbox
              checked={plans.includes(p)}
              disabled={!canManage}
              onCheckedChange={(c) => setPlans(c === true ? [...plans, p] : plans.filter((x) => x !== p))}
            />
            {SCALE_PLAN_LABELS[p]}
          </label>
        ))}
      </fieldset>
      <Field id="s-note" label="Notes">
        <Textarea id="s-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} disabled={!canManage} placeholder="Why, how much more, by when…" />
      </Field>
      {canManage ? (
        <Button
          disabled={pending || !dirty}
          onClick={() =>
            startTransition(async () => {
              const r = await saveScalingAction({ productId: product.id, scalable, scalePlans: plans, scaleNote: note });
              if (r.ok) {
                toast.success(r.message);
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          <SaveIcon /> Save scaling plan
        </Button>
      ) : null}
    </section>
  );
}

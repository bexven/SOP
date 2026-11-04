"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConicalIcon, PencilIcon, PlusIcon, SaveIcon, Trash2Icon, TruckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { ScalePlan, ScaleVerdict, TestQuality } from "@/generated/prisma/enums";
import { Field, fieldA11y } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ShippingMethodPicker } from "@/components/common/shipping-method-picker";
import { rateForMethod, SHIPPING_METHOD_LABELS, shippingFromWeight, type ShippingMethodKey } from "@/lib/domain/margin";
import { addOrderError, orderMath, orderSummary, SCALE_PLAN_LABELS, SCALE_PLANS, SCALE_VERDICT_LABELS, SCALE_VERDICTS } from "@/lib/domain/orders";
import { can } from "@/lib/domain/permissions";
import { formatBdt, formatDate } from "@/lib/format";
import { deleteTestOrderAction, moveToOrderingAction, saveOrderAction, saveScalingAction, saveTestOrderAction } from "@/lib/server/actions/orders";
import type { OrderDTO, ProductDetail, TestOrderDTO } from "@/lib/server/queries/product";
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
            <>
            <ul className="grid gap-2 md:hidden" aria-label="Orders">
              {product.orders.map((o) => {
                const m = orderMath(o);
                return (
                  <li key={o.id} className="surface rounded-panel p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-body font-semibold text-slate-900">
                          <span className="num">#{o.number}</span> · <span className="num">{o.quantity.toLocaleString("en-IN")}</span> units
                        </p>
                        <p className="num text-meta font-normal text-slate-500">{formatDate(new Date(`${o.orderedOn}T00:00:00Z`))}</p>
                      </div>
                      {canManage ? (
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit order ${o.number}`} onClick={() => setEditing(o)} disabled={Boolean(blocked)}>
                          <PencilIcon />
                        </Button>
                      ) : null}
                    </div>
                    {o.note ? <p className="mt-1 text-meta font-normal [overflow-wrap:anywhere] text-slate-600">{o.note}</p> : null}
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-meta">
                      {[
                        ["Buying", o.buyingPriceBdt],
                        [o.shippingMethod ? `Shipping (${SHIPPING_METHOD_LABELS[o.shippingMethod]})` : "Shipping", o.shippingCostBdt],
                        ["Selling", o.sellingPriceBdt],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-control bg-slate-50 px-2 py-1.5">
                          <dt className="truncate text-slate-500">{k} / unit</dt>
                          <dd className="num text-body font-medium text-slate-900">{formatBdt(v)}</dd>
                        </div>
                      ))}
                    </dl>
                    <dl className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-meta">
                      <div>
                        <dt className="text-slate-500">Total cost</dt>
                        <dd className="num text-body font-medium text-slate-900">{m ? formatBdt(m.totalCost) : "—"}</dd>
                      </div>
                      <div className="text-right">
                        <dt className="text-slate-500">Expected profit{m?.marginPct ? ` · ${m.marginPct}%` : ""}</dt>
                        <dd className={cn("num text-body font-semibold", m && Number(m.expectedProfit) < 0 ? "text-rose-700" : "text-emerald-800")}>
                          {m ? formatBdt(m.expectedProfit) : "—"}
                        </dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
            <div className="surface relative hidden overflow-x-auto rounded-panel md:block">
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
                        <td className="num px-3 py-2.5 text-right">
                          {formatBdt(o.shippingCostBdt)}
                          {o.shippingMethod ? (
                            <span className="block text-meta text-slate-500">
                              {SHIPPING_METHOD_LABELS[o.shippingMethod]}
                              {o.weightKg ? ` · ${Number(o.weightKg)} kg` : ""}
                            </span>
                          ) : null}
                        </td>
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
            </>
          )}
          <p className="text-meta font-normal text-slate-500">
            Each order keeps its own prices, separate from the research prices. Shipping = weight × the Air or Sea rate per kg. Profit = selling − buying − shipping − courier ({product.thresholds?.courierChargePct ?? product.courierChargePct}% of selling).
          </p>
        </section>

        <div className="grid content-start gap-6">
          <ScalingPanel product={product} canManage={canManage} />
          {viewer.role === "ADMIN" ? <TestOrdersPanel product={product} /> : null}
        </div>
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
    weightKg: order?.weightKg ?? last?.weightKg ?? product.weightKg ?? "",
    shippingMethod: (order?.shippingMethod ?? last?.shippingMethod ?? product.shippingMethod ?? "") as "" | ShippingMethodKey,
    sellingPriceBdt: order?.sellingPriceBdt ?? last?.sellingPriceBdt ?? product.sellingPriceBdt ?? "",
    orderedOn: order?.orderedOn ?? today(),
    note: order?.note ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const courier = order?.courierChargePct ?? product.thresholds?.courierChargePct ?? product.courierChargePct;
  const method = v.shippingMethod || null;
  // Shipping = weight × the method's rate. An order keeps its own rate while the method stays the same.
  const rate =
    order?.shippingRatePerKgBdt && order.shippingMethod === method
      ? order.shippingRatePerKgBdt
      : rateForMethod(method, { air: product.thresholds?.shippingRatePerKgBdt ?? null, sea: product.thresholds?.seaShippingRatePerKgBdt ?? null });
  const shipping = method ? shippingFromWeight(v.weightKg, rate) : null;
  const preview = useMemo(
    () => (shipping ? orderMath({ ...v, shippingCostBdt: shipping, quantity: Number(v.quantity), courierChargePct: courier }) : null),
    [v, shipping, courier],
  );
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
      <ShippingMethodPicker
        id="o-method"
        value={v.shippingMethod}
        onChange={(m) => setV({ ...v, shippingMethod: m })}
        rates={{ AIR: product.thresholds?.shippingRatePerKgBdt ?? null, SEA: product.thresholds?.seaShippingRatePerKgBdt ?? null }}
        error={err("shippingMethod")}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["buyingPriceBdt", "Buying price / unit *", "BDT"],
            ["weightKg", "Weight / unit *", "kg"],
            ["shipping", "Shipping / unit", "BDT"],
            ["sellingPriceBdt", "Selling price / unit *", "BDT"],
          ] as const
        ).map(([k, label, unit]) =>
          k === "shipping" ? (
            <Field
              key={k}
              id="o-shipping"
              label={label}
              hint={!method ? "Choose Air or Sea" : rate ? `${SHIPPING_METHOD_LABELS[method]}: weight × ${formatBdt(rate)} per kg` : `An Admin sets the ${SHIPPING_METHOD_LABELS[method].toLowerCase()} rate in Settings`}
            >
              <div className="relative">
                <Input {...fieldA11y("o-shipping", undefined, true)} value={shipping ?? ""} readOnly placeholder="—" className="num cursor-default bg-slate-50 pr-12 text-slate-700" />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-meta text-slate-500">{unit}</span>
              </div>
            </Field>
          ) : (
            <Field key={k} id={`o-${k}`} label={label} error={err(k)}>
              <div className="relative">
                <Input
                  {...fieldA11y(`o-${k}`, err(k))}
                  value={v[k]}
                  onChange={set(k, true)}
                  inputMode="decimal"
                  placeholder={k === "weightKg" ? "e.g. 0.150" : undefined}
                  className="num pr-12"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-meta text-slate-500">{unit}</span>
              </div>
            </Field>
          ),
        )}
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

const QUALITY: { key: TestQuality; label: string; on: string }[] = [
  { key: "WAITING", label: "Waiting", on: "bg-amber-700 text-white ring-amber-700" },
  { key: "PASSED", label: "Passed", on: "bg-emerald-700 text-white ring-emerald-700" },
  { key: "FAILED", label: "Failed", on: "bg-rose-700 text-white ring-rose-700" },
];
const QUALITY_PILL: Record<TestQuality, string> = {
  WAITING: "bg-amber-50 text-amber-800 ring-amber-100",
  PASSED: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-100",
};

/** Admins only: small test orders to check the product's quality before ordering stock. */
function TestOrdersPanel({ product }: { product: ProductDetail }) {
  const [editing, setEditing] = useState<TestOrderDTO | "new" | null>(null);
  return (
    <section className="surface grid content-start gap-3 rounded-panel p-4" aria-labelledby="test-h">
      <div className="flex items-center justify-between gap-2">
        <h2 id="test-h" className="flex items-center gap-2 text-section text-slate-900">
          <FlaskConicalIcon className="size-4 text-slate-500" aria-hidden /> Test orders
        </h2>
        {editing !== "new" ? (
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            <PlusIcon /> Test order
          </Button>
        ) : null}
      </div>
      <p className="text-meta font-normal text-slate-500">Order a few units to check quality. Only Admins see this.</p>
      {editing === "new" ? <TestOrderForm product={product} test={null} onDone={() => setEditing(null)} /> : null}
      {product.testOrders.length === 0 && editing !== "new" ? (
        <p className="rounded-control bg-slate-50 px-3 py-3 text-meta font-normal text-slate-600">No test orders yet. Add one when you order units to check quality.</p>
      ) : (
        <ul className="grid gap-2">
          {product.testOrders.map((t) =>
            editing !== "new" && editing?.id === t.id ? (
              <li key={t.id}>
                <TestOrderForm product={product} test={t} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={t.id} className="rounded-control bg-slate-50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-meta ring-1 ring-inset", QUALITY_PILL[t.quality])}>{QUALITY.find((q) => q.key === t.quality)!.label}</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Edit test order" onClick={() => setEditing(t)}>
                    <PencilIcon />
                  </Button>
                </div>
                {t.note ? <p className="mt-1.5 text-body whitespace-pre-line [overflow-wrap:anywhere] text-slate-800">{t.note}</p> : null}
                <p className="mt-1 text-meta font-normal text-slate-500">
                  {t.createdBy.name} · <span className="num">{formatDate(new Date(t.createdAt))}</span>
                </p>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function TestOrderForm({ product, test, onDone }: { product: ProductDetail; test: TestOrderDTO | null; onDone: () => void }) {
  const router = useRouter();
  const [quality, setQuality] = useState<TestQuality>(test?.quality ?? "WAITING");
  const [note, setNote] = useState(test?.note ?? "");
  const [pending, startTransition] = useTransition();
  const done = (r: { ok: boolean; message?: string; error?: string }) => {
    if (r.ok) {
      toast.success(r.message ?? "Saved");
      onDone();
      router.refresh();
    } else toast.error(r.error ?? "Something went wrong");
  };
  return (
    <div className="grid gap-3 rounded-control bg-white p-3 ring-2 ring-primary/25">
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-meta text-slate-700">Quality</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Quality">
          {QUALITY.map((q) => (
            <button
              key={q.key}
              type="button"
              role="radio"
              aria-checked={quality === q.key}
              onClick={() => setQuality(q.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-meta ring-1 transition-colors duration-150 ring-inset focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                quality === q.key ? q.on : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
      </fieldset>
      <Field id={`t-note-${test?.id ?? "new"}`} label="Note">
        <Textarea id={`t-note-${test?.id ?? "new"}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="Units, supplier, what to check…" />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        {test ? (
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            disabled={pending}
            onClick={() => startTransition(async () => done(await deleteTestOrderAction({ testOrderId: test.id })))}
          >
            <Trash2Icon /> Remove
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={() => startTransition(async () => done(await saveTestOrderAction({ productId: product.id, testOrderId: test?.id, quality, note })))}
        >
          <SaveIcon /> Save
        </Button>
      </div>
    </div>
  );
}

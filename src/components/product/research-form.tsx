"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, ExternalLinkIcon, PlusIcon, SaveIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { Priority } from "@/generated/prisma/enums";
import { BrandPicker } from "@/components/common/brand-picker";
import { Field, fieldA11y } from "@/components/common/field";
import { ChecklistPanel, type ChecklistItemDTO } from "@/components/task/checklist-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/domain/labels";
import { computeMargin, marginBand } from "@/lib/domain/margin";
import { researchBlockers } from "@/lib/domain/workflow";
import { submitResearchAction, updateResearchAction } from "@/lib/server/actions/product";
import { MarginCard } from "./margin-card";

export type ResearchValues = {
  brandId: string;
  name: string;
  supplierUrl: string;
  imageUrl: string;
  chinaPriceBdt: string;
  shippingPerUnitBdt: string;
  sellingPriceBdt: string;
  targetCustomer: string;
  problemSolved: string;
  sellingAngle: string;
  referenceLinks: string[];
  priority: Priority;
  targetLaunchDate: string;
};

type Errors = Record<string, string[] | undefined>;

export function ResearchForm({
  productId,
  initial,
  checklist,
  rates,
  editable,
  brands,
  mode = "research",
  onDone,
}: {
  brands: { id: string; name: string; color: string; active: boolean }[];
  /** "admin": an Admin editing a product after research (no checklist / submit; changes are logged). */
  mode?: "research" | "admin";
  onDone?: () => void;
  productId: string;
  initial: ResearchValues;
  checklist: ChecklistItemDTO[];
  rates: { courierChargePct: string; healthyMarginPct: string; thinMarginPct: string } | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<ResearchValues>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof ResearchValues>(key: K, value: ResearchValues[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  const money = (key: "chinaPriceBdt" | "shippingPerUnitBdt" | "sellingPriceBdt") => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(key, e.target.value.replace(/[^\d.]/g, ""));

  const margin = useMemo(
    () =>
      rates
        ? computeMargin({
            chinaPriceBdt: v.chinaPriceBdt || null,
            shippingPerUnitBdt: v.shippingPerUnitBdt || null,
            sellingPriceBdt: v.sellingPriceBdt || null,
            courierChargePct: rates.courierChargePct,
          })
        : null,
    [v.chinaPriceBdt, v.shippingPerUnitBdt, v.sellingPriceBdt, rates],
  );
  const band = margin?.marginPct && rates ? marginBand(margin.marginPct, rates) : null;

  const missingChecklist = checklist.filter((i) => i.required && !i.checked).length;
  const blockers = researchBlockers(
    {
      brandId: v.brandId,
      name: v.name,
      supplierUrl: v.supplierUrl,
      chinaPriceBdt: v.chinaPriceBdt,
      shippingPerUnitBdt: v.shippingPerUnitBdt,
      sellingPriceBdt: v.sellingPriceBdt,
    },
    missingChecklist,
  );

  const payload = () => ({ productId, ...v, referenceLinks: v.referenceLinks.map((l) => l.trim()).filter(Boolean) });

  async function save(): Promise<boolean> {
    const r = await updateResearchAction(payload());
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      toast.error(r.error);
      return false;
    }
    setErrors({});
    setDirty(false);
    return true;
  }

  function onSave() {
    startTransition(async () => {
      if (await save()) {
        toast.success(mode === "admin" ? "Changes saved · logged on the timeline" : "Research saved");
        router.refresh();
        onDone?.();
      }
    });
  }

  function onSubmit() {
    startTransition(async () => {
      if (!(await save())) return;
      const r = await submitResearchAction({ productId });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Submitted");
      router.refresh();
    });
  }

  const err = (k: string) => errors[k]?.[0];
  const disabled = !editable || pending;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid gap-4">
        <section className="surface grid gap-4 rounded-panel p-4 sm:p-5" aria-label="Research details">
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-meta text-slate-700">Brand *</legend>
            <BrandPicker brands={brands.filter((b) => b.active || b.id === v.brandId)} value={v.brandId} onChange={(id) => set("brandId", id)} disabled={disabled} />
          </fieldset>
          <Field id="r-name" label="Product name *" error={err("name")}>
            <Input {...fieldA11y("r-name", err("name"))} value={v.name} onChange={(e) => set("name", e.target.value)} disabled={disabled} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="r-supplier" label="Supplier link *" hint="1688, AliExpress or other" error={err("supplierUrl")}>
              <div className="flex gap-2">
                <Input
                  {...fieldA11y("r-supplier", err("supplierUrl"), true)}
                  value={v.supplierUrl}
                  onChange={(e) => set("supplierUrl", e.target.value)}
                  placeholder="https://detail.1688.com/…"
                  inputMode="url"
                  disabled={disabled}
                />
                {v.supplierUrl.startsWith("http") ? (
                  <Button asChild size="icon" aria-label="Open supplier link">
                    <a href={v.supplierUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLinkIcon />
                    </a>
                  </Button>
                ) : null}
              </div>
            </Field>
            <Field id="r-image" label="Image / reference URL" hint="Used as the thumbnail" error={err("imageUrl")}>
              <Input
                {...fieldA11y("r-image", err("imageUrl"), true)}
                value={v.imageUrl}
                onChange={(e) => set("imageUrl", e.target.value)}
                placeholder="https://…"
                inputMode="url"
                disabled={disabled}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <MoneyField id="r-china" label="China price / unit *" unit="BDT" value={v.chinaPriceBdt} onChange={money("chinaPriceBdt")} error={err("chinaPriceBdt")} disabled={disabled} />
            <MoneyField id="r-ship" label="Shipping per unit *" unit="BDT" value={v.shippingPerUnitBdt} onChange={money("shippingPerUnitBdt")} error={err("shippingPerUnitBdt")} disabled={disabled} />
            <MoneyField id="r-sell" label="Selling price *" unit="BDT" value={v.sellingPriceBdt} onChange={money("sellingPriceBdt")} error={err("sellingPriceBdt")} disabled={disabled} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="r-priority" label="Priority">
              <Select value={v.priority} onValueChange={(p) => set("priority", p as Priority)} disabled={disabled}>
                <SelectTrigger id="r-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="r-date" label="Target launch date" error={err("targetLaunchDate")}>
              <Input
                {...fieldA11y("r-date", err("targetLaunchDate"))}
                type="date"
                value={v.targetLaunchDate}
                onChange={(e) => set("targetLaunchDate", e.target.value)}
                disabled={disabled}
                className="num"
              />
            </Field>
          </div>
          <Field id="r-customer" label="Target customer" error={err("targetCustomer")}>
            <Textarea {...fieldA11y("r-customer", err("targetCustomer"))} rows={2} value={v.targetCustomer} onChange={(e) => set("targetCustomer", e.target.value)} disabled={disabled} />
          </Field>
          <Field id="r-problem" label="Problem it solves" error={err("problemSolved")}>
            <Textarea {...fieldA11y("r-problem", err("problemSolved"))} rows={2} value={v.problemSolved} onChange={(e) => set("problemSolved", e.target.value)} disabled={disabled} />
          </Field>
          <Field id="r-angle" label="Selling angle" error={err("sellingAngle")}>
            <Textarea {...fieldA11y("r-angle", err("sellingAngle"))} rows={2} value={v.sellingAngle} onChange={(e) => set("sellingAngle", e.target.value)} disabled={disabled} />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-meta text-slate-700">Reference links</legend>
            <p className="-mt-1 text-meta font-normal text-slate-500">Competitor ads, videos, listings</p>
            {v.referenceLinks.map((link, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  aria-label={`Reference link ${i + 1}`}
                  aria-invalid={errors[`referenceLinks`] ? true : undefined}
                  value={link}
                  onChange={(e) => set("referenceLinks", v.referenceLinks.map((l, j) => (j === i ? e.target.value : l)))}
                  placeholder="https://…"
                  inputMode="url"
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove link ${i + 1}`}
                  onClick={() => set("referenceLinks", v.referenceLinks.filter((_, j) => j !== i))}
                  disabled={disabled}
                >
                  <XIcon />
                </Button>
              </div>
            ))}
            {err("referenceLinks") ? <p className="text-meta text-rose-700">Each reference must be a full https:// link.</p> : null}
            {editable ? (
              <Button
                type="button"
                variant="brandSoft"
                size="sm"
                className="w-fit"
                onClick={() => set("referenceLinks", [...v.referenceLinks, ""])}
                disabled={disabled || v.referenceLinks.length >= 20}
              >
                <PlusIcon /> Add link
              </Button>
            ) : null}
          </fieldset>
        </section>
      </div>

      <aside className="grid content-start gap-4">
        {rates ? (
          <MarginCard margin={margin} band={band} courierPct={rates.courierChargePct} />
        ) : (
          <div className="surface rounded-panel p-4 text-body text-amber-800">
            Margin settings aren&apos;t set yet. An Admin needs to fill in Settings → Rates &amp; margins.
          </div>
        )}
        {mode === "research" ? <ChecklistPanel items={checklist} editable={editable} /> : null}
        {editable && mode === "admin" ? (
          <div className="surface sticky bottom-3 grid gap-2 rounded-panel p-3">
            <p className="text-meta font-normal text-slate-600">You&apos;re editing as Admin. Every change is logged on the timeline (old → new).</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onDone} disabled={pending} className="flex-1">
                Cancel
              </Button>
              <Button onClick={onSave} disabled={pending || !dirty} className="flex-1">
                <SaveIcon /> Save changes
              </Button>
            </div>
          </div>
        ) : null}
        {editable && mode === "research" ? (
          <div className="surface sticky bottom-3 grid gap-2 rounded-panel p-3">
            {blockers.length ? (
              <p className="text-meta font-normal text-slate-600">
                <span className="font-medium text-slate-800">Still needed:</span> {blockers.join(", ")}
              </p>
            ) : (
              <p className="text-meta font-normal text-emerald-800">Ready to submit. It goes to Product review for approval.</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onSave} disabled={pending || !dirty} className="flex-1">
                <SaveIcon /> Save draft
              </Button>
              <Button onClick={onSubmit} disabled={pending || blockers.length > 0} className="flex-1">
                Submit <ArrowRightIcon />
              </Button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function MoneyField({
  id,
  label,
  unit,
  value,
  onChange,
  error,
  disabled,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <Field id={id} label={label} error={error}>
      <div className="relative">
        <Input {...fieldA11y(id, error)} value={value} onChange={onChange} inputMode="decimal" className="num pr-12" placeholder="0.00" disabled={disabled} />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-meta text-slate-500">{unit}</span>
      </div>
    </Field>
  );
}

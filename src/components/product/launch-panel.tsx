"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RocketIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import Decimal from "decimal.js";
import { Field, fieldA11y } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatBdt } from "@/lib/format";
import { launchCampaignAction, saveLaunchDetailsAction } from "@/lib/server/actions/campaign";
import type { ProductDetail, TaskDTO } from "@/lib/server/queries/product";

export function LaunchPanel({ product, task, canManage }: { product: ProductDetail; task: TaskDTO; canManage: boolean }) {
  const router = useRouter();
  const c = product.campaign;
  const [url, setUrl] = useState(c?.adsManagerUrl ?? "");
  const [campaignId, setCampaignId] = useState(c?.metaCampaignId ?? "");
  const [budget, setBudget] = useState(c?.dailyBudgetUsd ?? "");
  const [notes, setNotes] = useState(c?.strategyNotes ?? "");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const open = task.status === "TODO" || task.status === "REVISION";
  const editable = canManage && open && product.stage === "READY_TO_LAUNCH";
  const missing = task.checklist.filter((i) => i.required && !i.checked).length;
  const usdRate = product.thresholds?.usdToBdtRate;
  const bdt =
    usdRate && /^\d+(\.\d+)?$/.test(budget) ? formatBdt(new Decimal(budget).times(usdRate).toDecimalPlaces(0).toString()) : null;
  const payload = { productId: product.id, adsManagerUrl: url, metaCampaignId: campaignId, dailyBudgetUsd: budget, strategyNotes: notes };

  if (!open) return null;

  return (
    <section className="grid gap-3 rounded-control border border-slate-200/80 bg-white p-3" aria-label="Campaign details">
      <Field id="l-url" label="Meta Ads Manager campaign link *" error={errors.adsManagerUrl?.[0]}>
        <Input {...fieldA11y("l-url", errors.adsManagerUrl?.[0])} value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="https://adsmanager.facebook.com/…" disabled={!editable} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="l-id" label="Campaign ID" error={errors.metaCampaignId?.[0]}>
          <Input {...fieldA11y("l-id", errors.metaCampaignId?.[0])} value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="num" disabled={!editable} />
        </Field>
        <Field id="l-budget" label="Daily budget (USD) *" hint={bdt ? `≈ ${bdt} per day` : undefined} error={errors.dailyBudgetUsd?.[0]}>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-body text-slate-500">$</span>
            <Input {...fieldA11y("l-budget", errors.dailyBudgetUsd?.[0], Boolean(bdt))} value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="num pl-7" placeholder="25" disabled={!editable} />
          </div>
        </Field>
      </div>
      <Field id="l-notes" label="Strategy notes" error={errors.strategyNotes?.[0]}>
        <Textarea {...fieldA11y("l-notes", errors.strategyNotes?.[0])} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Audience, placements, testing plan…" disabled={!editable} />
      </Field>
      {editable ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-meta font-normal text-slate-500">
            {missing ? `Tick ${missing} more launch checklist item${missing === 1 ? "" : "s"} to launch.` : "Launching moves the product to Live."}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await saveLaunchDetailsAction(payload);
                  if (r.ok) {
                    setErrors({});
                    toast.success(r.message);
                    router.refresh();
                  } else {
                    setErrors(r.fieldErrors ?? {});
                    toast.error(r.error);
                  }
                })
              }
            >
              <SaveIcon /> Save
            </Button>
            <Button
              disabled={pending || missing > 0 || !url.trim() || !budget.trim()}
              onClick={() =>
                startTransition(async () => {
                  const r = await launchCampaignAction(payload);
                  if (r.ok) {
                    setErrors({});
                    toast.success(r.message);
                    router.refresh();
                  } else {
                    setErrors(r.fieldErrors ?? {});
                    toast.error(r.error);
                  }
                })
              }
            >
              <RocketIcon /> Launch campaign
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-meta font-normal text-slate-500">The media buyer launches the campaign once every creative is approved.</p>
      )}
    </section>
  );
}

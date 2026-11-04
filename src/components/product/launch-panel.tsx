"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RocketIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { launchCampaignAction, saveLaunchDetailsAction } from "@/lib/server/actions/campaign";
import type { ProductDetail, TaskDTO } from "@/lib/server/queries/product";
import { CampaignFields, campaignValues, type CampaignValues } from "./campaign-edit";

export function LaunchPanel({ product, task, canManage }: { product: ProductDetail; task: TaskDTO; canManage: boolean }) {
  const router = useRouter();
  const draft = product.campaigns.find((c) => !c.launchedAt);
  const [v, setV] = useState<CampaignValues>(() => ({ ...campaignValues(draft), name: draft?.name ?? "" }));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const open = task.status === "TODO" || task.status === "REVISION";
  const editable = canManage && open && product.stage === "READY_TO_LAUNCH";
  const missing = task.checklist.filter((i) => i.required && !i.checked).length;
  const payload = { productId: product.id, ...v };

  if (!open) return null;

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string[] | undefined> }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        setErrors({});
        toast.success(r.message ?? "Saved");
        router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
      }
    });

  return (
    <section className="grid gap-3 rounded-control border border-slate-200/80 bg-white p-3" aria-label="Campaign details">
      <CampaignFields idPrefix="l" v={v} onChange={setV} errors={errors} usdRate={product.thresholds?.usdToBdtRate} disabled={!editable} />
      {editable ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-meta font-normal text-slate-500">
            {missing ? `Tick ${missing} more launch checklist item${missing === 1 ? "" : "s"} to launch.` : "Launching moves the product to Live. You can add more campaigns after."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={pending} onClick={() => run(() => saveLaunchDetailsAction(payload))}>
              <SaveIcon /> Save
            </Button>
            <Button
              disabled={pending || missing > 0 || !v.name.trim() || !v.type || !v.adsManagerUrl.trim() || !v.dailyBudgetUsd.trim()}
              onClick={() => run(() => launchCampaignAction(payload))}
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

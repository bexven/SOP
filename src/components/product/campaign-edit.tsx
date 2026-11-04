"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import Decimal from "decimal.js";
import type { CampaignStatus, CampaignType } from "@/generated/prisma/enums";
import { Field, fieldA11y } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPES } from "@/lib/domain/campaigns";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUSES } from "@/lib/domain/labels";
import { formatBdt } from "@/lib/format";
import { createCampaignAction, saveCampaignDetailsAction, setCampaignStatusAction } from "@/lib/server/actions/campaign";
import type { CampaignDTO, ProductDetail } from "@/lib/server/queries/product";

export type CampaignValues = {
  name: string;
  type: CampaignType | "";
  adsManagerUrl: string;
  metaCampaignId: string;
  dailyBudgetUsd: string;
  strategyNotes: string;
};

export function campaignValues(c: Partial<CampaignDTO> | null | undefined): CampaignValues {
  return {
    name: c?.name ?? "",
    type: c?.type ?? "",
    adsManagerUrl: c?.adsManagerUrl ?? "",
    metaCampaignId: c?.metaCampaignId ?? "",
    dailyBudgetUsd: c?.dailyBudgetUsd ?? "",
    strategyNotes: c?.strategyNotes ?? "",
  };
}

/** Name, type, Ads Manager link, ID, budget and strategy: shared by launch, new and edit. */
export function CampaignFields({
  idPrefix,
  v,
  onChange,
  errors,
  usdRate,
  disabled,
}: {
  idPrefix: string;
  v: CampaignValues;
  onChange: (v: CampaignValues) => void;
  errors: Record<string, string[] | undefined>;
  usdRate?: string | null;
  disabled?: boolean;
}) {
  const err = (k: string) => errors[k]?.[0];
  const id = (k: string) => `${idPrefix}-${k}`;
  const bdt = usdRate && /^\d+(\.\d+)?$/.test(v.dailyBudgetUsd) ? formatBdt(new Decimal(v.dailyBudgetUsd).times(usdRate).toDecimalPlaces(0).toString()) : null;
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Field id={id("name")} label="Campaign name *" hint="So everyone can tell campaigns apart, e.g. “Video – women 25-40”" error={err("name")}>
          <Input {...fieldA11y(id("name"), err("name"), true)} value={v.name} onChange={(e) => onChange({ ...v, name: e.target.value })} maxLength={80} disabled={disabled} />
        </Field>
        <Field id={id("type")} label="Type *" error={err("type")}>
          <Select value={v.type} onValueChange={(t) => onChange({ ...v, type: t as CampaignType })} disabled={disabled}>
            <SelectTrigger {...fieldA11y(id("type"), err("type"))}>
              <SelectValue placeholder="Choose a type" />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {CAMPAIGN_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field id={id("url")} label="Meta Ads Manager campaign link *" error={err("adsManagerUrl")}>
        <Input {...fieldA11y(id("url"), err("adsManagerUrl"))} value={v.adsManagerUrl} onChange={(e) => onChange({ ...v, adsManagerUrl: e.target.value })} inputMode="url" placeholder="https://adsmanager.facebook.com/…" disabled={disabled} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={id("mid")} label="Campaign ID" error={err("metaCampaignId")}>
          <Input {...fieldA11y(id("mid"), err("metaCampaignId"))} value={v.metaCampaignId} onChange={(e) => onChange({ ...v, metaCampaignId: e.target.value })} className="num" disabled={disabled} />
        </Field>
        <Field id={id("budget")} label="Daily budget (USD) *" hint={bdt ? `≈ ${bdt} per day` : undefined} error={err("dailyBudgetUsd")}>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-body text-slate-500">$</span>
            <Input
              {...fieldA11y(id("budget"), err("dailyBudgetUsd"), Boolean(bdt))}
              value={v.dailyBudgetUsd}
              onChange={(e) => onChange({ ...v, dailyBudgetUsd: e.target.value.replace(/[^\d.]/g, "") })}
              inputMode="decimal"
              className="num pl-7"
              placeholder="25"
              disabled={disabled}
            />
          </div>
        </Field>
      </div>
      <Field id={id("notes")} label="Strategy notes" error={err("strategyNotes")}>
        <Textarea {...fieldA11y(id("notes"), err("strategyNotes"))} value={v.strategyNotes} onChange={(e) => onChange({ ...v, strategyNotes: e.target.value })} rows={3} placeholder="Audience, placements, testing plan…" disabled={disabled} />
      </Field>
    </div>
  );
}

/** "New campaign" (live products) or "Edit" one campaign. */
export function CampaignDialogButton({ product, campaign }: { product: ProductDetail; campaign?: CampaignDTO }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<CampaignValues>(campaignValues(campaign));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const next = product.campaigns.reduce((m, c) => Math.max(m, c.number), 0) + 1;
  return (
    <>
      {campaign ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Edit ${campaign.name}`}>
          <PencilIcon /> Edit
        </Button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <PlusIcon /> New campaign
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) {
            setV(campaignValues(campaign));
            setErrors({});
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{campaign ? `Edit campaign #${campaign.number}` : `New campaign #${next}`}</DialogTitle>
            <DialogDescription>{campaign ? "Changes are logged on the timeline." : "It starts as running. Name it so the team can see which campaign performs better."}</DialogDescription>
          </DialogHeader>
          <CampaignFields idPrefix={campaign ? `ce-${campaign.number}` : "cn"} v={v} onChange={setV} errors={errors} usdRate={product.thresholds?.usdToBdtRate} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = campaign
                    ? await saveCampaignDetailsAction({ productId: product.id, campaignId: campaign.id, ...v })
                    : await createCampaignAction({ productId: product.id, ...v });
                  if (r.ok) {
                    toast.success(r.message ?? "Saved");
                    setOpen(false);
                    router.refresh();
                  } else {
                    setErrors(r.fieldErrors ?? {});
                    toast.error(r.error);
                  }
                })
              }
            >
              {campaign ? "Save" : "Start campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Pause / restart / stop one campaign. */
export function CampaignStatusButton({ product, campaign }: { product: ProductDetail; campaign: CampaignDTO }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const options = CAMPAIGN_STATUSES.filter((s) => s !== campaign.status);
  const [status, setStatus] = useState<CampaignStatus>(options[0] ?? "RUNNING");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Change status
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{campaign.name}: change status</DialogTitle>
            <DialogDescription>Currently {CAMPAIGN_STATUS_LABELS[campaign.status].toLowerCase()}. Every change is logged.</DialogDescription>
          </DialogHeader>
          <Field id={`cs-${campaign.id}`} label="New status">
            <Select value={status} onValueChange={(s) => setStatus(s as CampaignStatus)}>
              <SelectTrigger id={`cs-${campaign.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((s) => (
                  <SelectItem key={s} value={s}>
                    {CAMPAIGN_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id={`csn-${campaign.id}`} label="Note (optional)">
            <Textarea id={`csn-${campaign.id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Pausing while new creative is made" />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await setCampaignStatusAction({ productId: product.id, campaignId: campaign.id, status, note });
                  if (r.ok) {
                    toast.success(r.message ?? "Updated");
                    setOpen(false);
                    setNote("");
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              Update status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

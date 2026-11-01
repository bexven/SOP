"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveLaunchDetailsAction } from "@/lib/server/actions/campaign";
import type { ProductDetail } from "@/lib/server/queries/product";

/** Edit campaign details after launch (budget, link, ID, strategy). */
export function CampaignEditButton({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const c = product.campaign!;
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(c.adsManagerUrl ?? "");
  const [id, setId] = useState(c.metaCampaignId ?? "");
  const [budget, setBudget] = useState(c.dailyBudgetUsd ?? "");
  const [notes, setNotes] = useState(c.strategyNotes ?? "");
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <PencilIcon /> Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit campaign details</DialogTitle>
          </DialogHeader>
          <Field id="ce-url" label="Meta Ads Manager link">
            <Input id="ce-url" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="ce-id" label="Campaign ID">
              <Input id="ce-id" value={id} onChange={(e) => setId(e.target.value)} className="num" />
            </Field>
            <Field id="ce-b" label="Daily budget (USD)">
              <Input id="ce-b" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="num" />
            </Field>
          </div>
          <Field id="ce-n" label="Strategy notes">
            <Textarea id="ce-n" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await saveLaunchDetailsAction({ productId: product.id, adsManagerUrl: url, metaCampaignId: id, dailyBudgetUsd: budget, strategyNotes: notes });
                  if (r.ok) {
                    toast.success(r.message);
                    setOpen(false);
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

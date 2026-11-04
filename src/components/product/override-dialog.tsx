"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Priority } from "@/generated/prisma/enums";
import { Field, fieldA11y } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/domain/labels";
import type { ShippingMethodKey } from "@/lib/domain/margin";
import { overrideProductAction } from "@/lib/server/actions/exceptions";
import type { ProductDetail } from "@/lib/server/queries/product";

/** Admin override of data fields. Stage/status are never editable here. Every change is logged old → new. */
export function OverrideDialog({ open, onClose, product }: { open: boolean; onClose: () => void; product: ProductDetail }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">{open ? <OverrideForm product={product} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}

function OverrideForm({ product, onClose }: { product: ProductDetail; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: product.name,
    supplierUrl: product.supplierUrl ?? "",
    imageUrl: product.imageUrl ?? "",
    chinaPriceBdt: product.chinaPriceBdt ?? "",
    weightKg: product.weightKg ?? "",
    shippingMethod: (product.shippingMethod ?? "") as "" | ShippingMethodKey,
    sellingPriceBdt: product.sellingPriceBdt ?? "",
    courierChargePct: product.courierChargePct,
    problemSolved: product.problemSolved ?? "",
    referenceLinks: product.referenceLinks.join("\n"),
    priority: product.priority as Priority,
    targetLaunchDate: product.targetLaunchDate ?? "",
    mediaBuyerId: product.mediaBuyer?.id ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const err = (k: string) => errors[k]?.[0];
  const mediaBuyers = product.people.filter((p) => p.role === "MEDIA_BUYER");

  const text = (k: keyof typeof v, label: string, opts: { mono?: boolean; area?: boolean } = {}) => {
    const id = `ov-${k}`;
    return (
      <Field id={id} label={label} error={err(k)}>
        {opts.area ? (
          <Textarea {...fieldA11y(id, err(k))} value={v[k] as string} onChange={set(k)} rows={2} />
        ) : (
          <Input {...fieldA11y(id, err(k))} value={v[k] as string} onChange={set(k)} className={opts.mono ? "num" : undefined} />
        )}
      </Field>
    );
  };

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await overrideProductAction({
            productId: product.id,
            ...v,
            referenceLinks: v.referenceLinks.split(/\s+/).map((l) => l.trim()).filter(Boolean),
          });
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            toast.error(r.error);
            return;
          }
          toast.success(r.message);
          onClose();
          router.refresh();
        });
      }}
    >
      <DialogHeader>
        <DialogTitle>Admin override</DialogTitle>
        <DialogDescription>Edit any field. Every change is recorded on the timeline with its old and new value. Stage changes still go through Send back / Kill.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        {text("name", "Name")}
        <Field id="ov-priority" label="Priority">
          <Select value={v.priority} onValueChange={(p) => setV({ ...v, priority: p as Priority })}>
            <SelectTrigger id="ov-priority">
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
        {text("supplierUrl", "Supplier link")}
        {text("imageUrl", "Image URL")}
        {text("chinaPriceBdt", "China price / unit (BDT)", { mono: true })}
        {text("weightKg", "Weight / unit (kg)", { mono: true })}
        <Field id="ov-method" label="Shipping by" hint="Shipping = weight × this method's rate per kg">
          <Select value={v.shippingMethod || "none"} onValueChange={(m) => setV({ ...v, shippingMethod: m === "none" ? "" : (m as ShippingMethodKey) })}>
            <SelectTrigger id="ov-method" aria-describedby="ov-method-hint">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              <SelectItem value="AIR">Air</SelectItem>
              <SelectItem value="SEA">Sea</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {text("sellingPriceBdt", "Selling price (BDT)", { mono: true })}
        {text("targetLaunchDate", "Target launch (YYYY-MM-DD)", { mono: true })}
        {text("courierChargePct", "Courier % snapshot", { mono: true })}
        <Field id="ov-mb" label="Media buyer">
          <Select value={v.mediaBuyerId || "none"} onValueChange={(id) => setV({ ...v, mediaBuyerId: id === "none" ? "" : id })}>
            <SelectTrigger id="ov-mb">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {mediaBuyers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {text("problemSolved", "Problem it solves", { area: true })}
      <Field id="ov-links" label="Reference links (one per line)" error={err("referenceLinks")}>
        <Textarea {...fieldA11y("ov-links", err("referenceLinks"))} value={v.referenceLinks} onChange={set("referenceLinks")} rows={3} className="font-mono text-[13px]" />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          Save override
        </Button>
      </DialogFooter>
    </form>
  );
}

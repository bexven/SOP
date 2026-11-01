"use client";

import { BrandPicker } from "@/components/common/brand-picker";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Priority } from "@/generated/prisma/enums";
import { Field, fieldA11y } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/domain/labels";
import { createProductAction } from "@/lib/server/actions/product";

/** "Add product" dialog on the Research page (also opened by the `C` shortcut via /research?add=1). */
export function NewProductDialog({ open, onOpenChange, brands }: { open: boolean; onOpenChange: (o: boolean) => void; brands: { id: string; name: string; color: string }[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <NewProductForm brands={brands} onDone={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function NewProductForm({ onDone, brands }: { onDone: () => void; brands: { id: string; name: string; color: string }[] }) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(brands.length === 1 ? brands[0]!.id : "");
  const [name, setName] = useState("");
  const [supplierUrl, setSupplierUrl] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await createProductAction({ brandId, name, supplierUrl, priority });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Product created", { description: "Fill in the research, then submit." });
      onDone();
      router.push(`/products/${r.data!.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <DialogHeader>
        <DialogTitle>Add a product to research</DialogTitle>
        <DialogDescription>Give it a name now. On the next screen you fill in prices, the margin check and the SOP checklist, then submit.</DialogDescription>
      </DialogHeader>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-meta text-slate-700">Brand *</legend>
        <BrandPicker brands={brands} value={brandId} onChange={setBrandId} />
        {errors.brandId?.[0] ? <p className="text-meta text-rose-700">{errors.brandId[0]}</p> : null}
      </fieldset>
      <Field id="np-name" label="Product name" error={errors.name?.[0]}>
        <Input {...fieldA11y("np-name", errors.name?.[0])} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Foldable LED desk lamp" />
      </Field>
      <Field id="np-supplier" label="Supplier link (optional)" error={errors.supplierUrl?.[0]}>
        <Input {...fieldA11y("np-supplier", errors.supplierUrl?.[0])} value={supplierUrl} onChange={(e) => setSupplierUrl(e.target.value)} inputMode="url" placeholder="https://detail.1688.com/…" />
      </Field>
      <Field id="np-priority" label="Priority">
        <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
          <SelectTrigger id="np-priority">
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
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !brandId}>
          Add & start research
        </Button>
      </DialogFooter>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { LockIcon, PlusIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { BrandPill } from "@/components/common/pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveBrandAction } from "@/lib/server/actions/brands";
import type { BrandDTO } from "@/lib/server/queries/product";
import { cn } from "@/lib/utils";
import { DEFAULT_BRAND_COLOR, HEX_COLOR } from "@/lib/brand-color";
import { SettingsCard } from "./settings-card";

/** Quick picks; any hex colour can be typed or chosen with the picker. */
const PRESETS = ["#15803D", "#0369A1", "#4F46E5", "#7C3AED", "#BE123C", "#C2410C", "#B45309", "#334155"] as const;

export function BrandEditor({ brands, canRestrict }: { brands: BrandDTO[]; canRestrict: boolean }) {
  return (
    <SettingsCard title="Brands" description="Every new product is added for one brand. Inactive brands stay on old products but can't be picked for new ones. Restricted brands (🔒) are only visible to people given access on Roles & permissions.">
      <ul className="grid gap-2">
        {brands.map((b) => (
          <BrandRow key={b.id + b.name + b.color + b.active + b.restricted} brand={b} canRestrict={canRestrict} />
        ))}
        <BrandRow canRestrict={canRestrict} />
      </ul>
    </SettingsCard>
  );
}

function BrandRow({ brand, canRestrict }: { brand?: BrandDTO; canRestrict: boolean }) {
  const [restricted, setRestricted] = useState(brand?.restricted ?? false);
  const [name, setName] = useState(brand?.name ?? "");
  const [color, setColor] = useState<string>(brand && HEX_COLOR.test(brand.color) ? brand.color : DEFAULT_BRAND_COLOR);
  const [pending, startTransition] = useTransition();
  const save = (active = brand?.active ?? true) =>
    startTransition(async () => {
      const r = await saveBrandAction({ id: brand?.id, name, color, active, ...(canRestrict ? { restricted } : {}) });
      if (r.ok) {
        toast.success(r.message);
        if (!brand) setName("");
      } else toast.error(r.error);
    });
  return (
    <li className={cn("flex flex-col gap-2 rounded-control border border-slate-200/80 p-2.5 sm:flex-row sm:items-center", brand && !brand.active && "bg-slate-50")}>
      <div className="w-24 shrink-0">{name ? <BrandPill brand={{ name, color }} /> : <span className="text-meta text-slate-500">New brand</span>}</div>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name" aria-label="Brand name" className="sm:flex-1" />
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex gap-1.5" role="radiogroup" aria-label="Colour">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color.toUpperCase() === c}
              aria-label={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={cn("size-6 rounded-full ring-offset-2", color.toUpperCase() === c && "ring-2 ring-slate-900/70")}
            />
          ))}
        </div>
        <input
          type="color"
          value={HEX_COLOR.test(color) ? color : DEFAULT_BRAND_COLOR}
          onChange={(e) => setColor(e.target.value.toUpperCase())}
          aria-label="Custom colour"
          className="size-7 cursor-pointer rounded-full border border-slate-200 bg-white p-0.5"
        />
        <Input value={color} onChange={(e) => setColor(e.target.value.trim())} aria-label="Colour hex code" className="num h-8 w-24" maxLength={7} />
      </div>
      {canRestrict ? (
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-meta text-slate-700" title="Only people you give access to (Roles & permissions) can see this brand's products">
          <Checkbox checked={restricted} onCheckedChange={(v) => setRestricted(v === true)} aria-label={`${name || "New brand"}: restricted`} />
          <LockIcon className="size-3.5 text-slate-500" /> Restricted
        </label>
      ) : brand?.restricted ? (
        <span className="flex shrink-0 items-center gap-1 text-meta text-slate-600">
          <LockIcon className="size-3.5" /> Restricted
        </span>
      ) : null}
      <div className="flex gap-2">
        {brand ? (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => save(!brand.active)}>
            {brand.active ? "Deactivate" : "Reactivate"}
          </Button>
        ) : null}
        <Button size="sm" disabled={pending || name.trim().length < 2 || !HEX_COLOR.test(color)} onClick={() => save()}>
          {brand ? "Save" : (<><PlusIcon /> Add</>)}
        </Button>
      </div>
    </li>
  );
}

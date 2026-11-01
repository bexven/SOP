"use client";

import { useState, useTransition } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { BrandPill } from "@/components/common/pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveBrandAction } from "@/lib/server/actions/brands";
import type { BrandDTO } from "@/lib/server/queries/product";
import { cn } from "@/lib/utils";
import { SettingsCard } from "./settings-card";

const COLORS = ["sky", "amber", "violet", "emerald", "rose", "orange", "indigo", "slate"] as const;
const SWATCH: Record<string, string> = {
  sky: "bg-sky-500", amber: "bg-amber-500", violet: "bg-violet-500", emerald: "bg-emerald-500",
  rose: "bg-rose-500", orange: "bg-orange-500", indigo: "bg-indigo-500", slate: "bg-slate-500",
};

export function BrandEditor({ brands }: { brands: BrandDTO[] }) {
  return (
    <SettingsCard title="Brands" description="Every new product is added for one brand. Inactive brands stay on old products but can't be picked for new ones.">
      <ul className="grid gap-2">
        {brands.map((b) => (
          <BrandRow key={b.id + b.name + b.color + b.active} brand={b} />
        ))}
        <BrandRow />
      </ul>
    </SettingsCard>
  );
}

function BrandRow({ brand }: { brand?: BrandDTO }) {
  const [name, setName] = useState(brand?.name ?? "");
  const [color, setColor] = useState<string>(brand?.color ?? "indigo");
  const [pending, startTransition] = useTransition();
  const save = (active = brand?.active ?? true) =>
    startTransition(async () => {
      const r = await saveBrandAction({ id: brand?.id, name, color: color as (typeof COLORS)[number], active });
      if (r.ok) {
        toast.success(r.message);
        if (!brand) setName("");
      } else toast.error(r.error);
    });
  return (
    <li className={cn("flex flex-col gap-2 rounded-control border border-slate-200/80 p-2.5 sm:flex-row sm:items-center", brand && !brand.active && "bg-slate-50")}>
      <div className="w-24 shrink-0">{name ? <BrandPill brand={{ name, color }} /> : <span className="text-meta text-slate-500">New brand</span>}</div>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name" aria-label="Brand name" className="sm:flex-1" />
      <div className="flex gap-1.5" role="radiogroup" aria-label="Colour">
        {COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} className={cn("size-6 rounded-full ring-offset-2", SWATCH[c], color === c && "ring-2 ring-slate-900/70")} />
        ))}
      </div>
      <div className="flex gap-2">
        {brand ? (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => save(!brand.active)}>
            {brand.active ? "Deactivate" : "Reactivate"}
          </Button>
        ) : null}
        <Button size="sm" disabled={pending || name.trim().length < 2} onClick={() => save()}>
          {brand ? "Save" : (<><PlusIcon /> Add</>)}
        </Button>
      </div>
    </li>
  );
}

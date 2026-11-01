"use client";

import { brandSolid, DEFAULT_BRAND_COLOR, HEX_COLOR } from "@/lib/brand-color";
import { cn } from "@/lib/utils";

type BrandOption = { id: string; name: string; color: string };

/** Radio buttons for choosing a brand; the selected one fills with that brand's colour. */
export function BrandPicker({
  brands,
  value,
  onChange,
  disabled,
}: {
  brands: BrandOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Brand">
      {brands.map((b) => {
        const color = HEX_COLOR.test(b.color) ? b.color : DEFAULT_BRAND_COLOR;
        const selected = value === b.id;
        return (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(b.id)}
            style={selected ? { backgroundColor: brandSolid(color), boxShadow: `inset 0 0 0 1px ${brandSolid(color)}` } : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-control px-4 py-2 text-body font-semibold ring-1 ring-inset transition-colors disabled:cursor-not-allowed",
              selected ? "text-white ring-transparent" : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50",
            )}
          >
            <span className={cn("size-2.5 rounded-full", selected && "ring-2 ring-white/80")} style={{ backgroundColor: selected ? "#FFFFFF" : color }} aria-hidden />
            {b.name}
          </button>
        );
      })}
    </div>
  );
}

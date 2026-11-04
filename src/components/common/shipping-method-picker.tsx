"use client";

import { PlaneIcon, ShipIcon } from "lucide-react";
import { SHIPPING_METHOD_LABELS, type ShippingMethodKey } from "@/lib/domain/margin";
import { formatBdt } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Air or Sea: a two-option radio group showing each method's rate per kg. */
export function ShippingMethodPicker({
  id = "r-method",
  value,
  onChange,
  rates,
  error,
  disabled,
}: {
  id?: string;
  value: "" | ShippingMethodKey;
  onChange: (m: ShippingMethodKey) => void;
  rates: Record<ShippingMethodKey, string | null>;
  error?: string;
  disabled?: boolean;
}) {
  const options: { key: ShippingMethodKey; icon: React.ReactNode }[] = [
    { key: "AIR", icon: <PlaneIcon className="size-4" aria-hidden /> },
    { key: "SEA", icon: <ShipIcon className="size-4" aria-hidden /> },
  ];
  return (
    <div className="grid gap-1.5">
      <span id={`${id}-label`} className="text-meta text-slate-700 select-none">
        Shipping by *
      </span>
      <div role="radiogroup" aria-labelledby={`${id}-label`} aria-describedby={error ? `${id}-error` : undefined} className="flex flex-wrap gap-2">
        {options.map(({ key, icon }) => {
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(key)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-control px-3.5 text-body font-medium ring-1 transition-colors duration-150 ease-out ring-inset focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed",
                selected ? "bg-primary text-primary-foreground ring-primary" : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {icon}
              {SHIPPING_METHOD_LABELS[key]}
              <span className={cn("num text-meta", selected ? "text-primary-foreground" : "text-slate-500")}>
                {rates[key] ? `${formatBdt(rates[key]!)}/kg` : "rate not set"}
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-meta text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

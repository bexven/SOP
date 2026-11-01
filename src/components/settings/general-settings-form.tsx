"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, fieldA11y } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { updateGeneralSettingsAction } from "@/lib/server/actions/settings";
import { SettingsCard } from "./settings-card";

type Values = {
  rmbToBdtRate: string;
  usdToBdtRate: string;
  courierChargePct: string;
  healthyMarginPct: string;
  thinMarginPct: string;
};

const EMPTY: Values = { rmbToBdtRate: "", usdToBdtRate: "", courierChargePct: "2", healthyMarginPct: "", thinMarginPct: "" };

export function GeneralSettingsForm({ initial }: { initial: (Values & { updatedAt: string }) | null }) {
  const [values, setValues] = useState<Values>(initial ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value.replace(/[^\d.]/g, "") }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await updateGeneralSettingsAction(values);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      setErrors({});
      toast.success(r.message ?? "Saved");
    });
  }

  const num = (key: keyof Values, label: string, opts: { suffix?: string; prefix?: string; hint?: string }) => {
    const id = `settings-${key}`;
    const error = errors[key]?.[0];
    return (
      <Field id={id} label={label} hint={opts.hint} error={error}>
        <div className="relative">
          {opts.prefix ? (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-body text-slate-500">
              {opts.prefix}
            </span>
          ) : null}
          <Input
            {...fieldA11y(id, error, Boolean(opts.hint))}
            value={values[key]}
            onChange={set(key)}
            inputMode="decimal"
            className={`num ${opts.prefix ? "pl-8" : ""} ${opts.suffix ? "pr-12" : ""}`}
          />
          {opts.suffix ? (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-body text-slate-500">
              {opts.suffix}
            </span>
          ) : null}
        </div>
      </Field>
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <SettingsCard
        title="Rates & margins"
        description="Used by the live margin check. Each product keeps a snapshot of the rate it was researched with, so changes here never alter old records."
        footer={
          <>
            {initial ? (
              <span className="mr-auto text-meta text-slate-500">
                Last saved <span className="num">{formatDateTime(new Date(initial.updatedAt))}</span>
              </span>
            ) : (
              <span className="mr-auto text-meta text-amber-800">Not configured yet</span>
            )}
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {num("rmbToBdtRate", "RMB → BDT rate", { suffix: "BDT", hint: "Reference only. Product prices are entered in BDT." })}
          {num("usdToBdtRate", "USD → BDT rate", { suffix: "BDT", hint: "Taka per 1 US dollar ($)" })}
          {num("courierChargePct", "Courier charge", { suffix: "%", hint: "Percent of the selling price" })}
          <div className="hidden sm:block" />
          {num("healthyMarginPct", "Healthy margin", { suffix: "%", hint: "At or above this is green" })}
          {num("thinMarginPct", "Thin margin", { suffix: "%", hint: "Below this is red; in between is amber" })}
        </div>
        <MarginBands healthy={values.healthyMarginPct} thin={values.thinMarginPct} />
      </SettingsCard>
    </form>
  );
}

function MarginBands({ healthy, thin }: { healthy: string; thin: string }) {
  const h = Number(healthy);
  const t = Number(thin);
  if (!healthy || !thin || Number.isNaN(h) || Number.isNaN(t) || t >= h) return null;
  return (
    <div className="mt-5 grid grid-cols-3 gap-1.5 text-meta" aria-label="Margin badge preview">
      <span className="rounded-md bg-rose-50 px-2 py-1.5 text-rose-700 ring-1 ring-rose-100 ring-inset">
        Thin · <span className="num">&lt; {t}%</span>
      </span>
      <span className="rounded-md bg-amber-50 px-2 py-1.5 text-amber-800 ring-1 ring-amber-100 ring-inset">
        OK · <span className="num">{t}–{h}%</span>
      </span>
      <span className="rounded-md bg-emerald-50 px-2 py-1.5 text-emerald-800 ring-1 ring-emerald-100 ring-inset">
        Healthy · <span className="num">≥ {h}%</span>
      </span>
    </div>
  );
}

import type { ProductStage } from "@/generated/prisma/enums";

/** Time-in-stage maths for the timeline and the bottleneck view (pure). */

export type Transition = { toStage: ProductStage; at: Date };

export type Stint = { stage: ProductStage; start: Date; end: Date | null };

const TERMINAL: ProductStage[] = ["COMPLETED", "KILLED"];

/** Consecutive stints from a product's transitions (oldest first). Terminal stages have no stint. */
export function stints(transitions: Transition[]): Stint[] {
  const sorted = [...transitions].sort((a, b) => a.at.getTime() - b.at.getTime());
  const out: Stint[] = [];
  sorted.forEach((t, i) => {
    if (TERMINAL.includes(t.toStage)) return;
    out.push({ stage: t.toStage, start: t.at, end: sorted[i + 1]?.at ?? null });
  });
  return out;
}

/** Total milliseconds spent in each stage (an open stint counts up to `now`). */
export function timeInStages(transitions: Transition[], now: Date): Partial<Record<ProductStage, number>> {
  const totals: Partial<Record<ProductStage, number>> = {};
  for (const s of stints(transitions)) {
    const ms = (s.end ?? now).getTime() - s.start.getTime();
    totals[s.stage] = (totals[s.stage] ?? 0) + Math.max(0, ms);
  }
  return totals;
}

/** Average duration of finished stints per stage across products. */
export function averageStageDurations(
  products: Transition[][],
): Partial<Record<ProductStage, { avgMs: number; count: number }>> {
  const acc: Partial<Record<ProductStage, { total: number; count: number }>> = {};
  for (const transitions of products) {
    for (const s of stints(transitions)) {
      if (!s.end) continue;
      const entry = (acc[s.stage] ??= { total: 0, count: 0 });
      entry.total += s.end.getTime() - s.start.getTime();
      entry.count += 1;
    }
  }
  const out: Partial<Record<ProductStage, { avgMs: number; count: number }>> = {};
  for (const [stage, v] of Object.entries(acc) as [ProductStage, { total: number; count: number }][]) {
    out[stage] = { avgMs: v.total / v.count, count: v.count };
  }
  return out;
}

/** "3d 4h", "5h 20m", "12m", "<1m". */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "<1m";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return hours ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return mins ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}

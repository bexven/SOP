/**
 * Due dates and Dhaka-day buckets (pure). Bangladesh is UTC+6 all year (no
 * DST), so a fixed offset is exact.
 */

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DueBucket = "overdue" | "today" | "upcoming";

export function dueAtFrom(start: Date, slaHours: number | null | undefined): Date | null {
  if (!slaHours || slaHours <= 0) return null;
  return new Date(start.getTime() + slaHours * 60 * 60 * 1000);
}

/** Days since epoch for the calendar day in Dhaka. */
export function dhakaDayNumber(date: Date): number {
  return Math.floor((date.getTime() + DHAKA_OFFSET_MS) / DAY_MS);
}

/** Overdue = past its due time; today = later today (Dhaka); otherwise upcoming. */
export function dueBucket(dueAt: Date | null, now: Date): DueBucket | null {
  if (!dueAt) return null;
  if (dueAt.getTime() < now.getTime()) return "overdue";
  if (dhakaDayNumber(dueAt) === dhakaDayNumber(now)) return "today";
  return "upcoming";
}

/** Start of the given Dhaka calendar day, as a UTC instant. */
export function startOfDhakaDay(date: Date): Date {
  return new Date(dhakaDayNumber(date) * DAY_MS - DHAKA_OFFSET_MS);
}

/** A due pill label such as "Overdue 2d", "Due 5:00 pm", "Tomorrow", "Nov 12". */
export function dueLabel(dueAt: Date, now: Date): string {
  const bucket = dueBucket(dueAt, now)!;
  if (bucket === "overdue") {
    const hours = Math.floor((now.getTime() - dueAt.getTime()) / 3_600_000);
    if (hours < 1) return "Overdue";
    if (hours < 24) return `Overdue ${hours}h`;
    return `Overdue ${Math.floor(hours / 24)}d`;
  }
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(dueAt);
  if (bucket === "today") return `Due ${time}`;
  const days = dhakaDayNumber(dueAt) - dhakaDayNumber(now);
  if (days === 1) return `Tomorrow ${time}`;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" }).format(dueAt);
}

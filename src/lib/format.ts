/**
 * Formatting helpers. All dates are shown in Asia/Dhaka (UTC+6, no DST);
 * BDT uses Indian-style lakh grouping (৳1,25,000).
 */

export const TIMEZONE = "Asia/Dhaka";

type Numeric = number | string | { toString(): string };

function toNumber(value: Numeric): number {
  return typeof value === "number" ? value : Number(value.toString());
}

const bdtFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export function formatBdt(value: Numeric): string {
  const n = toNumber(value);
  const sign = n < 0 ? "−" : "";
  return `${sign}৳${bdtFormatter.format(Math.abs(n))}`;
}

const plainFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });

export function formatRmb(value: Numeric): string {
  return `¥${plainFormatter.format(toNumber(value))}`;
}

export function formatUsd(value: Numeric): string {
  return `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toNumber(value))}`;
}

export function formatNumber(value: Numeric): string {
  return plainFormatter.format(toNumber(value));
}

export function formatPct(value: Numeric): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(toNumber(value))}%`;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

/** Product reference such as PRD-0042. */
export function productRef(number: number): string {
  return `PRD-${String(number).padStart(4, "0")}`;
}

import { z } from "zod";
import { PIN_REGEX } from "@/lib/domain/pin";

export const idSchema = z.string().min(1).max(64);

export const pinSchema = z.string().regex(PIN_REGEX, "PIN must be 4–6 digits");

/** A non-negative decimal given as a string (keeps precision; never Float). */
export function decimalString(opts: { max: number; label: string; allowZero?: boolean; maxDecimals?: number }) {
  const decimals = opts.maxDecimals ?? 4;
  return z
    .string()
    .trim()
    .regex(new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`), `${opts.label} must be a number (up to ${decimals} decimals)`)
    .refine((v) => Number(v) <= opts.max, `${opts.label} must be at most ${opts.max}`)
    .refine((v) => opts.allowZero || Number(v) > 0, `${opts.label} must be greater than 0`);
}

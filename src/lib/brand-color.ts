import type { CSSProperties } from "react";

/**
 * Brand colours are stored as hex (#RRGGBB). These helpers derive accessible
 * variants: a button colour that keeps white text at WCAG AA (4.5:1), a soft
 * tint for pills, and a text colour readable on that tint.
 */

export const DEFAULT_BRAND_COLOR = "#4F46E5";
export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

type RGB = [number, number, number];

function parse(hex: string): RGB {
  const h = HEX_COLOR.test(hex) ? hex : DEFAULT_BRAND_COLOR;
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

function toHex(rgb: RGB): string {
  return `#${rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(parse(a));
  const lb = luminance(parse(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(rgb: RGB, target: RGB, amount: number): RGB {
  return rgb.map((c, i) => c + (target[i] - c) * amount) as RGB;
}

/** Darken until `on` reaches `min` contrast against it. */
function darkenUntil(hex: string, on: string, min: number): string {
  let rgb = parse(hex);
  for (let i = 0; i < 40 && contrast(toHex(rgb), on) < min; i++) rgb = mix(rgb, [0, 0, 0], 0.06);
  return toHex(rgb);
}

/** Background for solid buttons: the brand colour, darkened only if white text would fail AA. */
export function brandSolid(hex: string): string {
  return darkenUntil(hex, "#FFFFFF", 4.5);
}

/** Soft tint for pills and selected states. */
export function brandTint(hex: string): string {
  return toHex(mix(parse(hex), [255, 255, 255], 0.88));
}

/** Text colour that passes AA on the tint. */
export function brandText(hex: string): string {
  return darkenUntil(hex, brandTint(hex), 4.5);
}

/** CSS variables that re-theme every primary button / focus ring inside an element. */
export function brandThemeStyle(hex: string | null | undefined): CSSProperties | undefined {
  if (!hex || !HEX_COLOR.test(hex)) return undefined;
  const solid = brandSolid(hex);
  const vars: Record<string, string> = {
    "--primary": solid,
    "--color-primary": solid,
    "--ring": hex,
    "--color-ring": hex,
    "--accent": brandTint(hex),
    "--color-accent": brandTint(hex),
    "--accent-foreground": brandText(hex),
    "--color-accent-foreground": brandText(hex),
  };
  return vars as CSSProperties;
}

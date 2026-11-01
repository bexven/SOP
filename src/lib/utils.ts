import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge our custom type-scale utilities (text-page/section/body/meta) are
// font sizes — otherwise it treats them as text colours and drops e.g. `text-white`.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["page", "section", "body", "meta"] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

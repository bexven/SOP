import { initials, isAvatarColor, type AvatarColor } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

// Static class map so Tailwind can see every class.
const COLOR_CLASSES: Record<AvatarColor, string> = {
  indigo: "bg-indigo-100 text-indigo-700 ring-indigo-200/70",
  violet: "bg-violet-100 text-violet-700 ring-violet-200/70",
  sky: "bg-sky-100 text-sky-700 ring-sky-200/70",
  emerald: "bg-emerald-100 text-emerald-700 ring-emerald-200/70",
  amber: "bg-amber-100 text-amber-800 ring-amber-200/70",
  rose: "bg-rose-100 text-rose-700 ring-rose-200/70",
  orange: "bg-orange-100 text-orange-700 ring-orange-200/70",
  teal: "bg-teal-100 text-teal-700 ring-teal-200/70",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200/70",
  slate: "bg-slate-200 text-slate-700 ring-slate-300/70",
};

export const AVATAR_SWATCH: Record<AvatarColor, string> = {
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  fuchsia: "bg-fuchsia-500",
  slate: "bg-slate-500",
};

const SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-7 text-[11px]",
  md: "size-9 text-meta",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
} as const;

export function avatarSrc(assetId: string | null | undefined): string | null {
  return assetId ? `/api/assets/${assetId}` : null;
}

export function UserAvatar({
  name,
  color,
  imageId,
  size = "md",
  className,
}: {
  name: string;
  color: string;
  /** Uploaded profile photo (Asset id). Falls back to coloured initials. */
  imageId?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const palette = COLOR_CLASSES[isAvatarColor(color) ? color : "slate"];
  const src = avatarSrc(imageId);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold tracking-tight ring-1 select-none",
        palette,
        SIZES[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- auth-protected asset route
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/** A person's name as a soft pill in their own colour, with their avatar. */
export function PersonChip({
  person,
  className,
}: {
  person: { name: string; avatarColor: string; avatarAssetId?: string | null };
  className?: string;
}) {
  const tone = isAvatarColor(person.avatarColor) ? COLOR_CLASSES[person.avatarColor] : COLOR_CLASSES.slate;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-meta font-semibold ring-1 ring-inset", tone, className)}>
      <UserAvatar name={person.name} color={person.avatarColor} imageId={person.avatarAssetId} size="xs" />
      {person.name}
    </span>
  );
}

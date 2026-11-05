"use client";

import { useState } from "react";
import { PackageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Product thumbnail from an external URL, with a graceful placeholder (hotlink-blocked images are common). */
export function Thumbnail({ src, alt, className }: { src: string | null | undefined; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const show = src && !failed;
  return (
    <span
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-900/[0.06]",
        className,
      )}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element -- external supplier images; see CLAUDE.md
        <img
          src={src}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          // The image can fail before React hydrates (onError then never fires): check once mounted.
          ref={(img) => {
            if (img && img.complete && img.naturalWidth === 0) setFailed(true);
          }}
          className="size-full object-cover"
        />
      ) : (
        <PackageIcon className="size-[45%] text-slate-400" aria-hidden />
      )}
    </span>
  );
}

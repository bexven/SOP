"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

/** Goes back to wherever you came from inside the app; falls back to a list page. */
export function BackLink({ fallback, label = "Back" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        const internal = document.referrer && new URL(document.referrer).origin === window.location.origin;
        if (internal && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-body text-slate-600 transition-colors hover:bg-white/70 hover:text-slate-900"
    >
      <ArrowLeftIcon className="size-4" /> {label}
    </button>
  );
}

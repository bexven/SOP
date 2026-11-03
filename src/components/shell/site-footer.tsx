import { cn } from "@/lib/utils";

/** Small footer: which copy of the tool this is (test or live) and which version is running. */
export function SiteFooter({ kind, release }: { kind: "test" | "live"; release: string | null }) {
  return (
    <footer className="mx-auto mt-10 flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 pb-8 text-meta text-slate-500 sm:px-6">
      <span>Product SOP · Bexven</span>
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5",
            kind === "live" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800",
          )}
        >
          {kind === "live" ? "Live" : "Test site"}
        </span>
        {release && <span className="num">Version {release.slice(0, 7)}</span>}
      </span>
    </footer>
  );
}

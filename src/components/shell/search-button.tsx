"use client";

import { SearchIcon } from "lucide-react";
import { OPEN_PALETTE_EVENT } from "./command-palette";

export function SearchButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
      className="inline-flex h-9 items-center gap-2 rounded-control px-2.5 text-body text-slate-600 transition-colors hover:bg-white/70 sm:w-56 sm:border sm:border-white/70 sm:bg-white/50"
      aria-label="Search (⌘K)"
    >
      <SearchIcon className="size-4" />
      <span className="hidden flex-1 text-left sm:inline">Search…</span>
      <kbd className="num hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline">⌘K</kbd>
    </button>
  );
}

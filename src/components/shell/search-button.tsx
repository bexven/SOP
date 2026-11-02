"use client";

import { SearchIcon } from "lucide-react";
import { OPEN_PALETTE_EVENT } from "./command-palette";

export function SearchButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
      className="group inline-flex h-9 items-center gap-2 rounded-control px-2.5 text-body text-slate-600 transition-[background-color,border-color,box-shadow] duration-150 hover:bg-white sm:w-44 lg:w-9 lg:shrink-0 lg:justify-center lg:px-0 sm:border sm:border-slate-300/80 sm:bg-white sm:shadow-[0_1px_2px_rgb(15_23_42/0.06),inset_0_1px_0_rgb(255_255_255)] sm:hover:border-slate-400 sm:hover:shadow-[0_2px_6px_-1px_rgb(15_23_42/0.12)]"
      aria-label="Search (⌘K)"
      title="Search (⌘K)"
    >
      <SearchIcon className="size-4 text-slate-500 transition-colors group-hover:text-slate-800" />
      <span className="hidden flex-1 text-left text-slate-600 sm:inline lg:hidden">Search products…</span>
      <kbd className="num hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600 sm:inline lg:hidden">⌘K</kbd>
    </button>
  );
}

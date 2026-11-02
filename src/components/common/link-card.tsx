"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, ExternalLinkIcon, FileIcon, FolderIcon, GlobeIcon, PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** What a link points to, for a friendly title and icon. */
export function describeLink(url: string): { title: string; detail: string; icon: typeof GlobeIcon } {
  let u: URL | null = null;
  try {
    u = new URL(url);
  } catch {
    return { title: "Link", detail: url, icon: GlobeIcon };
  }
  const host = u.hostname.replace(/^www\./, "");
  const path = u.pathname;
  if (host === "drive.google.com" || host === "docs.google.com") {
    if (path.includes("/folders/")) return { title: "Google Drive folder", detail: host, icon: FolderIcon };
    if (path.includes("/file/") || u.searchParams.has("id")) return { title: "Google Drive file", detail: host, icon: FileIcon };
    return { title: "Google Drive", detail: host, icon: FolderIcon };
  }
  if (host.endsWith("youtube.com") || host === "youtu.be") return { title: "YouTube video", detail: host, icon: PlayIcon };
  if (host.endsWith("dropbox.com")) return { title: "Dropbox", detail: host, icon: FolderIcon };
  const last = decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "");
  return { title: host, detail: last ? `/${last}` : "Website", icon: GlobeIcon };
}

/** A submitted link as a clean card: icon, friendly name, Open button and Copy. */
export function LinkCard({ url, index, className }: { url: string; index?: number; className?: string }) {
  const [copied, setCopied] = useState(false);
  const d = describeLink(url);
  const Icon = d.icon;
  return (
    <div
      className={cn(
        "group flex min-w-0 items-center gap-3 rounded-control bg-white p-2 pr-2 ring-1 ring-slate-200 transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-[var(--raised-shadow)] hover:ring-primary/30",
        className,
      )}
    >
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-[9px] bg-accent text-accent-foreground">
        <Icon className="size-5" aria-hidden />
        {index !== undefined ? (
          <span className="num absolute -top-1.5 -right-1.5 flex size-4.5 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white ring-2 ring-white">
            {index}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium text-slate-900">{d.title}</span>
        <span className="block truncate text-meta font-normal text-slate-500" title={url}>
          {d.detail}
        </span>
      </span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            toast.success("Link copied");
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error("Couldn't copy — open the link instead");
          }
        }}
        className="flex size-8 shrink-0 items-center justify-center rounded-control text-slate-500 transition-[background-color,color,transform] duration-150 hover:bg-slate-900/[0.05] hover:text-slate-900 active:scale-90"
        aria-label={`Copy ${d.title} link`}
        title="Copy link"
      >
        {copied ? <CheckIcon className="size-4 text-emerald-600" /> : <CopyIcon className="size-4" />}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control bg-primary px-3 text-meta font-semibold text-primary-foreground shadow-sm transition-[background-color,box-shadow,transform] duration-150 hover:bg-primary/90 hover:shadow-md active:scale-95"
        aria-label={`Open ${d.title}${index !== undefined ? ` ${index}` : ""}`}
      >
        Open <ExternalLinkIcon className="size-3.5" />
      </a>
    </div>
  );
}

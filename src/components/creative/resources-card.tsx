"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLinkIcon, LibraryIcon, LinkIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { Viewer } from "@/components/product/product-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canEditResources, type ResourceLane } from "@/lib/domain/resources";
import { addResourceLinkAction, removeResourceLinkAction } from "@/lib/server/actions/product";
import type { ProductDetail } from "@/lib/server/queries/product";

function host(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.length > 1 ? u.pathname.slice(0, 28) + (u.pathname.length > 28 ? "…" : "") : ""}`;
  } catch {
    return url;
  }
}

function LinkRow({ url, onRemove, pending }: { url: string; onRemove?: () => void; pending?: boolean }) {
  return (
    <li className="flex min-w-0 items-center gap-2 rounded-control bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-900/[0.04] ring-inset">
      <LinkIcon className="size-3.5 shrink-0 text-slate-500" aria-hidden />
      <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-body text-primary underline-offset-2 hover:underline" title={url}>
        {host(url)}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      <ExternalLinkIcon className="size-3.5 shrink-0 text-slate-400" aria-hidden />
      {onRemove ? (
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${host(url)}`} onClick={onRemove} disabled={pending}>
          <XIcon />
        </Button>
      ) : null}
    </li>
  );
}

/**
 * Resources on the Image / Video creative tab: the product's own links (from when it was added / researched)
 * plus this tab's extra links, which its makers, Seniors, Media Buyers and Admins can add.
 */
export function ResourcesCard({ product, viewer, lane }: { product: ProductDetail; viewer: Viewer; lane: ResourceLane }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const extra = lane === "images" ? product.imageResourceLinks : product.videoResourceLinks;
  const canEdit = canEditResources(viewer, lane);
  const label = lane === "images" ? "Image" : "Video";

  function add() {
    const v = url.trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) {
      toast.error("Paste a full link starting with https://");
      return;
    }
    startTransition(async () => {
      const r = await addResourceLinkAction({ productId: product.id, lane, url: v });
      if (r.ok) {
        setUrl("");
        toast.success(r.message);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function remove(link: string) {
    startTransition(async () => {
      const r = await removeResourceLinkAction({ productId: product.id, lane, url: link });
      if (r.ok) router.refresh();
      else toast.error(r.error);
    });
  }

  return (
    <section aria-labelledby={`res-${lane}`} className="surface grid gap-3 rounded-panel p-4">
      <h2 id={`res-${lane}`} className="flex items-center gap-2 text-section text-slate-900">
        <LibraryIcon className="size-4 text-slate-500" aria-hidden /> Resources
        <span className="num text-meta text-slate-500">{product.referenceLinks.length + extra.length}</span>
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid content-start gap-1.5">
          <p className="text-meta text-slate-600">From the product</p>
          {product.referenceLinks.length ? (
            <ul className="grid gap-1.5">
              {product.referenceLinks.map((l) => (
                <LinkRow key={l} url={l} />
              ))}
            </ul>
          ) : (
            <p className="text-meta font-normal text-slate-500">None added with the product.</p>
          )}
        </div>
        <div className="grid content-start gap-1.5">
          <p className="text-meta text-slate-600">{label} creative links</p>
          {extra.length ? (
            <ul className="grid gap-1.5">
              {extra.map((l) => (
                <LinkRow key={l} url={l} onRemove={canEdit ? () => remove(l) : undefined} pending={pending} />
              ))}
            </ul>
          ) : (
            <p className="text-meta font-normal text-slate-500">
              {canEdit ? `Add reference ads, inspiration or Drive folders for the ${label.toLowerCase()} work.` : "No extra links yet."}
            </p>
          )}
          {canEdit ? (
            <div className="flex gap-2">
              <Input
                aria-label={`Add a ${label.toLowerCase()} resource link`}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
                inputMode="url"
                placeholder="https://…"
                className="h-9"
              />
              <Button size="sm" variant="outline" className="h-9" onClick={add} disabled={pending || !url.trim()}>
                <PlusIcon /> Add
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

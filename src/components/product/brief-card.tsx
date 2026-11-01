"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, FileTextIcon, PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/common/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatRelative } from "@/lib/format";
import { updateBriefAction } from "@/lib/server/actions/task";

/** Prominent creative brief at the top of the Tasks tab; editable by Media Buyers and Admins. */
export function BriefCard({
  productId,
  brief,
  updatedAt,
  canEdit,
}: {
  productId: string;
  brief: string | null;
  updatedAt: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [text, setText] = useState(brief ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <section className="surface rounded-panel" aria-labelledby="brief-heading">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-[8px] bg-violet-50 text-violet-700 ring-1 ring-violet-100">
            <FileTextIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 id="brief-heading" className="text-section text-slate-900">
              Creative brief
            </h2>
            <p className="text-meta font-normal text-slate-500" suppressHydrationWarning>
              {updatedAt ? `Last updated ${formatRelative(new Date(updatedAt))}` : "Not written yet"}
            </p>
          </div>
        </div>
        {canEdit && !editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <PencilIcon /> {brief ? "Edit" : "Write brief"}
          </Button>
        ) : null}
      </div>
      {editing ? (
        <div className="grid gap-3 p-4">
          {preview ? (
            <div className="min-h-32 rounded-control border border-slate-100 bg-slate-50/50 p-3">
              {text.trim() ? <Markdown source={text} /> : <p className="text-body text-slate-500">Nothing yet.</p>}
            </div>
          ) : (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              aria-label="Creative brief"
              className="font-mono text-[13px] leading-relaxed"
              placeholder={"## Angle\nWhat's the hook?\n\n## Must show\n- …\n\n## References\nhttps://…"}
              autoFocus
            />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-meta font-normal text-slate-500">Markdown supported. Saving notifies everyone working on this product&apos;s creative.</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
                {preview ? <PencilIcon /> : <EyeIcon />} {preview ? "Edit" : "Preview"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setText(brief ?? "");
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await updateBriefAction({ productId, brief: text });
                    if (r.ok) {
                      toast.success(r.message);
                      setEditing(false);
                      router.refresh();
                    } else toast.error(r.error);
                  })
                }
              >
                Save brief
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3">
          {brief ? (
            <Markdown source={brief} />
          ) : (
            <p className="text-body text-slate-600">
              {canEdit
                ? "Write the brief so designers and editors know the angle, hook and must-haves."
                : "The media buyer hasn't written the brief yet. You'll be notified when they do."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

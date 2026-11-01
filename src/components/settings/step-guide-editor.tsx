"use client";

import { useState, useTransition } from "react";
import { EyeIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { TaskType } from "@/generated/prisma/enums";
import { Markdown } from "@/components/common/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TASK_TYPE_LABELS } from "@/lib/domain/labels";
import { formatDateTime } from "@/lib/format";
import { saveStepGuideAction } from "@/lib/server/actions/templates";
import type { GuideRow } from "@/lib/server/queries/templates";
import { TaskTypePicker } from "./task-type-picker";

export function StepGuideEditor({ guides }: { guides: GuideRow[] }) {
  const [type, setType] = useState<TaskType>("RESEARCH");
  const guide = guides.find((g) => g.taskType === type)!;
  const counts = Object.fromEntries(guides.map((g) => [g.taskType, g.body.trim() || g.links.length ? 1 : 0]));
  return (
    <div className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
      <TaskTypePicker value={type} onChange={setType} counts={counts} />
      <GuideForm key={type + (guide.updatedAt ?? "")} guide={guide} />
    </div>
  );
}

function GuideForm({ guide }: { guide: GuideRow }) {
  const [body, setBody] = useState(guide.body);
  const [links, setLinks] = useState(guide.links);
  const [preview, setPreview] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const r = await saveStepGuideAction({
        taskType: guide.taskType,
        body,
        links: links.filter((l) => l.label.trim() || l.url.trim()),
      });
      if (r.ok) toast.success(r.message);
      else toast.error(r.error === "Please check the highlighted fields." ? "Every link needs a name and a full https:// address." : r.error);
    });
  }

  return (
    <section className="surface rounded-panel" aria-labelledby="guide-heading">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 id="guide-heading" className="text-section text-slate-900">
            {TASK_TYPE_LABELS[guide.taskType]}
          </h2>
          <p className="text-meta font-normal text-slate-500">
            Shown in the &ldquo;How we do this&rdquo; panel on every task of this type.
            {guide.updatedAt ? (
              <>
                {" "}
                Last saved <span className="num">{formatDateTime(new Date(guide.updatedAt))}</span>.
              </>
            ) : null}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
          {preview ? <PencilIcon /> : <EyeIcon />} {preview ? "Edit" : "Preview"}
        </Button>
      </div>
      <div className="grid gap-4 p-4">
        {preview ? (
          <div className="min-h-40 rounded-control border border-slate-100 bg-slate-50/40 p-4">
            {body.trim() ? <Markdown source={body} /> : <p className="text-body text-slate-500">Nothing written yet.</p>}
          </div>
        ) : (
          <div className="grid gap-1.5">
            <label htmlFor="guide-body" className="text-meta text-slate-700">
              Guide
            </label>
            <Textarea
              id="guide-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="font-mono text-[13px] leading-relaxed"
              placeholder={"## Steps\n1. Open the brief\n2. …\n\n**Tip:** keep the hook in the first 3 seconds."}
              aria-describedby="guide-hint"
            />
            <p id="guide-hint" className="text-meta font-normal text-slate-500">
              Markdown: ## headings, **bold**, *italic*, - lists, 1. numbered lists, [text](https://link)
            </p>
          </div>
        )}

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-meta text-slate-700">Links (Drive folders, examples, Loom videos)</legend>
          {links.map((l, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
              <Input
                value={l.label}
                aria-label={`Link ${i + 1} name`}
                placeholder="Name"
                onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              <Input
                value={l.url}
                aria-label={`Link ${i + 1} address`}
                placeholder="https://…"
                inputMode="url"
                onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              />
              <Button variant="ghost" size="icon" aria-label={`Remove link ${i + 1}`} onClick={() => setLinks(links.filter((_, j) => j !== i))}>
                <XIcon />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-fit" onClick={() => setLinks([...links, { label: "", url: "" }])} disabled={links.length >= 30}>
            <PlusIcon /> Add link
          </Button>
        </fieldset>
      </div>
      <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-4 py-3">
        <Button onClick={save} disabled={pending || !guide.configured}>
          Save guide
        </Button>
      </div>
    </section>
  );
}

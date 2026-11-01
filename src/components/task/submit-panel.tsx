"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LinkIcon, PlusIcon, SendIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { TaskType } from "@/generated/prisma/enums";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { laneOf, submissionError } from "@/lib/domain/labels";
import { submitTaskAction } from "@/lib/server/actions/task";
import { ImageUploader } from "./image-uploader";

/**
 * What the assignee hands in. Image tasks: upload images (plus optional Drive link).
 * Video tasks: Drive links. Store listing: the live store URL (plus optional screenshots).
 */
export function SubmitPanel({
  taskId,
  type,
  checklistMissing,
  resubmission,
}: {
  taskId: string;
  type: TaskType;
  checklistMissing: number;
  resubmission: boolean;
}) {
  const router = useRouter();
  const lane = laneOf(type);
  const store = type === "STORE_LISTING";
  const [images, setImages] = useState<string[]>([]);
  const [links, setLinks] = useState<string[]>([""]);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const cleanLinks = links.map((l) => l.trim()).filter(Boolean);
  const requirement = submissionError(type, { images: images.length, links: cleanLinks.length });
  const blocked = checklistMissing > 0 || requirement !== null;

  const linkLabel = store ? "Live store product URL" : lane === "videos" ? "Video link (Google Drive)" : "Drive folder (optional, for originals)";

  return (
    <section className="grid gap-4 rounded-control border border-slate-200/80 bg-white p-3" aria-label={resubmission ? "Send a new version" : "Submit your work"}>
      <h3 className="text-body font-semibold text-slate-900">{resubmission ? "Send a new version" : "Submit your work"}</h3>

      {lane === "images" ? (
        <Field id={`imgs-${taskId}`} label={store ? "Screenshots (optional)" : "Images *"}>
          <ImageUploader value={images} onChange={setImages} />
        </Field>
      ) : null}

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-meta text-slate-700">
          {linkLabel}
          {store || lane === "videos" ? " *" : ""}
        </legend>
        {links.map((l, i) => (
          <div key={i} className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={l}
                onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))}
                inputMode="url"
                aria-label={`${linkLabel} ${i + 1}`}
                placeholder={store ? "https://yourstore.com/products/…" : "https://drive.google.com/…"}
                className="pl-8"
              />
            </div>
            {links.length > 1 ? (
              <Button type="button" variant="ghost" size="icon" aria-label="Remove link" onClick={() => setLinks(links.filter((_, j) => j !== i))}>
                <XIcon />
              </Button>
            ) : null}
          </div>
        ))}
        {lane === "videos" && links.length < 10 ? (
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setLinks([...links, ""])}>
            <PlusIcon /> Add another video link
          </Button>
        ) : null}
      </fieldset>

      <Field id={`note-${taskId}`} label="Note for the reviewer (optional)">
        <Textarea id={`note-${taskId}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything they should know" />
      </Field>

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-meta font-normal text-slate-600">
          {checklistMissing
            ? `Tick ${checklistMissing} more required checklist item${checklistMissing === 1 ? "" : "s"} first.`
            : (requirement ?? "Ready — this goes to the media buyer for review.")}
        </p>
        <Button
          disabled={pending || blocked}
          onClick={() =>
            startTransition(async () => {
              const r = await submitTaskAction({ taskId, images, links: cleanLinks.map((url) => ({ url })), note });
              if (!r.ok) {
                toast.error(r.error);
                return;
              }
              toast.success(r.message);
              setImages([]);
              setLinks([""]);
              setNote("");
              router.refresh();
            })
          }
        >
          <SendIcon /> {resubmission ? "Send new version" : "Submit for review"}
        </Button>
      </div>
    </section>
  );
}

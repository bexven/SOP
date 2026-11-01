"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SendIcon } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldA11y } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitTaskAction } from "@/lib/server/actions/task";

export function SubmitForm({
  taskId,
  isStore,
  checklistMissing,
  resubmission,
  defaultUrl,
}: {
  taskId: string;
  isStore: boolean;
  checklistMissing: number;
  resubmission: boolean;
  defaultUrl?: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const urlId = `sub-url-${taskId}`;
  const noteId = `sub-note-${taskId}`;
  const blocked = checklistMissing > 0;

  return (
    <form
      className="grid gap-3 rounded-control border border-slate-200/80 bg-white p-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await submitTaskAction({ taskId, url, note });
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            toast.error(r.error);
            return;
          }
          toast.success(r.message);
          setNote("");
          router.refresh();
        });
      }}
    >
      <Field
        id={urlId}
        label={isStore ? "Live store product URL" : "Google Drive link"}
        hint={isStore ? "The published product page in our online store" : "Share link to the folder or file"}
        error={errors.url?.[0]}
      >
        <Input
          {...fieldA11y(urlId, errors.url?.[0], true)}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          inputMode="url"
          placeholder={isStore ? "https://yourstore.com/products/…" : "https://drive.google.com/…"}
        />
      </Field>
      <Field id={noteId} label="Note (optional)" error={errors.note?.[0]}>
        <Textarea {...fieldA11y(noteId, errors.note?.[0])} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </Field>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-meta font-normal text-slate-500">
          {blocked
            ? `Tick ${checklistMissing} more required checklist item${checklistMissing === 1 ? "" : "s"} to submit.`
            : "Goes to the media buyer for review."}
        </p>
        <Button type="submit" disabled={pending || blocked || !url.trim()}>
          <SendIcon /> {resubmission ? "Resubmit" : "Submit for review"}
        </Button>
      </div>
    </form>
  );
}

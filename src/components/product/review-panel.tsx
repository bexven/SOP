"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CornerUpLeftIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendBackAction } from "@/lib/server/actions/exceptions";
import { approveProductAction, rejectProductAction } from "@/lib/server/actions/product";
import type { ProductDetail } from "@/lib/server/queries/product";
import { cn } from "@/lib/utils";

type Choice = "approve" | "back" | "reject";

/** Product review: the Reviewer (or Admin) decides whether the product goes to testing. */
export function ReviewPanel({ product, canDecide }: { product: ProductDetail; canDecide: boolean }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const approval = product.tasks.find((t) => t.type === "PRODUCT_APPROVAL" && (t.status === "TODO" || t.status === "REVISION"));
  const reviewer = approval?.assignee;

  if (!canDecide) {
    return (
      <div className="flex items-center gap-3 rounded-panel border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-body text-indigo-950" role="status">
        {reviewer ? <UserAvatar name={reviewer.name} color={reviewer.avatarColor} imageId={reviewer.avatarAssetId} size="sm" /> : null}
        <span>
          <span className="font-semibold">Waiting for product review</span>
          {reviewer ? ` by ${reviewer.name}` : ""}. Nobody works on creative until it&apos;s approved for testing.
        </span>
      </div>
    );
  }

  function go() {
    startTransition(async () => {
      const r =
        choice === "approve"
          ? await approveProductAction({ productId: product.id, note })
          : choice === "reject"
            ? await rejectProductAction({ productId: product.id, note })
            : await sendBackAction({ productId: product.id, target: "RESEARCH", note, reopenTaskIds: [] });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message);
      setChoice(null);
      setNote("");
      router.refresh();
    });
  }

  const OPTIONS: { key: Choice; label: string; icon: typeof CheckIcon; tone: string; hint: string }[] = [
    { key: "approve", label: "Approve for testing", icon: CheckIcon, tone: "bg-emerald-700 text-white ring-emerald-700", hint: "Creative starts: 7 tasks are created and assigned." },
    { key: "back", label: "Send back to researcher", icon: CornerUpLeftIcon, tone: "bg-amber-700 text-white ring-amber-700", hint: "The researcher fixes something and submits again." },
    { key: "reject", label: "Not approved", icon: XIcon, tone: "bg-rose-600 text-white ring-rose-600", hint: "The product is closed. The reason is kept so the team can learn from it." },
  ];
  const current = OPTIONS.find((o) => o.key === choice);

  return (
    <section className="surface grid gap-4 rounded-panel border-indigo-200 p-4 ring-1 ring-indigo-100 sm:p-5" aria-labelledby="review-h">
      <div>
        <h2 id="review-h" className="text-section text-slate-900">Product review</h2>
        <p className="text-body text-slate-600">Check the research and margin below, then decide whether this product goes to testing.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Decision">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={choice === o.key}
            onClick={() => setChoice(o.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-control px-4 py-2.5 text-body font-medium ring-1 ring-inset transition-colors",
              choice === o.key ? o.tone : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50",
            )}
          >
            <o.icon className="size-4" /> {o.label}
          </button>
        ))}
      </div>
      {current ? (
        <div className="grid gap-3">
          <p className="text-meta font-normal text-slate-600">{current.hint}</p>
          <Field id="review-note" label={choice === "approve" ? "Note (optional)" : "Reason (required)"}>
            <Textarea id="review-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setChoice(null)}>
              Cancel
            </Button>
            <Button disabled={pending || (choice !== "approve" && note.trim().length < 3)} onClick={go} className={current.tone}>
              <current.icon /> {current.label}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

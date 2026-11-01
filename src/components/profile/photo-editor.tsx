"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CameraIcon, Loader2Icon, TrashIcon } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/lib/image-upload";
import { setAvatarAction } from "@/lib/server/actions/profile";

export function PhotoEditor({ name, color, assetId }: { name: string; color: string; assetId: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  async function pick(file: File) {
    setBusy(true);
    try {
      const up = await uploadImage(file, { maxSide: 384, quality: 0.86, square: true });
      const r = await setAvatarAction({ assetId: up.id });
      if (!r.ok) throw new Error(r.error);
      toast.success(r.message);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update your photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative">
        <UserAvatar name={name} color={color} imageId={assetId} size="xl" className="size-24 text-2xl" />
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/60">
            <Loader2Icon className="size-6 animate-spin text-slate-700" />
          </span>
        ) : null}
      </div>
      <div className="grid gap-2 text-center sm:text-left">
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <Button onClick={() => input.current?.click()} disabled={busy || pending}>
            <CameraIcon /> {assetId ? "Change photo" : "Upload photo"}
          </Button>
          {assetId ? (
            <Button
              variant="outline"
              disabled={busy || pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await setAvatarAction({ assetId: null });
                  if (r.ok) {
                    toast.success(r.message);
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              <TrashIcon /> Remove
            </Button>
          ) : null}
        </div>
        <p className="text-meta font-normal text-slate-500">A square crop from the centre is used. JPG, PNG or WebP.</p>
      </div>
      <input
        ref={input}
        type="file"
        aria-label="Choose a profile photo"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

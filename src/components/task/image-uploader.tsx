"use client";

import { useRef, useState } from "react";
import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { assetUrl, uploadImage } from "@/lib/image-upload";
import { cn } from "@/lib/utils";

type Item = { key: string; id?: string; preview: string; error?: string };

/** Multi-image picker with drag & drop; uploads each image as soon as it's chosen. */
export function ImageUploader({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>(() => value.map((id) => ({ key: id, id, preview: assetUrl(id) })));
  const [drag, setDrag] = useState(false);
  const busy = items.some((i) => !i.id && !i.error);

  function sync(next: Item[]) {
    setItems(next);
    onChange(next.filter((i) => i.id).map((i) => i.id!));
  }

  async function add(files: FileList | File[]) {
    const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, 20 - items.length);
    if (!list.length) return;
    const pending: Item[] = list.map((f) => ({ key: `${f.name}-${f.size}-${Math.random()}`, preview: URL.createObjectURL(f) }));
    let current = [...items, ...pending];
    setItems(current);
    await Promise.all(
      list.map(async (file, i) => {
        const key = pending[i]!.key;
        try {
          const up = await uploadImage(file, { maxSide: 2000, quality: 0.85 });
          current = current.map((it) => (it.key === key ? { ...it, id: up.id } : it));
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Upload failed");
          current = current.map((it) => (it.key === key ? { ...it, error: "Failed" } : it));
        }
        sync(current);
      }),
    );
  }

  return (
    <div className="grid gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void add(e.dataTransfer.files);
        }}
        className={cn(
          "grid grid-cols-3 gap-2 rounded-control border border-dashed p-2 transition-colors sm:grid-cols-5",
          drag ? "border-indigo-400 bg-indigo-50/60" : "border-slate-300 bg-slate-50/40",
        )}
      >
        {items.map((it) => (
          <div key={it.key} className="group relative aspect-square overflow-hidden rounded-[10px] bg-white ring-1 ring-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview / protected asset */}
            <img src={it.preview} alt="" className={cn("size-full object-cover", !it.id && "opacity-60")} />
            {!it.id && !it.error ? (
              <span className="absolute inset-0 flex items-center justify-center bg-white/40">
                <Loader2Icon className="size-5 animate-spin text-slate-700" />
              </span>
            ) : null}
            {it.error ? <span className="absolute inset-x-0 bottom-0 bg-rose-600 py-0.5 text-center text-[11px] text-white">Failed</span> : null}
            <button
              type="button"
              onClick={() => sync(items.filter((x) => x.key !== it.key))}
              className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-90 hover:bg-slate-900"
              aria-label="Remove image"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={items.length >= 20}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[10px] border border-slate-200 bg-white text-meta text-slate-600 hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50"
        >
          <ImagePlusIcon className="size-5" />
          Add images
        </button>
      </div>
      <input
        ref={input}
        type="file"
        aria-label="Choose images to upload"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files) void add(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="text-meta font-normal text-slate-500">
        {busy ? "Uploading…" : "Drag images here or click “Add images”. They're compressed automatically. Up to 20."}
      </p>
    </div>
  );
}

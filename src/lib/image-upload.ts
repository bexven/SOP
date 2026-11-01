"use client";

/**
 * Browser-side image compression + upload. Images are resized (longest side)
 * and re-encoded as WebP (JPEG fallback) before upload, which keeps the
 * database small and uploads fast on mobile data.
 */

export type Uploaded = { id: string; width: number; height: number };

async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const webp = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
  if (!jpeg) throw new Error("Couldn't process that image.");
  return jpeg;
}

export async function compressImage(
  file: File,
  opts: { maxSide: number; quality?: number; square?: boolean },
): Promise<{ blob: Blob; width: number; height: number }> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't an image.`);
  const bitmap = await createImageBitmap(file);
  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (opts.square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = sh = side;
  }
  const scale = Math.min(1, opts.maxSide / Math.max(sw, sh));
  const width = Math.round(sw * scale);
  const height = Math.round(sh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images.");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  bitmap.close();
  return { blob: await encode(canvas, opts.quality ?? 0.85), width, height };
}

export async function uploadImage(file: File, opts: { maxSide: number; quality?: number; square?: boolean }): Promise<Uploaded> {
  const { blob, width, height } = await compressImage(file, opts);
  const form = new FormData();
  form.append("file", new File([blob], "image", { type: blob.type }));
  form.append("width", String(width));
  form.append("height", String(height));
  const res = await fetch("/api/assets", { method: "POST", body: form });
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !json.id) throw new Error(json.error ?? "Upload failed. Check your connection and try again.");
  return { id: json.id, width, height };
}

export function assetUrl(id: string) {
  return `/api/assets/${id}`;
}

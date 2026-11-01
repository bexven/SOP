import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth/current-user";
import { db } from "@/lib/server/db";

/** Images are compressed in the browser before upload; this is a safety cap. */
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(["image/webp", "image/jpeg", "image/png"]);

/** POST one image (multipart field "file"). Returns { id }. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePin) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Only JPG, PNG or WebP images." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That image is too large (max 4 MB after compression)." }, { status: 413 });

  const num = (k: string) => {
    const v = Number(form?.get(k));
    return Number.isFinite(v) && v > 0 && v < 20000 ? Math.round(v) : null;
  };
  const asset = await db.asset.create({
    data: {
      mime: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
      size: file.size,
      width: num("width"),
      height: num("height"),
      uploadedById: user.id,
    },
    select: { id: true },
  });
  return NextResponse.json({ id: asset.id });
}

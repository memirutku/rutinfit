import { NextResponse } from "next/server";
import { apiError, HttpError } from "@/lib/api-error";
import { deletePhoto, listPhotos, MAX_PHOTO_BYTES, PhotoMetaSchema, savePhoto } from "@/lib/services/progress-photos";

/** F16: fotoğraf listesi ve saklandıkları klasör. */
export async function GET() {
  try {
    return NextResponse.json(await listPhotos());
  } catch (error) {
    return apiError(error, "Fotoğraflar getirilemedi", "Photos GET");
  }
}

/** F16: multipart (file, pose, date?, notes?). */
export async function POST(req: Request) {
  try {
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_PHOTO_BYTES + 64 * 1024) throw new HttpError("Fotoğraf çok büyük.", 413);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError("Fotoğraf dosyası gerekli.", 400);
    const text = (k: string) => {
      const v = form.get(k);
      return typeof v === "string" && v.trim() ? v.trim() : undefined;
    };
    const meta = PhotoMetaSchema.parse({ date: text("date"), pose: text("pose"), notes: text("notes") });
    if (file.size > MAX_PHOTO_BYTES) throw new HttpError("Fotoğraf çok büyük.", 413);
    const saved = await savePhoto(Buffer.from(await file.arrayBuffer()), meta);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return apiError(error, "Fotoğraf kaydedilemedi", "Photos POST");
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new HttpError("id parametresi zorunludur.", 400);
    await deletePhoto(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Fotoğraf silinemedi", "Photos DELETE");
  }
}

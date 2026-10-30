/**
 * F16: İlerleme fotoğrafları. Dosyalar yalnız bu bilgisayarda, veri klasöründeki
 * `progress-photos` altında durur; yedek dosyasına ve hiçbir ağ isteğine girmez.
 * Tür, uzantıya değil dosyanın ilk baytlarına bakılarak belirlenir.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../api-error";
import { getLocalDateString } from "../date-utils";
import { getStoragePaths } from "../storage-paths";

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const PHOTO_POSES = ["front", "side", "back"] as const;
export const POSE_LABELS: Record<(typeof PHOTO_POSES)[number], string> = { front: "Önden", side: "Yandan", back: "Arkadan" };

export const PhotoMetaSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçersiz.").optional(),
  pose: z.enum(PHOTO_POSES, "Poz önden, yandan ya da arkadan olmalı."),
  notes: z.string().trim().max(200).optional(),
});

export function photosDir(): string {
  const dir = path.join(/*turbopackIgnore: true*/ path.dirname(getStoragePaths().uploadsDir), "progress-photos");
  fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
  return dir;
}

/** İlk baytlardan resim türü (JPEG, PNG, WebP, HEIC); tanınmazsa null. */
export function sniffImage(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp" && ["heic", "heix", "mif1", "hevc"].includes(buf.toString("ascii", 8, 12))) {
    return { mime: "image/heic", ext: "heic" };
  }
  return null;
}

export async function listPhotos() {
  const photos = await prisma.progressPhoto.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
  return { photos, folder: photosDir() };
}

export async function savePhoto(bytes: Buffer, meta: z.infer<typeof PhotoMetaSchema>) {
  if (bytes.length > MAX_PHOTO_BYTES) throw new HttpError(`Fotoğraf en çok ${MAX_PHOTO_BYTES / (1024 * 1024)} MB olabilir.`, 413);
  const kind = sniffImage(bytes);
  if (!kind) throw new HttpError("Dosya JPEG, PNG, WebP ya da HEIC resmi değil.", 400);
  const date = meta.date ?? getLocalDateString();
  const fileName = `${date}_${meta.pose}_${randomUUID()}.${kind.ext}`;
  const file = path.join(/*turbopackIgnore: true*/ photosDir(), fileName);
  fs.writeFileSync(/*turbopackIgnore: true*/ file, bytes, { mode: 0o600 });
  try {
    return await prisma.progressPhoto.create({
      data: { date, pose: meta.pose, fileName, mimeType: kind.mime, sizeBytes: bytes.length, notes: meta.notes || null },
    });
  } catch (error) {
    fs.rmSync(/*turbopackIgnore: true*/ file, { force: true });
    throw error;
  }
}

export async function readPhoto(id: string) {
  const photo = await prisma.progressPhoto.findUnique({ where: { id } });
  if (!photo) throw new HttpError("Fotoğraf bulunamadı.", 404);
  // Yalnız kendi klasöründeki dosya: veritabanındaki ad yol bileşeni içeremez.
  const file = path.join(/*turbopackIgnore: true*/ photosDir(), path.basename(photo.fileName));
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) throw new HttpError("Fotoğraf dosyası bulunamadı.", 404);
  return { bytes: fs.readFileSync(/*turbopackIgnore: true*/ file), mimeType: photo.mimeType };
}

export async function deletePhoto(id: string) {
  const photo = await prisma.progressPhoto.findUnique({ where: { id } });
  if (!photo) throw new HttpError("Fotoğraf bulunamadı.", 404);
  await prisma.progressPhoto.delete({ where: { id } });
  fs.rmSync(/*turbopackIgnore: true*/ path.join(photosDir(), path.basename(photo.fileName)), { force: true });
}

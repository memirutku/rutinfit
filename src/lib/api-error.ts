import { NextResponse } from "next/server";
import { Prisma } from "@/lib/db/client";
import { ZodError } from "zod";

/** Servislerin kullanıcıya gösterilecek mesaj ve HTTP koduyla fırlattığı hata. */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Route hatalarını doğru HTTP koduna çevirir; iç ayrıntıları (Prisma sorgusu, yığın izi)
 * istemciye sızdırmaz, sunucu günlüğüne yazar.
 *
 * - HttpError → kendi kodu ve mesajı
 * - ZodError → 400 (alan bazlı sorunlarla)
 * - P2025 kayıt yok → 404
 * - P2002 benzersizlik çakışması → 409
 * - P2003 ilişkili kayıt yok → 400
 * - diğerleri → 500
 */
export function apiError(error: unknown, fallbackMessage: string, context = "API") {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    const where = first?.path?.length ? `${first.path.join(".")}: ` : "";
    return NextResponse.json(
      { error: `Geçersiz veri — ${where}${first?.message ?? "doğrulama hatası"}`, issues: error.issues },
      { status: 400 }
    );
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    }
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Bu kayıt zaten mevcut." }, { status: 409 });
    }
    if (error.code === "P2003") {
      return NextResponse.json({ error: "İlişkili kayıt bulunamadı (ör. silinmiş bir besin veya tarif)." }, { status: 400 });
    }
  }
  console.error(`${context} error:`, error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { parseMealText } from "@/lib/services/natural-log";
import { starterCatalogStatus } from "@/lib/services/starter-catalog";

const ParseSchema = z.object({ text: z.string().trim().min(1, "Metin boş olamaz.").max(1000) });

/** F06: yazılan öğünü katalogla eşler (kaydetmez; önizleme içindir). */
export async function POST(req: Request) {
  try {
    const { text } = ParseSchema.parse(await req.json());
    const [items, catalog] = await Promise.all([parseMealText(text), starterCatalogStatus()]);
    // B01: katalog boşsa istemci "başlangıç kataloğunu yükle" önerir.
    return NextResponse.json({ items, catalogEmpty: catalog.foods + catalog.recipes === 0 });
  } catch (error) {
    return apiError(error, "Metin ayrıştırılamadı", "FoodLogs parse");
  }
}

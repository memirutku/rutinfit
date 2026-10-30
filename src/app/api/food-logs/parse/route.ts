import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { parseMealText } from "@/lib/services/natural-log";

const ParseSchema = z.object({ text: z.string().trim().min(1, "Metin boş olamaz.").max(1000) });

/** F06: yazılan öğünü katalogla eşler (kaydetmez; önizleme içindir). */
export async function POST(req: Request) {
  try {
    const { text } = ParseSchema.parse(await req.json());
    return NextResponse.json({ items: await parseMealText(text) });
  } catch (error) {
    return apiError(error, "Metin ayrıştırılamadı", "FoodLogs parse");
  }
}

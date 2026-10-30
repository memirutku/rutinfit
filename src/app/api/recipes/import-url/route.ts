import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { importRecipeFromUrl } from "@/lib/services/recipe-import";

const ImportSchema = z.object({ url: z.string().trim().min(1).max(2000) });

/** F33: Adresteki tarifi önizler (kaydetmez). */
export async function POST(req: Request) {
  try {
    const { url } = ImportSchema.parse(await req.json());
    return NextResponse.json(await importRecipeFromUrl(url));
  } catch (error) {
    return apiError(error, "Tarif içe aktarılamadı", "Recipe import");
  }
}

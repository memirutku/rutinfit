import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { RevealRequestSchema } from "@/lib/schemas/local-files";
import { resolveRevealTarget, revealInFileManager } from "@/lib/services/local-files";

export const dynamic = "force-dynamic";

/** B36: dosyayı Finder'da seçili gösterir (yalnız izinli klasörlerde; dosya açılmaz). */
export async function POST(req: Request) {
  try {
    const target = await resolveRevealTarget(RevealRequestSchema.parse(await req.json()));
    await revealInFileManager(target);
    return NextResponse.json({ ok: true, path: target });
  } catch (error) {
    return apiError(error, "Dosya gösterilemedi", "Reveal POST");
  }
}

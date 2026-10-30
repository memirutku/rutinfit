import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { DEFAULT_AI_BASE_URL } from "@/lib/security/ai-endpoint";
import { checkLocalAIExposure } from "@/lib/security/ai-exposure";

/** F67: Kayıtlı yerel model sunucusunun yerel ağa açık olup olmadığı. */
export async function GET() {
  try {
    const settings = await prisma.aISettings.findUnique({ where: { id: "default-ai" } });
    return NextResponse.json(await checkLocalAIExposure({ baseUrl: settings?.baseUrl ?? DEFAULT_AI_BASE_URL }));
  } catch (error) {
    return apiError(error, "Ağ kontrolü yapılamadı", "AI exposure GET");
  }
}

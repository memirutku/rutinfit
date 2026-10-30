import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { UpdateAISettingsSchema, type AISettingsView } from "@/lib/schemas/system";
import { checkAIBaseUrl, DEFAULT_AI_BASE_URL, OPENAI_API_HOST } from "@/lib/security/ai-endpoint";
import type { CoachTone } from "@/lib/coach-tone";

const ID = "default-ai";

function endpointKind(baseUrl: string): AISettingsView["endpointKind"] {
  const check = checkAIBaseUrl(baseUrl);
  if (!check.ok) return "invalid";
  return check.url.hostname === OPENAI_API_HOST ? "cloud" : "local";
}

function view(row: {
  providerType: string;
  baseUrl: string;
  modelName: string;
  coachEnabled: boolean;
  tone: string;
  connectionStatus?: string;
}): AISettingsView {
  return {
    providerType: row.providerType,
    baseUrl: row.baseUrl,
    modelName: row.modelName,
    coachEnabled: row.coachEnabled,
    tone: (row.tone as CoachTone) ?? "supportive",
    endpointKind: endpointKind(row.baseUrl),
    connectionStatus: row.connectionStatus,
  };
}

const DEFAULTS = {
  providerType: "ollama",
  baseUrl: DEFAULT_AI_BASE_URL,
  modelName: "llama3.2",
  coachEnabled: true,
  tone: "supportive",
  connectionStatus: "untested",
};

/** F58/F67: Kayıtlı yapay zekâ ayarları ve uç noktanın türü (yerel / bulut). */
export async function GET() {
  try {
    const row = await prisma.aISettings.findUnique({ where: { id: ID } });
    return NextResponse.json(view(row ?? DEFAULTS));
  } catch (error) {
    return apiError(error, "Yapay zekâ ayarları getirilemedi", "AI settings GET");
  }
}

/** F58: Koçu aç/kapa ve üslup. Adres değişikliği bilerek desteklenmez (bağlantı testi gerekir). */
export async function PUT(req: Request) {
  try {
    const data = UpdateAISettingsSchema.parse(await req.json());
    const row = await prisma.aISettings.upsert({
      where: { id: ID },
      update: data,
      create: { id: ID, ...data },
    });
    return NextResponse.json(view(row));
  } catch (error) {
    return apiError(error, "Yapay zekâ ayarları kaydedilemedi", "AI settings PUT");
  }
}

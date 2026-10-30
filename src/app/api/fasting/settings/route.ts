import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { FastingSettingsSchema, saveFastingSettings } from "@/lib/services/fasting";

/** F14 + F76: Ramazan modu ve oruç hedefi. */
export async function PUT(req: Request) {
  try {
    return NextResponse.json(await saveFastingSettings(FastingSettingsSchema.parse(await req.json())));
  } catch (error) {
    return apiError(error, "Oruç ayarları kaydedilemedi", "Fasting settings PUT");
  }
}

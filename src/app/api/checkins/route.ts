import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { createWeeklyCheckin, listCheckins } from "@/lib/services/weekly-checkin";

/** F49: son haftalık değerlendirmeler. */
export async function GET() {
  try {
    return NextResponse.json({ checkins: await listCheckins() });
  } catch (error) {
    return apiError(error, "Değerlendirmeler getirilemedi", "Checkins GET");
  }
}

/** F49: geçen haftanın değerlendirmesini oluşturur (aynı hafta için yeniden oluşturur). */
export async function POST() {
  try {
    return NextResponse.json(await createWeeklyCheckin(), { status: 201 });
  } catch (error) {
    return apiError(error, "Değerlendirme oluşturulamadı", "Checkins POST");
  }
}

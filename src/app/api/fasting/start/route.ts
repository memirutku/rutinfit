import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { FastingStartSchema, startFast } from "@/lib/services/fasting";

/** F14: orucu şimdi başlat. */
export async function POST(req: Request) {
  try {
    const { targetHours } = FastingStartSchema.parse(await req.json().catch(() => ({})));
    return NextResponse.json(await startFast(targetHours), { status: 201 });
  } catch (error) {
    return apiError(error, "Oruç başlatılamadı", "Fasting start POST");
  }
}

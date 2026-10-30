import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { getFastingStatus } from "@/lib/services/fasting";

/** F14 + F76: Ramazan vakitleri ve aralıklı oruç durumu. */
export async function GET() {
  try {
    return NextResponse.json(await getFastingStatus());
  } catch (error) {
    return apiError(error, "Oruç durumu getirilemedi", "Fasting GET");
  }
}

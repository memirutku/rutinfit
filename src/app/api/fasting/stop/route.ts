import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { stopFast } from "@/lib/services/fasting";

/** F14: süren orucu bitir. */
export async function POST() {
  try {
    return NextResponse.json(await stopFast());
  } catch (error) {
    return apiError(error, "Oruç bitirilemedi", "Fasting stop POST");
  }
}

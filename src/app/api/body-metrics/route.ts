import { NextResponse } from "next/server";
import { apiError, HttpError } from "@/lib/api-error";
import { BodyMetricsInputSchema, deleteBodyMetrics, getBodyMetrics, saveBodyMetrics } from "@/lib/services/body-metrics";

/** F16: GET ?from=&to= — ölçüler, son değerler, değişim, bel/boy oranı, tansiyon. */
export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    return NextResponse.json(await getBodyMetrics(p.get("from") ?? undefined, p.get("to") ?? undefined));
  } catch (error) {
    return apiError(error, "Ölçüler getirilemedi", "Body metrics GET");
  }
}

export async function PUT(req: Request) {
  try {
    return NextResponse.json(await saveBodyMetrics(BodyMetricsInputSchema.parse(await req.json())));
  } catch (error) {
    return apiError(error, "Ölçü kaydedilemedi", "Body metrics PUT");
  }
}

export async function DELETE(req: Request) {
  try {
    const date = new URL(req.url).searchParams.get("date");
    if (!date) throw new HttpError("date parametresi zorunludur.", 400);
    await deleteBodyMetrics(date);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Ölçü silinemedi", "Body metrics DELETE");
  }
}

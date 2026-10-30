import { NextResponse } from "next/server";
import { apiError, HttpError } from "@/lib/api-error";
import { SupplementInputSchema, SupplementPatchSchema } from "@/lib/schemas/supplement";
import { createSupplement, deleteSupplement, listSupplements, updateSupplement } from "@/lib/services/supplements";

const idParam = (req: Request) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new HttpError("id parametresi zorunludur.", 400);
  return id;
};

/** F15: GET ?date= — takviyeler, o günkü durum ve son 7 gün. */
export async function GET(req: Request) {
  try {
    const date = new URL(req.url).searchParams.get("date") ?? undefined;
    return NextResponse.json({ supplements: await listSupplements(date) });
  } catch (error) {
    return apiError(error, "Takviyeler getirilemedi", "Supplements GET");
  }
}

export async function POST(req: Request) {
  try {
    return NextResponse.json(await createSupplement(SupplementInputSchema.parse(await req.json())), { status: 201 });
  } catch (error) {
    return apiError(error, "Takviye eklenemedi", "Supplements POST");
  }
}

export async function PATCH(req: Request) {
  try {
    return NextResponse.json(await updateSupplement(idParam(req), SupplementPatchSchema.parse(await req.json())));
  } catch (error) {
    return apiError(error, "Takviye güncellenemedi", "Supplements PATCH");
  }
}

export async function DELETE(req: Request) {
  try {
    await deleteSupplement(idParam(req));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Takviye silinemedi", "Supplements DELETE");
  }
}

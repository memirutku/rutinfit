import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { HealthImportSchema, importHealthRecords } from "@/lib/services/health-import";

/** F62: tarayıcının çıkardığı günlük özetlerden bir parti (en çok 5000 kayıt). */
export async function POST(req: Request) {
  try {
    const { records } = HealthImportSchema.parse(await req.json());
    return NextResponse.json(await importHealthRecords(records));
  } catch (error) {
    return apiError(error, "Sağlık verileri içe aktarılamadı", "Health import POST");
  }
}

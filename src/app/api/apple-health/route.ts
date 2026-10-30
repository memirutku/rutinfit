import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { deleteHealthRecords, healthSummary } from "@/lib/services/health-import";

/**
 * F62: Apple Sağlık özeti (salt okunur). /api/health DEĞİL: o adres masaüstü kabuğunun anahtarsız
 * sağlık kontrolüdür ve kişisel veri döndürmemelidir.
 */
export async function GET() {
  try {
    return NextResponse.json(await healthSummary());
  } catch (error) {
    return apiError(error, "Sağlık verileri getirilemedi", "Health GET");
  }
}

/** F62: içe aktarılan tüm Apple Sağlık kayıtlarını kaldırır (kendi kayıtlarına dokunmaz). */
export async function DELETE() {
  try {
    return NextResponse.json(await deleteHealthRecords());
  } catch (error) {
    return apiError(error, "Sağlık verileri silinemedi", "Health DELETE");
  }
}

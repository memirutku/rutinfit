import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { installStarterCatalog, starterCatalogStatus } from "@/lib/services/starter-catalog";

/** B01: katalogdaki besin ve tarif sayısı (boş katalog uyarısı için). */
export async function GET() {
  try {
    return NextResponse.json(await starterCatalogStatus());
  } catch (error) {
    return apiError(error, "Katalog durumu getirilemedi", "StarterCatalog GET");
  }
}

/** B01: temel besinleri, Türk ev yemeklerini ve hızlı kalemleri kurar (eksik olanları). */
export async function POST() {
  try {
    return NextResponse.json(await installStarterCatalog(), { status: 201 });
  } catch (error) {
    return apiError(error, "Başlangıç kataloğu yüklenemedi", "StarterCatalog POST");
  }
}

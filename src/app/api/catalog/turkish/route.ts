import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { installTurkishCatalog, turkishCatalogStatus } from "@/lib/services/turkish-catalog";

/** F74: paketin durumu (kaç yemeği kurulu). */
export async function GET() {
  try {
    return NextResponse.json(await turkishCatalogStatus());
  } catch (error) {
    return apiError(error, "Katalog durumu getirilemedi", "TurkishCatalog GET");
  }
}

/** F74: paketi kurar. */
export async function POST() {
  try {
    return NextResponse.json(await installTurkishCatalog(), { status: 201 });
  } catch (error) {
    return apiError(error, "Türk ev yemekleri eklenemedi", "TurkishCatalog POST");
  }
}

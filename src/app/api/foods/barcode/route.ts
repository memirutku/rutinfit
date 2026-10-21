import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-error';
import { normalizeName } from '@/lib/text';
import { PackagedProductSaveSchema } from '@/lib/schemas/food';
import {
  getProductByBarcode,
  searchProductsByName,
  OFF_ATTRIBUTION,
} from '@/lib/openfoodfacts-client';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    // OFF istemcisiyle aynı normalizasyon: yalnız rakamlar.
    const barcode = searchParams.get('barcode')?.replace(/[^0-9]/g, '') || null;
    const query = searchParams.get('query');

    if (barcode) {
      // First check if already in local FoodItem catalog
      const localItem = await prisma.foodItem.findUnique({
        where: { barcode },
      });

      if (localItem) {
        return NextResponse.json({
          success: true,
          product: {
            barcode: localItem.barcode,
            name: localItem.name,
            brand: localItem.brand,
            basisGrams: localItem.basisGrams,
            calories: localItem.calories,
            proteinG: localItem.proteinG,
            carbsG: localItem.carbsG,
            fatG: localItem.fatG,
            source: localItem.source,
            confidence: localItem.confidence,
            uncertainties: [],
            isLocalCatalog: true,
          },
          isCached: true,
          attribution: 'Yerel RutinFit Kataloğu',
        });
      }

      const result = await getProductByBarcode(barcode);
      return NextResponse.json(result);
    }

    if (query) {
      const result = await searchProductsByName(query);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Lütfen bir "barcode" veya "query" parametresi sağlayın.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Barcode GET error:', error);
    return NextResponse.json({ error: 'Ürün arama hatası', attribution: OFF_ATTRIBUTION }, { status: 500 });
  }
}

/** "Ferrero" + "Ferrero Nutella" → "Ferrero Nutella" (marka iki kez eklenmez). */
function displayName(name: string, brand?: string | null): string {
  if (!brand) return name;
  return normalizeName(name).startsWith(normalizeName(brand)) ? name : `${brand} ${name}`;
}

export async function POST(req: Request) {
  try {
    const body = PackagedProductSaveSchema.parse(await req.json());
    const data = {
      name: displayName(body.name, body.brand),
      category: body.category,
      brand: body.brand || null,
      basisGrams: body.basisGrams,
      calories: body.calories,
      proteinG: body.proteinG,
      carbsG: body.carbsG,
      fatG: body.fatG,
      confidence: body.confidence,
    };

    const foodItem = body.barcode
      ? await prisma.foodItem.upsert({
          where: { barcode: body.barcode },
          create: { ...data, barcode: body.barcode, source: 'Open Food Facts (ODbL)' },
          update: data,
        })
      : await prisma.foodItem.create({ data: { ...data, source: 'Open Food Facts (ODbL)' } });

    return NextResponse.json({
      success: true,
      foodItem,
      message: `"${foodItem.name}" başarıyla yerel kataloğunuza kaydedildi.`,
    });
  } catch (error) {
    return apiError(error, 'Ürün kataloğa kaydedilemedi.', 'Barcode POST');
  }
}

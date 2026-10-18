import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getProductByBarcode,
  searchProductsByName,
  OFF_ATTRIBUTION,
} from '@/lib/openfoodfacts-client';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const barcode = searchParams.get('barcode');
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
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'Ürün arama hatası',
        attribution: OFF_ATTRIBUTION,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      barcode,
      name,
      brand,
      basisGrams = 100,
      calories,
      proteinG,
      carbsG,
      fatG,
      category = 'Paketli Gıda',
      confidence = 'Yüksek',
    } = body;

    if (!name || calories === undefined || proteinG === undefined) {
      return NextResponse.json(
        { error: 'Ürün adı, kalori ve protein alanları zorunludur.' },
        { status: 400 }
      );
    }

    // Upsert into local FoodItem catalog
    const foodItem = await prisma.foodItem.upsert({
      where: barcode ? { barcode } : { id: 'non-existent' },
      create: {
        name: brand ? `${brand} ${name}` : name,
        category,
        brand: brand || null,
        barcode: barcode || null,
        basisGrams: Number(basisGrams) || 100,
        calories: Number(calories) || 0,
        proteinG: Number(proteinG) || 0,
        carbsG: Number(carbsG) || 0,
        fatG: Number(fatG) || 0,
        source: 'Open Food Facts (ODbL)',
        confidence,
      },
      update: {
        name: brand ? `${brand} ${name}` : name,
        category,
        brand: brand || null,
        basisGrams: Number(basisGrams) || 100,
        calories: Number(calories) || 0,
        proteinG: Number(proteinG) || 0,
        carbsG: Number(carbsG) || 0,
        fatG: Number(fatG) || 0,
        confidence,
      },
    });

    return NextResponse.json({
      success: true,
      foodItem,
      message: `"${foodItem.name}" başarıyla yerel kataloğunuza kaydedildi.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Ürün kataloğa kaydedilemedi.' },
      { status: 500 }
    );
  }
}

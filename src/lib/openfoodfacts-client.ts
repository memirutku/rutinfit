import { prisma } from './prisma';

export interface OpenFoodFactsProduct {
  barcode: string;
  name: string;
  brand: string | null;
  basisGrams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  saltG: number | null;
  source: string;
  confidence: 'Yüksek' | 'Tahmini';
  uncertainties: string[];
  imageUrl: string | null;
  categories: string[];
}

export interface ProductSearchResult {
  success: boolean;
  product?: OpenFoodFactsProduct;
  products?: OpenFoodFactsProduct[];
  isCached?: boolean;
  attribution: string;
  error?: string;
  notFound?: boolean;
}

const USER_AGENT = 'RutinFit/1.0 (local-desktop; contact: support@rutinfit.app)';
const DEFAULT_TIMEOUT_MS = 5000;
const CACHE_TTL_HOURS = 24;

export const OFF_ATTRIBUTION =
  'Veriler Open Food Facts veritabanından (Open Database License - ODbL) temin edilmiştir.';

/**
 * Normalizes Open Food Facts raw product nutriments into RutinFit standard values.
 */
export function normalizeNutriments(raw: any, barcode: string): OpenFoodFactsProduct {
  const nutriments = raw.nutriments || {};
  const uncertainties: string[] = [];

  // Product name
  const name =
    raw.product_name_tr ||
    raw.product_name ||
    raw.generic_name_tr ||
    raw.generic_name ||
    'Bilinmeyen Ürün';

  const brand = raw.brands || raw.brand_owner || null;

  // Calories: energy-kcal_100g or energy_100g / 4.184
  let calories = 0;
  if (nutriments['energy-kcal_100g'] !== undefined) {
    calories = Number(nutriments['energy-kcal_100g']);
  } else if (nutriments['energy-kcal'] !== undefined) {
    calories = Number(nutriments['energy-kcal']);
  } else if (nutriments['energy_100g'] !== undefined) {
    // Energy in kJ converted to kcal
    calories = Math.round(Number(nutriments['energy_100g']) / 4.184);
  }

  // Protein, Carbs, Fat
  const proteinG = Number(nutriments.proteins_100g ?? nutriments.proteins ?? 0);
  const carbsG = Number(nutriments.carbohydrates_100g ?? nutriments.carbohydrates ?? 0);
  const fatG = Number(nutriments.fat_100g ?? nutriments.fat ?? 0);
  const fiberG = nutriments.fiber_100g !== undefined ? Number(nutriments.fiber_100g) : null;
  const saltG = nutriments.salt_100g !== undefined ? Number(nutriments.salt_100g) : null;

  // Validation & Confidence Assessment
  let confidence: 'Yüksek' | 'Tahmini' = 'Yüksek';

  if (!calories && (proteinG > 0 || carbsG > 0 || fatG > 0)) {
    calories = Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
    uncertainties.push('Kalori değeri eksikti; protein, karbonhidrat ve yağdan (4-4-9) hesaplandı.');
    confidence = 'Tahmini';
  }

  if (proteinG === 0 && carbsG === 0 && fatG === 0 && calories === 0) {
    uncertainties.push('Ürünün besin değerleri Open Food Facts veritabanında henüz girilmemiş.');
    confidence = 'Tahmini';
  }

  // Image & Categories
  const imageUrl = raw.image_url || raw.image_front_small_url || null;
  const categories = (raw.categories || '')
    .split(',')
    .map((c: string) => c.trim())
    .filter(Boolean);

  return {
    barcode,
    name,
    brand,
    basisGrams: 100,
    calories: Math.round(calories * 10) / 10,
    proteinG: Math.round(proteinG * 10) / 10,
    carbsG: Math.round(carbsG * 10) / 10,
    fatG: Math.round(fatG * 10) / 10,
    fiberG: fiberG !== null ? Math.round(fiberG * 10) / 10 : null,
    saltG: saltG !== null ? Math.round(saltG * 10) / 10 : null,
    source: 'Open Food Facts (ODbL)',
    confidence,
    uncertainties,
    imageUrl,
    categories,
  };
}

/**
 * Barkod ile Open Food Facts üzerinden ürün arar.
 * Önce yerel SQLite önbelleğini kontrol eder, yoksa HTTP API v3/v2 sorgusu yapar.
 */
export async function getProductByBarcode(barcode: string): Promise<ProductSearchResult> {
  const cleanBarcode = barcode.trim().replace(/[^0-9]/g, '');
  if (!cleanBarcode) {
    return {
      success: false,
      error: 'Geçersiz barkod numarası.',
      attribution: OFF_ATTRIBUTION,
    };
  }

  const queryKey = `barcode:${cleanBarcode}`;

  // 1. Önbellek kontrolü
  try {
    const cached = await prisma.openFoodFactsCache.findUnique({
      where: { queryKey },
    });

    if (cached && new Date() < cached.expiresAt) {
      const product: OpenFoodFactsProduct = JSON.parse(cached.payload);
      return {
        success: true,
        product,
        isCached: true,
        attribution: OFF_ATTRIBUTION,
      };
    }
  } catch {
    // Cache read failure shouldn't block network request
  }

  // 2. Open Food Facts API v3 sorgusu
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const url = `https://world.openfoodfacts.org/api/v3/product/${cleanBarcode}.json`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      if (res.status === 404) {
        return {
          success: false,
          notFound: true,
          error: `"${cleanBarcode}" barkodlu ürün Open Food Facts veritabanında bulunamadı. Manuel ekleyebilirsiniz.`,
          attribution: OFF_ATTRIBUTION,
        };
      }
      throw new Error(`Open Food Facts sunucu hatası (HTTP ${res.status})`);
    }

    const data = await res.json();
    if (data.status === 0 || !data.product) {
      return {
        success: false,
        notFound: true,
        error: `"${cleanBarcode}" barkodlu ürün veritabanında bulunamadı.`,
        attribution: OFF_ATTRIBUTION,
      };
    }

    const product = normalizeNutriments(data.product, cleanBarcode);

    // 3. Önbelleğe kaydet (24 saat)
    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000);
      await prisma.openFoodFactsCache.upsert({
        where: { queryKey },
        create: {
          queryKey,
          payload: JSON.stringify(product),
          expiresAt,
        },
        update: {
          payload: JSON.stringify(product),
          expiresAt,
        },
      });
    } catch {
      // Non-critical cache write error
    }

    return {
      success: true,
      product,
      isCached: false,
      attribution: OFF_ATTRIBUTION,
    };
  } catch (err: any) {
    // Fallback: Süresi dolmuş dahi olsa önbellekte varsa sun
    try {
      const staleCached = await prisma.openFoodFactsCache.findUnique({
        where: { queryKey },
      });
      if (staleCached) {
        const product: OpenFoodFactsProduct = JSON.parse(staleCached.payload);
        product.uncertainties.push('Ağ bağlantısı kurulamadığı için eski önbellek verisi sunuldu.');
        return {
          success: true,
          product,
          isCached: true,
          attribution: OFF_ATTRIBUTION,
        };
      }
    } catch {
      // ignore
    }

    return {
      success: false,
      error: `Open Food Facts servisine bağlanılamadı: ${err?.message || 'Zaman aşımı'}. Lütfen internet bağlantınızı kontrol edin veya manuel ekleyin.`,
      attribution: OFF_ATTRIBUTION,
    };
  }
}

/**
 * Ürün adı veya anahtar kelime ile Open Food Facts üzerinden arama yapar.
 */
export async function searchProductsByName(query: string): Promise<ProductSearchResult> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return {
      success: false,
      products: [],
      attribution: OFF_ATTRIBUTION,
    };
  }

  const queryKey = `search:${cleanQuery.toLowerCase()}`;

  // Önbellek kontrolü
  try {
    const cached = await prisma.openFoodFactsCache.findUnique({
      where: { queryKey },
    });
    if (cached && new Date() < cached.expiresAt) {
      const products: OpenFoodFactsProduct[] = JSON.parse(cached.payload);
      return {
        success: true,
        products,
        isCached: true,
        attribution: OFF_ATTRIBUTION,
      };
    }
  } catch {
    // ignore
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    // Open Food Facts CGI search endpoint returning clean JSON
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      cleanQuery
    )}&search_simple=1&action=process&json=1&page_size=10`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Open Food Facts arama hatası (HTTP ${res.status})`);
    }

    const data = await res.json();
    const rawProducts = data.products || [];

    const products: OpenFoodFactsProduct[] = rawProducts
      .map((p: any) => normalizeNutriments(p, p.code || ''))
      .filter((p: OpenFoodFactsProduct) => p.name && p.name !== 'Bilinmeyen Ürün');

    // Önbelleğe kaydet (24 saat)
    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000);
      await prisma.openFoodFactsCache.upsert({
        where: { queryKey },
        create: {
          queryKey,
          payload: JSON.stringify(products),
          expiresAt,
        },
        update: {
          payload: JSON.stringify(products),
          expiresAt,
        },
      });
    } catch {
      // ignore
    }

    return {
      success: true,
      products,
      isCached: false,
      attribution: OFF_ATTRIBUTION,
    };
  } catch (err: any) {
    return {
      success: false,
      products: [],
      error: `Arama gerçekleştirilemedi: ${err?.message || 'Zaman aşımı'}`,
      attribution: OFF_ATTRIBUTION,
    };
  }
}

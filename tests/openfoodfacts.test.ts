import { describe, it, expect } from 'vitest';
import {
  normalizeNutriments,
  OFF_ATTRIBUTION,
} from '../src/lib/openfoodfacts-client';

describe('Open Food Facts Client & Nutriments Normalizer', () => {
  it('should normalize valid product nutriments correctly', () => {
    const rawData = {
      product_name_tr: 'Doğal Yulaf Ezmesi',
      brands: 'Eti Lifalif',
      nutriments: {
        'energy-kcal_100g': 365,
        proteins_100g: 12.5,
        carbohydrates_100g: 62.0,
        fat_100g: 7.0,
        fiber_100g: 10.0,
        salt_100g: 0.05,
      },
    };

    const product = normalizeNutriments(rawData, '8690526011111');

    expect(product.barcode).toBe('8690526011111');
    expect(product.name).toBe('Doğal Yulaf Ezmesi');
    expect(product.brand).toBe('Eti Lifalif');
    expect(product.calories).toBe(365);
    expect(product.proteinG).toBe(12.5);
    expect(product.carbsG).toBe(62);
    expect(product.fatG).toBe(7);
    expect(product.fiberG).toBe(10);
    expect(product.confidence).toBe('Yüksek');
    expect(product.source).toBe('Open Food Facts (ODbL)');
    expect(product.uncertainties).toHaveLength(0);
  });

  it('should calculate missing calories deterministically from macros (4-4-9 rule)', () => {
    const rawDataWithMissingCalories = {
      product_name: 'Protein Tozu İzole',
      nutriments: {
        proteins_100g: 80,
        carbohydrates_100g: 5,
        fat_100g: 2,
      },
    };

    const product = normalizeNutriments(rawDataWithMissingCalories, '1234567890123');

    // 80*4 + 5*4 + 2*9 = 320 + 20 + 18 = 358 kcal
    expect(product.calories).toBe(358);
    expect(product.confidence).toBe('Tahmini');
    expect(product.uncertainties.some((u) => u.includes('4-4-9'))).toBe(true);
  });

  it('should convert energy in kJ to kcal when energy-kcal is missing', () => {
    const rawDataKj = {
      product_name: 'Fıstık Ezmesi',
      nutriments: {
        energy_100g: 2400, // 2400 kJ / 4.184 = ~574 kcal
        proteins_100g: 25,
        carbohydrates_100g: 15,
        fat_100g: 45,
      },
    };

    const product = normalizeNutriments(rawDataKj, '9876543210987');
    expect(product.calories).toBe(574);
  });

  it('should flag products with missing nutritional info as Tahmini', () => {
    const emptyProduct = {
      product_name: 'Bilinmeyen Bisküvi',
      nutriments: {},
    };

    const product = normalizeNutriments(emptyProduct, '0000000000000');
    expect(product.confidence).toBe('Tahmini');
    expect(product.calories).toBe(0);
    expect(product.uncertainties.some((u) => u.includes('henüz girilmemiş'))).toBe(true);
  });

  it('should have standard ODbL attribution message', () => {
    expect(OFF_ATTRIBUTION).toContain('Open Food Facts');
    expect(OFF_ATTRIBUTION).toContain('ODbL');
  });

  it('should safely handle non-numeric, string or NaN nutrients without returning NaN', () => {
    const corruptedData = {
      product_name: 'Bozuk Verili Ürün',
      nutriments: {
        'energy-kcal_100g': 'N/A',
        proteins_100g: 'undefined',
        carbohydrates_100g: null,
        fat_100g: -5, // Negative numbers fallback safely to 0
      },
    };

    const product = normalizeNutriments(corruptedData, '9999999999999');
    expect(Number.isFinite(product.calories)).toBe(true);
    expect(Number.isFinite(product.proteinG)).toBe(true);
    expect(Number.isFinite(product.carbsG)).toBe(true);
    expect(Number.isFinite(product.fatG)).toBe(true);
    expect(product.calories).toBe(0);
    expect(product.proteinG).toBe(0);
    expect(product.carbsG).toBe(0);
    expect(product.fatG).toBe(0);
  });
});

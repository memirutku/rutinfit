import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma';
import {
  upsertPantryItem,
  calculateNetShoppingList,
  deletePantryItem,
} from '../src/lib/pantry-service';

describe('Pantry Service & Net Shopping List Deduction', () => {
  beforeEach(async () => {
    await prisma.pantryItem.deleteMany({
      where: { name: { contains: 'TEST_KILER_' } },
    });
  });

  it('should add and update items in pantry', async () => {
    const item = await upsertPantryItem({
      name: 'TEST_KILER_Yulaf',
      amount: 500,
      unit: 'g',
      category: 'Kuru Gıda',
    });

    expect(item.id).toBeDefined();
    expect(item.amount).toBe(500);

    // Updating amount for existing item with same name adds to stock
    const updated = await upsertPantryItem({
      name: 'TEST_KILER_Yulaf',
      amount: 300,
      unit: 'g',
    });

    expect(updated.amount).toBe(800);

    // Clean up
    await deletePantryItem(item.id);
  });

  it('should deduct pantry stock accurately from needed shopping ingredients', async () => {
    // Add stock: 500g Tavuk, 200g Pirinç
    const p1 = await upsertPantryItem({
      name: 'TEST_KILER_Tavuk',
      amount: 500,
      unit: 'g',
      category: 'Kasap/Balık',
    });
    const p2 = await upsertPantryItem({
      name: 'TEST_KILER_Pirinc',
      amount: 200,
      unit: 'g',
      category: 'Kuru Gıda',
    });

    // Menu needs: 300g Tavuk (fully covered), 500g Pirinç (partially covered, 300g needed), 100g Zeytinyağı (not in stock)
    const needed = [
      { name: 'TEST_KILER_Tavuk', amount: 300, unit: 'g', category: 'Kasap/Balık' },
      { name: 'TEST_KILER_Pirinc', amount: 500, unit: 'g', category: 'Kuru Gıda' },
      { name: 'TEST_KILER_Zeytinyagi', amount: 100, unit: 'g', category: 'Kuru Gıda' },
    ];

    const result = await calculateNetShoppingList(needed);

    expect(result.totalPlanned).toBe(3);
    expect(result.totalCovered).toBe(1); // Tavuk fully covered
    expect(result.totalToBuy).toBe(2); // Pirinç (deficit) + Zeytinyağı (full)

    const pirincToBuy = result.itemsToBuy.find((i) => i.name === 'TEST_KILER_Pirinc');
    expect(pirincToBuy).toBeDefined();
    expect(pirincToBuy?.amount).toBe(300); // 500 - 200 = 300
    expect(pirincToBuy?.pantryAmount).toBe(200);

    const zeytinyagiToBuy = result.itemsToBuy.find((i) => i.name === 'TEST_KILER_Zeytinyagi');
    expect(zeytinyagiToBuy).toBeDefined();
    expect(zeytinyagiToBuy?.amount).toBe(100);
    expect(zeytinyagiToBuy?.pantryAmount).toBe(0);

    expect(result.summary).toContain('1 tanesi kilerinizden karşılandı');
    expect(result.summary).toContain('2 kalem eksik malzeme');

    // Clean up
    await deletePantryItem(p1.id);
    await deletePantryItem(p2.id);
  });
});

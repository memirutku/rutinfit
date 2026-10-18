import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  aggregateShoppingList,
  resolveShoppingCategory,
} from '@/lib/shopping-aggregator';
import { calculateNetShoppingList } from '@/lib/pantry-service';
import { z } from 'zod';
import { getLocalDateString, addDaysToDateString } from '@/lib/date-utils';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const weekStart =
      searchParams.get('weekStart') || getLocalDateString();
    const deductPantry = searchParams.get('deductPantry') !== 'false';

    // Önce veritabanında bu haftaya ait kaydedilmiş liste var mı kontrol et
    let items = await prisma.shoppingListItem.findMany({
      where: { weekStart },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    let pantrySummary: string | null = null;

    // Eğer henüz kaydedilmiş liste yoksa, bu haftanın yemek planından otomatik türet
    if (items.length === 0) {
      const plans = await prisma.mealPlan.findMany({
        where: {
          date: {
            gte: weekStart,
            lt: addDaysToDateString(weekStart, 7),
          },
        },
        include: {
          meals: {
            include: {
              recipe: {
                include: {
                  ingredients: {
                    include: {
                      foodItem: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const plannedRecipes = [];
      for (const plan of plans) {
        for (const meal of plan.meals) {
          if (meal.recipe) {
            plannedRecipes.push({
              recipeName: meal.recipe.name,
              servings: meal.servings,
              ingredients: meal.recipe.ingredients.map((ing) => ({
                name: ing.foodItem.name,
                category: ing.foodItem.category,
                grams: ing.grams,
              })),
            });
          }
        }
      }

      const aggregated = aggregateShoppingList(plannedRecipes);
      const rawNeeded: Array<{ name: string; amount: number; unit: string; category: string }> = [];

      for (const cat of Object.keys(aggregated)) {
        for (const item of aggregated[cat]) {
          rawNeeded.push({
            name: item.name,
            amount: item.totalGrams,
            unit: 'g',
            category: item.category,
          });
        }
      }

      // Kiler stoklarını düşme (Pantry Host mantığı)
      let finalItemsToSave = rawNeeded;
      if (deductPantry && rawNeeded.length > 0) {
        const netResult = await calculateNetShoppingList(rawNeeded);
        pantrySummary = netResult.summary;
        finalItemsToSave = netResult.itemsToBuy.map((b) => ({
          name: b.name,
          amount: b.amount,
          unit: b.unit,
          category: b.category,
        }));
      }

      // Veritabanına kaydet
      for (const item of finalItemsToSave) {
        const created = await prisma.shoppingListItem.create({
          data: {
            weekStart,
            category: item.category,
            name: item.name,
            amount: item.amount,
            unit: item.amount >= 1000 ? 'kg' : 'g',
            checked: false,
          },
        });
        items.push(created);
      }
    }

    // Kategorilerine göre grupla
    const grouped: Record<string, typeof items> = {};
    for (const item of items) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    }

    return NextResponse.json({
      weekStart,
      items,
      grouped,
      pantrySummary,
    });
  } catch (error) {
    console.error('Shopping GET error:', error);
    return NextResponse.json(
      { error: 'Alışveriş listesi getirilemedi' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, checked } = z
      .object({ id: z.string(), checked: z.boolean() })
      .parse(body);

    const updated = await prisma.shoppingListItem.update({
      where: { id },
      data: { checked },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Shopping PUT error:', error);
    return NextResponse.json(
      { error: error.message || 'Güncelleme başarısız' },
      { status: 400 }
    );
  }
}

// POST: Alışveriş listesini kiler stoklarını düşerek yeniden oluşturma
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { weekStart, deductPantry = true } = body;

    const targetWeek = weekStart || getLocalDateString();

    // Mevcut haftalık listeyi temizle
    await prisma.shoppingListItem.deleteMany({
      where: { weekStart: targetWeek },
    });

    // GET mantığını tetikleyerek yeni listeyi oluştur
    const plans = await prisma.mealPlan.findMany({
      where: {
        date: {
          gte: targetWeek,
          lt: addDaysToDateString(targetWeek, 7),
        },
      },
      include: {
        meals: {
          include: {
            recipe: {
              include: {
                ingredients: { include: { foodItem: true } },
              },
            },
          },
        },
      },
    });

    const plannedRecipes = [];
    for (const plan of plans) {
      for (const meal of plan.meals) {
        if (meal.recipe) {
          plannedRecipes.push({
            recipeName: meal.recipe.name,
            servings: meal.servings,
            ingredients: meal.recipe.ingredients.map((ing) => ({
              name: ing.foodItem.name,
              category: ing.foodItem.category,
              grams: ing.grams,
            })),
          });
        }
      }
    }

    const aggregated = aggregateShoppingList(plannedRecipes);
    const rawNeeded: Array<{ name: string; amount: number; unit: string; category: string }> = [];

    for (const cat of Object.keys(aggregated)) {
      for (const item of aggregated[cat]) {
        rawNeeded.push({
          name: item.name,
          amount: item.totalGrams,
          unit: 'g',
          category: item.category,
        });
      }
    }

    let finalItemsToSave = rawNeeded;
    let pantrySummary = 'Kiler kontrolü yapılmadı.';
    if (deductPantry && rawNeeded.length > 0) {
      const netResult = await calculateNetShoppingList(rawNeeded);
      pantrySummary = netResult.summary;
      finalItemsToSave = netResult.itemsToBuy.map((b) => ({
        name: b.name,
        amount: b.amount,
        unit: b.unit,
        category: b.category,
      }));
    }

    const createdItems = [];
    for (const item of finalItemsToSave) {
      const created = await prisma.shoppingListItem.create({
        data: {
          weekStart: targetWeek,
          category: item.category,
          name: item.name,
          amount: item.amount,
          unit: item.amount >= 1000 ? 'kg' : 'g',
          checked: false,
        },
      });
      createdItems.push(created);
    }

    return NextResponse.json({
      success: true,
      weekStart: targetWeek,
      items: createdItems,
      pantrySummary,
      message: `Alışveriş listesi güncellendi (${createdItems.length} kalem).`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Alışveriş listesi yenilenemedi.' },
      { status: 500 }
    );
  }
}

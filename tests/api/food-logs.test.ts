import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST, DELETE } from "@/app/api/food-logs/route";
import { prisma } from "@/lib/prisma";
import { buildRestorePayload } from "@/lib/food-log-restore";
import { callRoute } from "../helpers/route";
import { createFood, createRecipe } from "../helpers/factories";
import { resetDatabase } from "../helpers/db";

const DATE = "2026-10-18";

beforeEach(resetDatabase);

describe("POST /api/food-logs — sunucu tarafı deterministik hesap", () => {
  it("besin kaydında istemcinin gönderdiği makroları yok sayar, 100 g bazından yeniden hesaplar", async () => {
    const food = await createFood({ name: "Tavuk Göğsü", calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });

    const res = await callRoute(POST, {
      body: {
        date: DATE,
        mealType: "lunch",
        foodItemId: food.id,
        name: food.name,
        grams: 150,
        caloriesSnapshot: 9999, // istemci manipülasyonu
        proteinSnapshot: 0,
      },
    });

    expect(res.status).toBe(201);
    expect(res.json.caloriesSnapshot).toBe(247.5);
    expect(res.json.proteinSnapshot).toBe(46.5);
    expect(res.json.carbsSnapshot).toBe(0);
    expect(res.json.fatSnapshot).toBe(5.4);
  });

  it("100 g dışındaki baz gramajı (ör. 1 adet = 50 g) doğru ölçekler", async () => {
    const egg = await createFood({ name: "Yumurta", basisGrams: 50, calories: 78, proteinG: 6.3, carbsG: 0.6, fatG: 5.3 });

    const res = await callRoute(POST, {
      body: { date: DATE, mealType: "breakfast", foodItemId: egg.id, name: egg.name, grams: 100 },
    });

    expect(res.status).toBe(201);
    expect(res.json.caloriesSnapshot).toBe(156);
    expect(res.json.proteinSnapshot).toBe(12.6);
  });

  it("tarif kaydında malzeme toplamından hesaplar", async () => {
    const oat = await createFood({ name: "Yulaf", calories: 380, proteinG: 13, carbsG: 60, fatG: 7 });
    const milk = await createFood({ name: "Süt", calories: 60, proteinG: 3.3, carbsG: 4.8, fatG: 3.2 });
    const recipe = await createRecipe([
      { foodItemId: oat.id, grams: 50 },
      { foodItemId: milk.id, grams: 200 },
    ]);

    // Tarifin tamamı 250 g; 250 g kaydedilince toplam makro beklenir.
    const res = await callRoute(POST, {
      body: { date: DATE, mealType: "breakfast", recipeId: recipe.id, name: recipe.name, grams: 250 },
    });

    expect(res.status).toBe(201);
    expect(res.json.caloriesSnapshot).toBe(310); // 190 + 120
    expect(res.json.proteinSnapshot).toBe(13.1); // 6.5 + 6.6
  });

  it("geçersiz gövdeyi 400 ile reddeder ve kayıt oluşturmaz", async () => {
    const res = await callRoute(POST, { body: { date: "18-10-2026", mealType: "lunch", name: "x", grams: -5 } });
    expect(res.status).toBe(400);
    expect(await prisma.foodLog.count()).toBe(0);
  });
});

describe("GET /api/food-logs — günlük özet", () => {
  it("yalnız istenen günün kayıtlarını ve toplamını döner", async () => {
    const food = await createFood({ calories: 200, proteinG: 20, carbsG: 10, fatG: 5 });
    await callRoute(POST, { body: { date: DATE, mealType: "lunch", foodItemId: food.id, name: "a", grams: 100 } });
    await callRoute(POST, { body: { date: DATE, mealType: "dinner", foodItemId: food.id, name: "b", grams: 50 } });
    await callRoute(POST, { body: { date: "2026-10-19", mealType: "dinner", foodItemId: food.id, name: "c", grams: 100 } });

    const res = await callRoute(GET, { query: { date: DATE } });

    expect(res.status).toBe(200);
    expect(res.json.logs).toHaveLength(2);
    expect(res.json.summary.consumedCalories).toBe(300);
    expect(res.json.summary.consumedProtein).toBe(30);
  });
});

describe("Geri Al (Undo) gidiş-dönüşü", () => {
  it("silinen kayıt geri yükleme yüküyle aynı makrolarla geri gelir", async () => {
    const food = await createFood({ name: "Izgara Somon", calories: 208, proteinG: 20, carbsG: 0, fatG: 13 });
    const created = await callRoute(POST, {
      body: { date: DATE, time: "19:45", mealType: "dinner", foodItemId: food.id, name: food.name, grams: 200 },
    });
    const original = created.json;

    const del = await callRoute(DELETE, { method: "DELETE", query: { id: original.id } });
    expect(del.status).toBe(200);
    expect(await prisma.foodLog.count()).toBe(0);

    const restored = await callRoute(POST, { body: buildRestorePayload(original) });
    expect(restored.status).toBe(201);
    for (const key of ["date", "time", "mealType", "name", "grams", "caloriesSnapshot", "proteinSnapshot", "carbsSnapshot", "fatSnapshot"]) {
      expect(restored.json[key]).toEqual(original[key]);
    }
  });
});

describe("POST /api/food-logs — tarif porsiyonu ile kayıt", () => {
  it("servings verilince gram ve makro tarifin porsiyonundan hesaplanır", async () => {
    const food = await createFood({ calories: 100, proteinG: 10, carbsG: 10, fatG: 2 });
    const recipe = await createRecipe([{ foodItemId: food.id, grams: 400 }], { servings: 2 }); // porsiyon: 200 g, 200 kcal

    const res = await callRoute(POST, {
      body: { date: DATE, mealType: "dinner", recipeId: recipe.id, name: recipe.name, servings: 1.5 },
    });

    expect(res.status).toBe(201);
    expect(res.json.grams).toBe(300);
    expect(res.json.caloriesSnapshot).toBe(300);
    expect(res.json.proteinSnapshot).toBe(30);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST, PUT } from "@/app/api/shopping/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createFood, createMealPlan, createProfile, createRecipe } from "../helpers/factories";

beforeEach(resetDatabase);

// 2026-10-19 Pazartesi; 2026-10-21 Çarşamba
const MONDAY = "2026-10-19";
const WEDNESDAY = "2026-10-21";

async function planWeek() {
  const chicken = await createFood({ name: "Tavuk Göğsü", category: "Kasap & Balık" });
  const oat = await createFood({ name: "Yulaf", category: "Kuru Gıda & Tahıllar" });
  const r1 = await createRecipe([{ foodItemId: chicken.id, grams: 750 }]);
  const r2 = await createRecipe([
    { foodItemId: chicken.id, grams: 750 },
    { foodItemId: oat.id, grams: 80 },
  ]);
  await createMealPlan(MONDAY, [{ mealType: "lunch", recipeId: r1.id }]);
  await createMealPlan(WEDNESDAY, [{ mealType: "dinner", recipeId: r2.id }]);
}

describe("/api/shopping", () => {
  it("GET salt-okunurdur: liste yokken veritabanına yazmaz", async () => {
    await planWeek();
    const res = await callRoute(GET, { query: { weekStart: MONDAY } });
    expect(res.status).toBe(200);
    expect(res.json.items).toEqual([]);
    expect(await prisma.shoppingListItem.count()).toBe(0);
  });

  it("POST haftayı toplar; 1500 g gramla ve 'g' birimiyle saklanır (1500 kg değil)", async () => {
    await planWeek();
    const res = await callRoute(POST, { body: { weekStart: MONDAY } });
    expect(res.status).toBe(200);
    const chicken = await prisma.shoppingListItem.findFirstOrThrow({ where: { name: "Tavuk Göğsü" } });
    expect(chicken).toMatchObject({ amount: 1500, unit: "g", weekStart: MONDAY });
  });

  it("hafta başı Pazartesi'ye normalize edilir: Çarşamba ile istenen liste aynı haftadır", async () => {
    await planWeek();
    await callRoute(POST, { body: { weekStart: WEDNESDAY } });
    const items = await prisma.shoppingListItem.findMany();
    expect(new Set(items.map((i) => i.weekStart))).toEqual(new Set([MONDAY]));
    // Pazartesi planı da dahil: 750 + 750
    expect(items.find((i) => i.name === "Tavuk Göğsü")?.amount).toBe(1500);

    const get = await callRoute(GET, { query: { weekStart: "2026-10-23" } });
    expect(get.json.weekStart).toBe(MONDAY);
    expect(get.json.items).toHaveLength(2);
  });

  it("eşzamanlı iki oluşturma isteği kopya kalem üretmez", async () => {
    await planWeek();
    await Promise.all([
      callRoute(POST, { body: { weekStart: MONDAY } }),
      callRoute(POST, { body: { weekStart: MONDAY } }),
    ]);
    expect(await prisma.shoppingListItem.count()).toBe(2);
  });

  it("yenileme işaretlenmiş kalemlerin işaretini korur", async () => {
    await planWeek();
    await callRoute(POST, { body: { weekStart: MONDAY } });
    const oat = await prisma.shoppingListItem.findFirstOrThrow({ where: { name: "Yulaf" } });
    await callRoute(PUT, { method: "PUT", body: { id: oat.id, checked: true } });

    await callRoute(POST, { body: { weekStart: MONDAY } });
    const after = await prisma.shoppingListItem.findFirstOrThrow({ where: { name: "Yulaf" } });
    expect(after.checked).toBe(true);
  });

  it("kilerdeki stok düşülür: 500 g var, 1500 g gerek → 1000 g", async () => {
    await planWeek();
    await prisma.pantryItem.create({ data: { name: "tavuk göğsü", amount: 0.5, unit: "kg" } });
    await callRoute(POST, { body: { weekStart: MONDAY } });
    const chicken = await prisma.shoppingListItem.findFirstOrThrow({ where: { name: "Tavuk Göğsü" } });
    expect(chicken.amount).toBe(1000);
  });

  it("geçersiz gövde 400, bilinmeyen kalem 404 döner", async () => {
    expect((await callRoute(POST, { body: { weekStart: "dün" } })).status).toBe(400);
    expect((await callRoute(PUT, { method: "PUT", body: { id: "yok", checked: true } })).status).toBe(404);
  });
});

describe("F31: hane büyüklüğü", () => {
  it("alışveriş miktarları hane büyüklüğüyle çarpılır", async () => {
    await createProfile({ householdSize: 3 });
    await planWeek();
    await callRoute(POST, { body: { weekStart: MONDAY } });
    const chicken = await prisma.shoppingListItem.findFirstOrThrow({ where: { name: "Tavuk Göğsü" } });
    expect(chicken.amount).toBe(4500);
  });
});

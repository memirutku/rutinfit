import { beforeEach, describe, expect, it } from "vitest";
import { GET as foodsGet, POST as foodsPost } from "@/app/api/foods/route";
import { GET as recipesGet, POST as recipesPost } from "@/app/api/recipes/route";
import { GET as profileGet, PUT as profilePut } from "@/app/api/profile/route";
import { GET as barcodeGet, POST as barcodePost } from "@/app/api/foods/barcode/route";
import { DELETE as foodLogDelete } from "@/app/api/food-logs/route";
import { GET as diagnosticsGet } from "@/app/api/diagnostics/route";
import { GET as opengymStatus } from "@/app/api/opengym/status/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { jsonResponse, stubFetch } from "../helpers/fetch";
import { createFood } from "../helpers/factories";

beforeEach(resetDatabase);

describe("/api/foods", () => {
  it("Türkçe büyük/küçük harf duyarsız arar (süt → Süt, inek → İnek)", async () => {
    await createFood({ name: "Süt" });
    await createFood({ name: "İnek Sütü" });
    await createFood({ name: "Yulaf" });
    expect((await callRoute(foodsGet, { query: { search: "süt" } })).json.map((f: any) => f.name).sort()).toEqual(["Süt", "İnek Sütü"].sort());
    expect((await callRoute(foodsGet, { query: { search: "inek" } })).json.map((f: any) => f.name)).toEqual(["İnek Sütü"]);
  });

  it("F80: listeyi Türk alfabesine göre sıralar (Ç, I/İ, Ş yerinde)", async () => {
    for (const name of ["Zeytin", "Şeftali", "İncir", "Ispanak", "Çilek", "Elma"]) await createFood({ name });
    const names = (await callRoute(foodsGet)).json.map((f: any) => f.name);
    expect(names).toEqual(["Çilek", "Elma", "Ispanak", "İncir", "Şeftali", "Zeytin"]);
  });

  it("negatif makroyu 400, yinelenen barkodu 409 ile reddeder", async () => {
    const base = { name: "X", calories: 10, proteinG: 1, carbsG: 1, fatG: 1 };
    expect((await callRoute(foodsPost, { body: { ...base, calories: -1 } })).status).toBe(400);
    await createFood({ barcode: "8690000000123" });
    const dup = await callRoute(foodsPost, { body: { ...base, barcode: "8690000000123" } });
    expect(dup.status).toBe(409);
  });
});

describe("/api/recipes", () => {
  it("var olmayan besine bağlı tarifi anlaşılır 400 ile reddeder", async () => {
    const res = await callRoute(recipesPost, { body: { name: "T", ingredients: [{ foodItemId: "yok", grams: 100 }] } });
    expect(res.status).toBe(400);
    expect(res.json.error).not.toMatch(/prisma|Foreign key/i);
  });

  it("tarif oluşturur ve GET hesaplanmış makroyla döner", async () => {
    const f = await createFood({ calories: 200, proteinG: 20, carbsG: 10, fatG: 5 });
    const res = await callRoute(recipesPost, { body: { name: "T", ingredients: [{ foodItemId: f.id, grams: 50 }] } });
    expect(res.status).toBe(201);
    const list = await callRoute(recipesGet);
    expect(list.json[0].calculatedMacros).toEqual({ calories: 100, proteinG: 10, carbsG: 5, fatG: 2.5 });
  });
});

describe("/api/profile", () => {
  const valid = {
    heightCm: 181, age: 30, sex: "male", currentWeightKg: 110, calorieTarget: 2080, calorieCeiling: 2100,
    proteinTargetG: 165, fatTargetG: 60, carbTargetG: 220, wakeTime: "06:00", workdayHomeTime: "19:30",
  };

  it("GET profil yoksa oluşturur; F09: yeni profil kurulum sihirbazını bekler", async () => {
    const res = await callRoute(profileGet);
    expect(res.status).toBe(200);
    expect(res.json.id).toBe("default-user");
    expect(res.json.isOnboarded).toBe(false);
  });

  it("F09: aktivite, hedef türü, hız ve hedef kilo kaydedilir; geçersiz aktivite 400", async () => {
    const goal = { activityLevel: "moderate", goalType: "lose", goalRateKgPerWeek: 0.5, targetWeightKg: 90 };
    const res = await callRoute(profilePut, { method: "PUT", body: { ...valid, ...goal, isOnboarded: true } });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ ...goal, isOnboarded: true });
    expect((await callRoute(profilePut, { method: "PUT", body: { ...valid, activityLevel: "koltuk" } })).status).toBe(400);
  });

  it("kesirli hedefleri tam sayıya yuvarlar (Int sütun hatası vermez)", async () => {
    const res = await callRoute(profilePut, { method: "PUT", body: { ...valid, calorieTarget: 2080.6, proteinTargetG: 164.5 } });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ calorieTarget: 2081, proteinTargetG: 165 });
  });

  it("geçersiz saat ve cinsiyeti 400 ile reddeder; yağ hedefi 0 olabilir", async () => {
    expect((await callRoute(profilePut, { method: "PUT", body: { ...valid, wakeTime: "25:99" } })).status).toBe(400);
    expect((await callRoute(profilePut, { method: "PUT", body: { ...valid, sex: "x" } })).status).toBe(400);
    expect((await callRoute(profilePut, { method: "PUT", body: { ...valid, fatTargetG: 0 } })).status).toBe(200);
  });

  it("F56: tabanın altındaki kalori hedefi onaysız 422 döner; onayla kaydedilir, onay alanı saklanmaz", async () => {
    const low = { ...valid, sex: "female", calorieTarget: 1100, calorieCeiling: 1150 };
    const res = await callRoute(profilePut, { method: "PUT", body: low });
    expect(res.status).toBe(422);
    expect(res.json).toMatchObject({ code: "LOW_CALORIE" });
    expect(res.json.error).toMatch(/1\.200 kcal/);

    const ok = await callRoute(profilePut, { method: "PUT", body: { ...low, acknowledgeLowCalorie: true } });
    expect(ok.status).toBe(200);
    expect(ok.json.calorieTarget).toBe(1100);
    expect(ok.json).not.toHaveProperty("acknowledgeLowCalorie");
  });

  it("F56: sayıları gizleme tercihi kaydedilir", async () => {
    const res = await callRoute(profilePut, { method: "PUT", body: { ...valid, hideNumbers: true } });
    expect(res.json.hideNumbers).toBe(true);
  });
});

describe("/api/foods/barcode", () => {
  it("biçimli barkodu normalize edip yerel katalogda bulur", async () => {
    await createFood({ name: "Granola", barcode: "8690000000001" });
    const res = await callRoute(barcodeGet, { query: { barcode: " 869-0000000001 " } });
    expect(res.json.product?.isLocalCatalog).toBe(true);
  });

  it("Open Food Facts yanıtını normalize eder (ağ taklit edilir)", async () => {
    const off = stubFetch([
      [/\/api\/v3\/product\/3017620422003\.json/, () =>
        jsonResponse({ status: "success", product: { product_name: "Nutella", brands: "Ferrero", nutriments: { "energy-kcal_100g": 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 } } }),
      ],
    ]);
    const res = await callRoute(barcodeGet, { query: { barcode: "3017620422003" } });
    off.restore();
    expect(res.json.success).toBe(true);
    expect(res.json.product).toMatchObject({ name: "Nutella", calories: 539 });
  });

  it("parametresiz GET 400 döner", async () => {
    expect((await callRoute(barcodeGet)).status).toBe(400);
  });

  it("POST negatif değeri reddeder, markayı iki kez eklemez, aynı barkodu günceller", async () => {
    const base = { barcode: "8000500310427", name: "Ferrero Nutella", brand: "Ferrero", calories: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9 };
    expect((await callRoute(barcodePost, { body: { ...base, calories: -5 } })).status).toBe(400);

    const first = await callRoute(barcodePost, { body: base });
    expect(first.json.foodItem.name).toBe("Ferrero Nutella");
    await callRoute(barcodePost, { body: { ...base, name: "Nutella", calories: 540 } });
    const all = await prisma.foodItem.findMany();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: "Ferrero Nutella", calories: 540 });
  });
});

describe("Diğer uç noktalar", () => {
  it("olmayan öğün kaydını silmek 404 döner", async () => {
    expect((await callRoute(foodLogDelete, { method: "DELETE", query: { id: "yok" } })).status).toBe(404);
  });

  it("tanılama tablo sayılarını döner", async () => {
    await createFood();
    const res = await callRoute(diagnosticsGet);
    expect(res.status).toBe(200);
    expect(res.json.counts.foods).toBe(1);
  });

  it("openGym kapalıyken durum çevrimdışı döner", async () => {
    const res = await callRoute(opengymStatus);
    expect(res.status).toBe(200);
    expect(res.json.health?.isOnline ?? res.json.isOnline).toBe(false);
  });
});

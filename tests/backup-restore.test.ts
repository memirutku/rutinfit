import { describe, it, expect, beforeEach } from "vitest";
import { resetDatabase } from "./helpers/db";
import { prisma } from "../src/lib/prisma";
import { GET as exportBackup } from "../src/app/api/backup/export/route";
import { POST as importBackup } from "../src/app/api/backup/import/route";

describe("Yedekleme ve Geri Yükleme Tam Döngü (Round-Trip) Bütünlük Testi", () => {
  const TEST_DATE = "2026-10-18";
  const TEST_PREFIX = "TEST_ROUNDTRIP_";

  beforeEach(resetDatabase);

  it("dışa aktarılan verilerin tüm tabloları ve Kiler (Pantry) kayıtlarını içermesini doğrulamalı", async () => {
    // 1. Örnek kiler ve besin kaydı oluştur
    const pantryItem = await prisma.pantryItem.create({
      data: {
        name: `${TEST_PREFIX}Zeytinyağı`,
        amount: 750,
        unit: "ml",
        category: "Baharat & Sos",
      },
    });

    const foodLog = await prisma.foodLog.create({
      data: {
        date: TEST_DATE,
        time: "12:30",
        mealType: "lunch",
        name: `${TEST_PREFIX}Tavuklu Salata`,
        grams: 300,
        caloriesSnapshot: 420,
        proteinSnapshot: 45,
        carbsSnapshot: 15,
        fatSnapshot: 12,
      },
    });

    // 2. Dışa aktarma rotasını çağır
    const exportResponse = await exportBackup();
    expect(exportResponse.status).toBe(200);

    const jsonText = await exportResponse.text();
    const backupJson = JSON.parse(jsonText);

    expect(backupJson.version).toBe("1.1");
    expect(backupJson.data).toBeDefined();
    expect(Array.isArray(backupJson.data.pantryItems)).toBe(true);
    expect(Array.isArray(backupJson.data.foodLogs)).toBe(true);

    // Dışa aktarılan veri içinde oluşturduğumuz test kayıtlarının varlığını kontrol et
    const exportedPantry = backupJson.data.pantryItems.find((p: any) => p.name === pantryItem.name);
    const exportedFoodLog = backupJson.data.foodLogs.find((f: any) => f.name === foodLog.name);

    expect(exportedPantry).toBeDefined();
    expect(exportedFoodLog).toBeDefined();

    // Temizlik
    await prisma.foodLog.delete({ where: { id: foodLog.id } });
    await prisma.pantryItem.delete({ where: { id: pantryItem.id } });
  });

  it("tam kapsamlı bir yedek JSON'unu ilişkisel tablolar dahil kayıpsız geri yüklemeli", async () => {
    const mockBackupPayload = {
      version: "1.1",
      exportedAt: new Date().toISOString(),
      data: {
        profile: {
          id: "default-user",
          heightCm: 180,
          currentWeightKg: 85,
          calorieTarget: 2080,
          calorieCeiling: 2100,
        },
        foods: [
          {
            id: "test-food-import-1",
            name: `${TEST_PREFIX}Örnek Yulaf`,
            category: "Tahıl",
            basisGrams: 100,
            calories: 370,
            proteinG: 13,
            carbsG: 68,
            fatG: 7,
          },
        ],
        pantryItems: [
          {
            id: "test-pantry-import-1",
            name: `${TEST_PREFIX}Kuru Fasulye`,
            amount: 1000,
            unit: "g",
            category: "Kuru Gıda",
          },
        ],
        foodLogs: [
          {
            id: "test-foodlog-import-1",
            date: TEST_DATE,
            time: "08:00",
            mealType: "breakfast",
            name: `${TEST_PREFIX}Sabah Yulafı`,
            grams: 60,
            caloriesSnapshot: 222,
            proteinSnapshot: 8,
            carbsSnapshot: 40,
            fatSnapshot: 4,
          },
        ],
        weightLogs: [
          {
            date: TEST_DATE,
            weightKg: 84.8,
            conditionsNote: "Sabah aç karnına",
          },
        ],
      },
    };

    const req = new Request("http://localhost:3005/api/backup/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockBackupPayload),
    });

    const res = await importBackup(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.counts.foods).toBe(1);
    expect(json.counts.pantryItems).toBe(1);
    expect(json.counts.foodLogs).toBe(1);
    expect(json.counts.weightLogs).toBe(1);

    // Veritabanına gerçekten yazıldığını teyit et
    const restoredFood = await prisma.foodItem.findUnique({
      where: { id: "test-food-import-1" },
    });
    const restoredPantry = await prisma.pantryItem.findUnique({
      where: { id: "test-pantry-import-1" },
    });
    const restoredLog = await prisma.foodLog.findUnique({
      where: { id: "test-foodlog-import-1" },
    });

    expect(restoredFood).not.toBeNull();
    expect(restoredFood?.name).toBe(`${TEST_PREFIX}Örnek Yulaf`);

    expect(restoredPantry).not.toBeNull();
    expect(restoredPantry?.name).toBe(`${TEST_PREFIX}Kuru Fasulye`);

    expect(restoredLog).not.toBeNull();
    expect(restoredLog?.caloriesSnapshot).toBe(222);

    // Temizlik
    if (restoredLog) await prisma.foodLog.delete({ where: { id: restoredLog.id } });
    if (restoredPantry) await prisma.pantryItem.delete({ where: { id: restoredPantry.id } });
    if (restoredFood) await prisma.foodItem.delete({ where: { id: restoredFood.id } });
  });

  it("hatalı veya eksik veri formatını 400 hatası ile reddetmeli", async () => {
    const invalidReq = new Request("http://localhost:3005/api/backup/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ corrupted: true }),
    });

    const res = await importBackup(invalidReq);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("desteklenmeyen sürüm (örn: v9.9) içeren yedeği 400 hatası ile reddetmeli", async () => {
    const unsupportedReq = new Request("http://localhost:3005/api/backup/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "9.9",
        exportedAt: new Date().toISOString(),
        data: { foods: [] },
      }),
    });

    const res = await importBackup(unsupportedReq);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Desteklenmeyen yedek sürümü");
  });

  it("bozuk JSON dizesi içeren isteği 400 hatası ile reddetmeli", async () => {
    const malformedReq = new Request("http://localhost:3005/api/backup/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "NOT_VALID_JSON{foo:bar",
    });

    const res = await importBackup(malformedReq);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Geçersiz JSON formatı");
  });

  it("kısmi tablolar içeren (örn: yalnızca profil ve besinler) yedeği güvenle içe aktarabilmeli", async () => {
    const partialPayload = {
      version: "1.0",
      data: {
        profile: {
          id: "default-user",
          calorieTarget: 2080,
        },
        foods: [
          {
            id: "test-partial-food-1",
            name: `${TEST_PREFIX}Kısmi Besin`,
            category: "Test",
            basisGrams: 100,
            calories: 100,
            proteinG: 10,
            carbsG: 10,
            fatG: 2,
          },
        ],
      },
    };

    const req = new Request("http://localhost:3005/api/backup/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partialPayload),
    });

    const res = await importBackup(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.counts.foods).toBe(1);

    // Temizlik
    await prisma.foodItem.deleteMany({ where: { id: "test-partial-food-1" } });
  });

  it("akıllı birleştirme (smart merge) esnasında yedekte bulunmayan mevcut kayıtların silinmediğini kanıtlamalı", async () => {
    // 1. Veritabanında önceden var olan bağımsız bir kiler öğesi oluştur
    const existingPantry = await prisma.pantryItem.create({
      data: {
        name: `${TEST_PREFIX}Mevcut Elma`,
        amount: 5,
        unit: "adet",
        category: "Meyve",
      },
    });

    // 2. Yedek dosyasında sadece 'Armut' olsun (Elma yedekte yok)
    const mergePayload = {
      version: "1.1",
      data: {
        pantryItems: [
          {
            id: "test-merge-pantry-pear",
            name: `${TEST_PREFIX}Yedekten Gelen Armut`,
            amount: 3,
            unit: "adet",
            category: "Meyve",
          },
        ],
      },
    };

    const req = new Request("http://localhost:3005/api/backup/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mergePayload),
    });

    const res = await importBackup(req);
    expect(res.status).toBe(200);

    // 3. Mevcut 'Elma'nın silinmediğini, 'Armut'un ise eklendiğini doğrula
    const stillExistingPantry = await prisma.pantryItem.findUnique({
      where: { id: existingPantry.id },
    });
    const importedPantry = await prisma.pantryItem.findUnique({
      where: { id: "test-merge-pantry-pear" },
    });

    expect(stillExistingPantry).not.toBeNull();
    expect(stillExistingPantry?.name).toBe(`${TEST_PREFIX}Mevcut Elma`);
    expect(importedPantry).not.toBeNull();

    // Temizlik
    await prisma.pantryItem.delete({ where: { id: existingPantry.id } });
    await prisma.pantryItem.delete({ where: { id: "test-merge-pantry-pear" } });
  });

  it("sistem tanılama rotasının (/api/diagnostics) depolama ve kayıt metriklerini döndürmesini doğrulamalı", async () => {
    const { GET: getDiagnostics } = await import("../src/app/api/diagnostics/route");
    const res = await getDiagnostics();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("healthy");
    expect(json.storage).toBeDefined();
    expect(json.storage.dbExists).toBe(true);
    expect(json.storage.dbSizeFormatted).toBeDefined();
    expect(json.counts).toBeDefined();
    expect(typeof json.counts.foods).toBe("number");
    expect(typeof json.counts.pantryItems).toBe("number");
    expect(json.system.nodeVersion).toBeDefined();
  });
});

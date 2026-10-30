import zlib from "node:zlib";
import { test, expect } from "@playwright/test";
import { backfillFood, baseFor, isoDay, journey, MOCK, queueLLM } from "./harness";

/**
 * Can, 37, sistem yöneticisi. Verisinin buluta gitmemesi için RutinFit'i seçti. LM Studio'yu
 * kendi bilgisayarında çalıştırıyor. Her şeyi kontrol eder: ağa ne çıkıyor, yedek, dışa aktarma,
 * Apple Sağlık verisi. Sihirbazı atlar, ayarları kendisi yapar.
 */
const BASE = baseFor(4);

function zipOf(name: string, text: string): Buffer {
  const raw = Buffer.from(text, "utf8");
  const data = zlib.deflateRawSync(raw);
  const n = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(zlib.crc32(raw), 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(zlib.crc32(raw), 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(n.length, 28);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(46 + n.length, 12);
  eocd.writeUInt32LE(30 + n.length + data.length, 16);
  return Buffer.concat([local, n, data, central, n, eocd]);
}

test("Can: gizlilik, yerel model, yedek ve Apple Sağlık", async ({ page, request }) => {
  const { step } = journey(page, "can", { yaş: 37, cinsiyet: "erkek", boy: 183, kilo: 88, hedef: "yavaş kilo vermek", özel: "gizlilik hassas, LM Studio, iPhone + Apple Watch" });

  await step("Sihirbazı atlar", "İlk açılışta sihirbazı 'Şimdilik geç' ile kapatır, önce ayarlara bakmak ister", async () => {
    await page.goto(BASE);
    await page.getByRole("button", { name: "Şimdilik geç" }).click();
  });
  await step("Varsayılan panoyu inceler", "Profil girmeden panoda hangi hedeflerin göründüğüne bakar", async () => {
    await expect(page.getByText(/kcal/).first()).toBeVisible();
  });
  await step("Şeffaflık tablosu", "Ayarlarda bilgisayardan dışarı ne çıktığını okur", async () => {
    await page.getByRole("link", { name: "Ayarlar" }).click();
    await expect(page.getByRole("heading", { name: /Şeffaflık/ })).toBeVisible();
    await page.getByRole("heading", { name: /Şeffaflık/ }).scrollIntoViewIfNeeded();
  });
  await step("LM Studio'yu bağlar", "Sağlayıcıyı LM Studio seçer, kendi adresini ve modelini girip bağlantıyı test eder", async () => {
    await page.locator("#settings-field-12").selectOption({ label: "LM Studio (Yerel)" });
    await page.locator("#settings-field-13").fill(`${MOCK}/v1`);
    await page.locator("#settings-field-14").fill("mock-llama");
    // WebKit'te bu sayfadaki bazı Playwright sorguları iç hata veriyor; tıklama sayfa içinden yapılır.
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Bağlantıyı Test Et"))?.click());
    await expect(page.getByText(/Algılanan Modeller|başarılı|bağlandı/i).first()).toBeVisible();
  });

  for (let i = 1; i <= 6; i++) {
    await request.post(`${BASE}/api/cardio`, { data: { date: isoDay(-i), kind: "run", durationMin: 30, distanceKm: 5 + i / 10 } });
    await backfillFood(request, BASE, isoDay(-i), [{ mealType: "lunch", name: "Tavuk salata", grams: 350, kcal: 450, protein: 40 }]);
  }

  await step("Koça geçmişini sorar", "Koça 'Bu hafta kaç km koştum?' diye sorar; sayının nereden geldiğini görmek ister", async () => {
    await page.getByRole("link", { name: "AI Koçu" }).click();
    await queueLLM(request, "Bu hafta düzenli koşmuşsun, tebrikler.");
    await page.getByPlaceholder(/Sorunuzu yazın/).fill("Bu hafta kaç km koştum?");
    await page.getByRole("button", { name: /Gönder/ }).click();
    await expect(page.getByText(/Kardiyo · Bu hafta/).last()).toBeVisible({ timeout: 15_000 });
  });
  await step("Koçtan akşam yemeği önerisi", "Akşam yemeği önerisi ister ve öneriyi onaylayıp plana ekler", async () => {
    await queueLLM(
      request,
      'Öneri:\n\n```json\n{"type":"meal_proposal","mealType":"dinner","title":"Fırın somon ve bulgur","rationale":"Protein ve omega-3","prepMinutes":25,"ingredients":[{"foodName":"Somon","grams":150},{"foodName":"Bulgur","grams":60}],"estimatedMacros":{"calories":600,"proteinG":40,"carbsG":45,"fatG":22}}\n```'
    );
    await page.getByPlaceholder(/Sorunuzu yazın/).fill("Akşam ne yiyeyim?");
    await page.getByRole("button", { name: /Gönder/ }).click();
    await page.getByRole("button", { name: "Onayla ve Plana Ekle" }).click({ timeout: 15_000 });
    await expect(page.getByText("Plana Eklendi ✓")).toBeVisible();
  });
  await step("Tam yedek indirir", "Tüm verisini JSON olarak indirir", async () => {
    await page.getByRole("link", { name: "Ayarlar" }).click();
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: "Tüm Verileri JSON Olarak İndir" }).click();
    await dl;
    await expect(page.getByText(/Yedek indirildi/)).toBeVisible();
  });
  await step("Otomatik yedek kurar", "Günlük otomatik yedeği açar, klasörü kabul eder ve hemen bir yedek alır", async () => {
    await page.getByLabel("Otomatik yedek açık").check();
    await page.getByRole("button", { name: "Otomatik yedeği kaydet" }).click();
    await page.getByRole("button", { name: "Şimdi yedekle" }).click();
    await expect(page.getByText(/Son yedek/)).toBeVisible();
  });
  await step("CSV dışa aktarır", "Besin günlüğünü CSV olarak dışa aktarır", async () => {
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: "Besin günlüğü (CSV)" }).click();
    await dl;
  });
  await step("Apple Sağlık verisini içe aktarır", "iPhone'dan aldığı export.zip'i İlerleme sayfasında yükler", async () => {
    const d = isoDay(-1);
    const lines = [`<?xml version="1.0" encoding="UTF-8"?>`, `<HealthData locale="tr_TR">`];
    for (let i = 0; i < 14; i++) {
      const day = isoDay(-i);
      lines.push(` <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Can's iPhone" unit="count" startDate="${day} 09:00:00 +0300" endDate="${day} 09:30:00 +0300" value="${6000 + i * 100}"/>`);
      lines.push(` <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Can's Apple Watch" unit="count" startDate="${day} 09:00:00 +0300" endDate="${day} 09:30:00 +0300" value="${6400 + i * 100}"/>`);
    }
    lines.push(` <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="31" durationUnit="min" totalDistance="5.2" totalDistanceUnit="km" totalEnergyBurned="340" totalEnergyBurnedUnit="kcal" sourceName="Can's Apple Watch" startDate="${d} 07:00:00 +0300" endDate="${d} 07:31:00 +0300"/>`);
    lines.push(`</HealthData>`);
    await page.getByRole("link", { name: "İlerleme" }).click();
    await page.getByLabel("Apple Sağlık dışa aktarımı (export.zip)").setInputFiles({ name: "export.zip", mimeType: "application/zip", buffer: zipOf("apple_health_export/export.xml", lines.join("\n")) });
    await expect(page.getByText(/kayıt içe aktarıldı/)).toBeVisible();
  });
  await step("Apple Sağlık verisini kaldırır", "Denemeden sonra içe aktarılan veriyi siler", async () => {
    await page.getByRole("button", { name: "Apple Sağlık verilerini kaldır" }).click();
    await page.getByRole("button", { name: "Kaldırmayı onayla" }).click();
    await expect(page.getByText(/Henüz Apple Sağlık verisi yok/)).toBeVisible();
  });
  await step("Tanılama bölümü", "Ayarların sonundaki tanılama bilgisini inceler", async () => {
    await page.getByRole("link", { name: "Ayarlar" }).click();
    await page.getByText(/Tanılama|Sistem/).last().scrollIntoViewIfNeeded();
  });
});

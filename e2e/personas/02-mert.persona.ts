import { test, expect } from "@playwright/test";
import { backfillWorkout, baseFor, fillWizard, isoDay, journey, saveWizard } from "./harness";

/**
 * Mert, 28, yazılım satış. 6 yıldır ağırlık çalışıyor (bench 100, squat 140, deadlift 180).
 * Hevy/Strong kullanmış; set, RPE, ısınma, plaka hesabı ve rekor takibi bekliyor. Haftada 4 gün.
 */
const BASE = baseFor(1);

test("Mert: deneyimli halterci, program ve rekor takibi", async ({ page, request }) => {
  const { step } = journey(page, "mert", { yaş: 28, cinsiyet: "erkek", boy: 180, kilo: 85, hedef: "yavaş kilo alma (bulk)", deneyim: "6 yıl ağırlık", önceki: "Strong, Hevy" });

  await step("İlk açılış ve sihirbaz", "Hızlıca profilini girer: 28, 180 cm, 85 kg, çok hareketli, kilo almak 0,25", async () => {
    await page.goto(BASE);
    await fillWizard(page, { sex: "Erkek", age: 28, height: 180, weight: 85, activity: /Çok hareketli/, goal: "Kilo al", rate: "0.25", dayPattern: "Ofis / iş yeri", homeTime: "18:00" });
    await saveWizard(page);
  });
  await step("Antrenman sayfası", "Antrenman bölümünü açar", async () => {
    await page.getByRole("link", { name: "Antrenman" }).click();
    await expect(page.getByRole("heading", { name: "Haftalık Antrenman Planı" })).toBeVisible();
  });
  await step("Hazır programlara bakar", "Kendi seviyesine uygun bir program arar (5x5, PPL, 5/3/1 gibi)", async () => {
    await page.getByRole("button", { name: "Hazır program" }).click();
    await expect(page.getByRole("dialog", { name: "Hazır programlar" })).toBeVisible();
  });
  await step("Üst/alt programını seçer", "En yakın seçenek olan 'Üst / alt (4 gün)' programını plana ekler", async () => {
    const d = page.getByRole("dialog", { name: "Hazır programlar" });
    await d.locator("li", { has: page.getByRole("heading", { name: "Üst / alt (4 gün)" }) }).getByRole("button", { name: "Plana ekle" }).click();
    await d.waitFor({ state: "hidden" });
  });
  await step("Bugünün seansını başlatır", "Bugün bir ağırlık günüyse 'Başla' ile seansa başlar", async () => {
    await page.getByRole("button", { name: /^Başla \(/ }).first().click();
    await expect(page.getByRole("button", { name: "Antrenmanı Bitir & Kaydet" })).toBeVisible();
  });
  await step("İlk seti girer", "İlk egzersizde 100 kg × 5, RPE 8 girip seti tamamlar; dinlenme sayacını görür", async () => {
    await page.getByLabel("Ağırlık:").first().fill("100");
    await page.getByLabel("Tekrar:").first().fill("5");
    await page.getByLabel("RPE:").first().selectOption("8");
    await page.getByRole("button", { name: "Tamamla" }).first().click();
    await expect(page.getByText(/Süre akıyor/)).toBeVisible();
  });
  await step("Isınma seti işaretler", "İkinci seti ısınma olarak işaretlemek ister", async () => {
    await page.getByLabel("Tip:").nth(1).selectOption("warmup");
  });
  await step("Seansı kaydeder", "Seansı bitirip kaydeder ve ilerleme önerisini görür", async () => {
    await page.getByRole("button", { name: "Antrenmanı Bitir & Kaydet" }).click();
    await expect(page.getByText(/Seans Tamamlandı/)).toBeVisible();
  });
  await step("Metinden antrenman ekler", "Dün yaptığı antrenmanı Strong'daki gibi metinle ekler", async () => {
    await page.getByRole("button", { name: "Metinden ekle" }).click();
    const d = page.getByRole("dialog", { name: "Metinden antrenman ekle" });
    await d.getByLabel("Antrenman metni").fill("bench press 5x5 100 rpe 8\nsquat 3x5 140\nromanian deadlift 3x8 120\nhip thrust 3x10 140");
    await d.getByLabel("Seans adı").fill("Dünkü alt vücut");
    await d.getByRole("button", { name: /Seans olarak kaydet/ }).click();
    await d.waitFor({ state: "hidden" });
  });

  // Mert'in son 6 haftası: bench'te 100 kg'da takılmış (plato).
  for (let w = 6; w >= 1; w--) {
    await backfillWorkout(request, BASE, isoDay(-w * 7), "Üst A", [
      ["Bench Press", 100, w > 4 ? 5 : 4, 9],
      ["Bench Press", 100, 4, 9],
      ["Overhead Press", 60, 6, 8],
    ]);
    await backfillWorkout(request, BASE, isoDay(-w * 7 + 2), "Alt A", [
      ["Squat", 130 + (6 - w) * 2.5, 5, 8],
      ["Deadlift", 170 + (6 - w) * 2.5, 3, 8.5],
    ]);
  }

  await step("Güç gelişimine bakar", "İlerleme sayfasında bench press rekorlarını ve platoyu kontrol eder", async () => {
    await page.getByRole("link", { name: "İlerleme" }).click();
    await page.locator("#strength-exercise").selectOption({ label: "Bench Press" });
    await expect(page.getByText("En iyi e1RM")).toBeVisible();
  });
  await step("Haftalık set hacmi", "Kas grubu başına haftalık set sayısına bakar", async () => {
    await expect(page.getByText(/haftalık set/i).first()).toBeVisible();
  });
  await step("Plaka hesabı", "142,5 kg için bara hangi plakaları takacağını hesaplar", async () => {
    await page.getByRole("link", { name: "Antrenman" }).click();
    await page.getByRole("button", { name: "Plaka & 1RM" }).click();
    await page.getByLabel("Hedef Toplam Ağırlık (kg)").fill("142,5");
    await expect(page.getByText(/25/).first()).toBeVisible();
  });
  await step("Egzersiz kütüphanesi", "Kütüphanede 'hip thrust' ve 'face pull' arar", async () => {
    await page.getByRole("button", { name: "Egzersizler" }).click();
    await page.getByLabel("Egzersiz ara").fill("face pull");
    await expect(page.getByRole("button", { name: /Face Pull/i }).first()).toBeVisible();
  });
  await step("Kardiyo ekler", "Bugün 20 dakika bisiklet yaptığını girer", async () => {
    await page.getByRole("button", { name: "Kardiyo" }).click();
    await page.getByLabel("Tür").selectOption("cycle");
    await page.getByLabel("Süre (dk)").fill("20");
    await page.getByRole("button", { name: "Kardiyoyu kaydet" }).click();
  });
  await step("Panoda kalori ve protein", "Kilo alma hedefinde günlük kalori/protein hedefini kontrol eder", async () => {
    await page.getByRole("link", { name: "Ana Panel" }).click();
    await expect(page.getByText(/kcal/).first()).toBeVisible();
  });
});

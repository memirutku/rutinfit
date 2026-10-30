import { test, expect } from "@playwright/test";
import { backfillFood, baseFor, fillWizard, isoDay, journey, saveWizard } from "./harness";

/**
 * Zeynep, 41, öğretmen. İki haftada bir diyetisyene gidiyor; diyetisyen kâğıt üzerinde haftalık
 * menü veriyor ("kahvaltı: 2 yumurta, 1 dilim tam buğday ekmeği, 5 zeytin"). Menüyü girip uymak,
 * ölçülerini kaydetmek ve kontrole rapor götürmek istiyor. Laktoz intoleransı var.
 */
const BASE = baseFor(2);

test("Zeynep: diyetisyen planı, uyum ve rapor", async ({ page, request }) => {
  const { step } = journey(page, "zeynep", { yaş: 41, cinsiyet: "kadın", boy: 160, kilo: 78, hedef: "kilo vermek", özel: "diyetisyenle çalışıyor, laktoz intoleransı" });

  await step("İlk açılış ve sihirbaz", "Profilini girer; diyetisyeninin verdiği 1500 kcal'i aklında tutar", async () => {
    await page.goto(BASE);
    await fillWizard(page, { sex: "Kadın", age: 41, height: 160, weight: 78, activity: /Hafif hareketli/, goal: "Kilo ver", target: 68, rate: "0.5", dayPattern: "Okul", homeTime: "16:30" });
    await saveWizard(page);
  });
  await step("Diyetisyenin hedefini girer", "Ayarlarda kalori hedefini diyetisyenin verdiği 1500 kcal yapar", async () => {
    await page.getByRole("link", { name: "Ayarlar" }).click();
    await page.getByLabel("Kalori Hedefi (kcal)").fill("1500");
    await page.getByLabel("Üst Sınır Tavan (kcal)").fill("1600");
    await page.getByLabel(/Koça notlar/).fill("Laktoz intoleransım var. Diyetisyenim 2 haftada bir kontrol ediyor.");
    await page.getByRole("button", { name: "Hedefleri Güncelle" }).click();
    await expect(page.getByText(/başarıyla güncellendi/)).toBeVisible();
  });
  await step("Haftalık plan ekranı", "Diyetisyen menüsünü girmek için Yemek Planı › Hafta'yı açar", async () => {
    await page.getByRole("link", { name: "Yemek Planı" }).click();
    await page.getByRole("button", { name: "Hafta", exact: true }).click();
    await expect(page.getByRole("button", { name: "+ Öğün" }).first()).toBeVisible();
  });
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(new Date());
  for (const [meal, name] of [
    ["breakfast", "2 yumurta, 1 dilim tam buğday ekmeği, 5 zeytin, domates"],
    ["lunch", "Izgara tavuk 120 g, bulgur pilavı 4 kaşık, salata"],
    ["dinner", "Zeytinyağlı taze fasulye 1 porsiyon, laktozsuz yoğurt 1 kase"],
  ] as const) {
    await step(`Plana ekler: ${meal}`, `Bugüne diyetisyen menüsünden '${name}' satırını girer`, async () => {
      const day = page.getByRole("region", { name: new RegExp(`${today.slice(8, 10)}\\.${today.slice(5, 7)}`) });
      await day.getByRole("button", { name: "+ Öğün" }).click();
      const d = page.getByRole("dialog", { name: "Öğün ekle" });
      await d.getByLabel("Öğün", { exact: true }).selectOption(meal);
      await d.getByLabel("Öğün adı").fill(name);
      await d.getByRole("button", { name: "Kaydet" }).click();
      await d.waitFor({ state: "hidden" });
    });
  }
  await step("Bugünün planı", "Yemek Planı sekmesinde bugünün öğünlerini görür", async () => {
    await page.getByRole("button", { name: "Yemek Planı", exact: true }).click();
    await expect(page.getByText(/2 yumurta/).first()).toBeVisible();
  });
  await step("Kahvaltıyı 'Uygulandı' işaretler", "Plana uyduğunu işaretler", async () => {
    await page.getByRole("group", { name: "Plana uyum" }).first().getByRole("button", { name: "Uygulandı" }).click();
  });
  await step("Kahvaltıyı günlüğe yazar", "'Yedim Olarak Kaydet' ile kalorisinin sayılmasını bekler", async () => {
    await page.getByRole("button", { name: "Yedim Olarak Kaydet" }).first().click();
    await expect(page.getByText(/günlüğe kaydedildi/)).toBeVisible();
  });
  await step("Alışveriş listesi", "Haftanın alışveriş listesine bakar", async () => {
    await page.getByRole("button", { name: "Alışveriş Listesi" }).click();
    await expect(page.getByRole("heading", { name: /Haftalık Alışveriş Listesi/ })).toBeVisible();
  });
  await step("Laktozsuz yoğurdu kataloğa ekler", "Etiketten değerleriyle 'Laktozsuz yoğurt' ekler", async () => {
    await page.getByRole("link", { name: "Besin & Tarif" }).click();
    await page.getByRole("button", { name: "Yeni Besin" }).click();
    const d = page.getByRole("dialog", { name: "Yeni Besin Ekle" });
    await d.getByLabel("Besin Adı").fill("Laktozsuz yoğurt");
    await d.getByLabel(/^Kalori/).fill("61");
    await d.getByLabel(/^Protein/).fill("3,6");
    await d.getByLabel(/^Karbonhidrat/).fill("4,5");
    await d.getByLabel(/^Yağ/).fill("3,2");
    await d.getByRole("button", { name: "Kaydet" }).click();
    await d.waitFor({ state: "hidden" });
  });

  // Önceki 13 gün: çoğunlukla plana uyan kayıtlar ve haftalık tartı/ölçü.
  for (let i = 1; i <= 13; i++) {
    const date = isoDay(-i);
    await backfillFood(request, BASE, date, [
      { mealType: "breakfast", name: "Yumurta, peynir, ekmek", grams: 200, kcal: 380, protein: 22, time: "08:00" },
      { mealType: "lunch", name: "Izgara tavuk, bulgur", grams: 300, kcal: 520, protein: 38, time: "12:30" },
      { mealType: "dinner", name: "Sebze yemeği, yoğurt", grams: 350, kcal: 450, protein: 15, time: "19:00" },
    ]);
    if (i % 7 === 0) await request.put(`${BASE}/api/body-metrics`, { data: { date, waistCm: 92 + i / 7, hipCm: 108 } });
    if (i % 2 === 0) await request.post(`${BASE}/api/progress`, { data: { date, weightKg: 78 - (13 - i) * 0.07 } });
  }

  await step("Ölçülerini girer", "İlerleme sayfasında bel 91, kalça 107 girer", async () => {
    await page.getByRole("link", { name: "İlerleme" }).click();
    await page.getByLabel("Bel (cm)").fill("91");
    await page.getByLabel("Kalça (cm)").fill("107");
    await page.getByRole("button", { name: "Ölçüleri kaydet" }).click();
    await expect(page.getByText("91 cm")).toBeVisible();
  });
  await step("Diyetisyen raporunu açar", "Kontrol için son 2 haftanın raporunu hazırlar", async () => {
    await page.getByRole("link", { name: "Diyetisyen raporu" }).click();
    await page.getByLabel("Başlangıç").fill(isoDay(-13));
    await expect(page.getByRole("heading", { name: "Beslenme ve aktivite raporu" })).toBeVisible();
  });
  await step("Raporu Excel olarak indirir", "Diyetisyenine e-postayla göndermek için Excel indirir", async () => {
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: /Excel indir/ }).click();
    await dl;
    await expect(page.getByText(/Excel indirildi/)).toBeVisible();
  });
});

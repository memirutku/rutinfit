import { test, expect } from "@playwright/test";
import { baseFor, fillWizard, journey, saveWizard } from "./harness";

/**
 * Elif, 22, üniversite öğrencisi. Her şeyi telefonda yapmaya alışkın; uygulamayı dizüstünde dar
 * bir pencerede açıyor (telefon genişliği). Whey ve kreatin kullanıyor, spor salonuna yeni başladı,
 * ilerleme fotoğrafı çekmek ve adet döngüsünü not etmek istiyor. Uzun metin okumaz.
 */
const BASE = baseFor(5);

test("Elif: dar ekran, takviye, hatırlatma, fotoğraf, döngü", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { step } = journey(page, "elif", { yaş: 22, cinsiyet: "kadın", boy: 168, kilo: 60, hedef: "kas kazanmak (hafif kilo alma)", ekran: "390 px (telefon genişliği)" });

  await step("İlk açılış (dar ekran)", "Uygulamayı telefon genişliğinde açar", async () => {
    await page.goto(BASE);
    await expect(page.getByRole("dialog", { name: "Hedeflerini birlikte kuralım" })).toBeVisible();
  });
  await step("Sihirbaz (dar ekran)", "Kadın, 22, 168 cm, 60 kg, orta hareketli, kilo almak", async () => {
    await fillWizard(page, { sex: "Kadın", age: 22, height: 168, weight: 60, activity: /Orta hareketli/, goal: "Kilo al", rate: "0.25" });
    await saveWizard(page);
  });
  await step("Simit ekler", "Kahvaltıda yediği simidi tek tıkla ekler", async () => {
    await page.getByRole("button", { name: "+ Simit" }).click();
    await expect(page.getByText(/Simit/).first()).toBeVisible();
  });
  await step("Ayarları arar", "Takviye eklemek için alt menüde Ayarlar'ı arar", async () => {
    await page.getByRole("link", { name: "Ayarlar" }).click({ timeout: 3000 });
  });
  await step("Ayarlara adresle gider", "Bulamayınca ayarlara başka yoldan ulaşır", async () => {
    await page.goto(`${BASE}/settings`);
    await expect(page.getByRole("heading", { name: "Takviyeler" })).toBeVisible();
  });
  await step("Whey ekler", "Takviyelere 'Whey Protein' 30 g ekler", async () => {
    await page.getByLabel("Takviye adı").fill("Whey Protein");
    await page.getByLabel("Doz", { exact: true }).fill("30");
    await page.getByRole("button", { name: "Takviye ekle" }).click();
    await expect(page.getByText("Whey Protein").first()).toBeVisible();
  });
  await step("Takviye hatırlatması", "Her sabah 09:00'da kreatin hatırlatması kurar", async () => {
    await page.locator("#rem-kind").selectOption("supplement");
    await page.locator("#rem-supp").selectOption({ label: "Kreatin Monohidrat" });
    await page.locator("#rem-time").fill("09:00");
    await page.getByRole("button", { name: "Hatırlatma ekle" }).click();
    await expect(page.getByText(/09:00 · Kreatin Monohidrat al/)).toBeVisible();
  });
  await step("Döngü notunu açar", "Profilde adet döngüsü notunu açar", async () => {
    await page.getByLabel(/Adet döngüsü notu/).check();
    await page.getByRole("button", { name: "Hedefleri Güncelle" }).click();
    await expect(page.getByText(/başarıyla güncellendi/)).toBeVisible();
  });
  await step("Panoda takviyeleri işaretler", "Ana panelde kreatin ve whey'i aldı olarak işaretler", async () => {
    await page.getByRole("link", { name: "Ana Panel" }).click();
    await page.getByRole("button", { name: /Kreatin Monohidrat/ }).click();
    await page.getByRole("button", { name: /Whey Protein/ }).click();
    await expect(page.getByRole("button", { name: /Whey Protein/ })).toHaveAttribute("aria-pressed", "true");
  });
  await step("Döngü ve uyku girer", "Günlük ritimde 'Adet başladı' seçer, uykusunu 6,5 saat yapar ve kaydeder", async () => {
    const s = page.locator("#quick-wellbeing-section");
    await s.getByLabel(/Döngü/).selectOption("period_start");
    await s.getByLabel("Uyku (saat)").fill("6,5");
    await s.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(s.getByText(/Kayıt güncellendi/)).toBeVisible();
  });
  await step("İlerleme sayfasını arar", "Fotoğraf eklemek için alt menüde İlerleme'yi arar", async () => {
    await page.getByRole("link", { name: "İlerleme" }).click({ timeout: 3000 });
  });
  await step("İlerleme fotoğrafı ekler", "İlerleme sayfasına adresle gidip önden fotoğraf yükler", async () => {
    await page.goto(`${BASE}/progress`);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    await page.getByLabel("Fotoğraf", { exact: true }).setInputFiles({ name: "on.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "Fotoğrafı ekle" }).click();
    await expect(page.getByRole("img", { name: /Önden/ }).first()).toBeVisible();
  });
  await step("Koça soru (dar ekran)", "Koça 'Kreatin ne zaman alınmalı?' diye sorar", async () => {
    await page.getByRole("link", { name: "AI Koçu" }).first().click();
    await page.getByPlaceholder(/Sorunuzu yazın/).fill("Kreatin ne zaman alınmalı?");
    await page.getByRole("button", { name: /Gönder/ }).click({ timeout: 3000 });
  });
  await step("Antrenman sayfası (dar ekran)", "Antrenman sayfasına bakar; haftalık planı telefonda okumaya çalışır", async () => {
    await page.getByRole("link", { name: "Antrenman" }).click();
    await expect(page.getByRole("heading", { name: "Haftalık Antrenman Planı" })).toBeVisible();
  });
});

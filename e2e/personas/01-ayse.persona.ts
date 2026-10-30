import { test, expect } from "@playwright/test";
import { backfillFood, baseFor, fillWizard, isoDay, journey, saveWizard } from "./harness";

/**
 * Ayşe, 34, muhasebeci (masa başı). İlk kez bir beslenme uygulaması kullanıyor; evde Türk ev
 * yemekleri pişiriyor. Hedefi 90 kg'dan 75 kg'a inmek. Teknik değil; menüleri tahminle bulur.
 */
const BASE = baseFor(0);

test("Ayşe: ilk hafta, kilo verme, Türk ev yemekleri", async ({ page, request }) => {
  const { step } = journey(page, "ayse", { yaş: 34, cinsiyet: "kadın", boy: 165, kilo: 90, hedef: "75 kg, haftada 0,5 kg", iş: "masa başı", teknik: "düşük" });

  await step("İlk açılış", "Uygulamayı ilk kez açar; ne yapacağını anlamak ister", async () => {
    await page.goto(BASE);
    await expect(page.getByRole("dialog", { name: "Hedeflerini birlikte kuralım" })).toBeVisible();
  });
  await step("Sihirbaz: vücut, hareket, hedef", "Bilgilerini girer: kadın, 34, 165 cm, 90 kg, masa başı, kilo vermek, hedef 75 kg", async () => {
    await fillWizard(page, { sex: "Kadın", age: 34, height: 165, weight: 90, activity: /Hareketsiz/, goal: "Kilo ver", target: 75, rate: "0.5", dayPattern: "Ofis / iş yeri", homeTime: "18:30" });
  });
  await step("Sihirbaz: özet", "Önerilen kalori hedefini okur ve anlamaya çalışır", async () => {
    await expect(page.getByText("Günlük kalori hedefi")).toBeVisible();
  });
  await step("Sihirbazı kaydet", "Kaydeder ve panoya geçer", () => saveWizard(page));

  await step("Hızlı öğün: mercimek çorbası arar", "Öğlen yediği mercimek çorbasını eklemek ister", async () => {
    await page.getByRole("button", { name: "Hızlı Öğün Ekle" }).click();
    const d = page.getByRole("dialog", { name: "Hızlı Öğün Kaydı" });
    await d.getByRole("searchbox", { name: "Besin ara" }).fill("mercimek");
    await expect(d.getByLabel("Besin Seçin").locator("option")).not.toHaveCount(1, { timeout: 3000 });
  });
  await step("Hızlı öğünü kapatır", "Bulamayınca pencereyi kapatır", async () => {
    await page.keyboard.press("Escape");
  });

  await step("Yazarak ekle: ilk deneme", "Yazarak eklemeyi dener: '1 kase mercimek çorbası, 2 dilim ekmek, 1 su bardağı ayran'", async () => {
    await page.getByRole("button", { name: /Yazarak ekle/ }).first().click();
    const d = page.getByRole("dialog", { name: "Yazarak öğün ekle" });
    await d.getByLabel("Ne yedin?").fill("1 kase mercimek çorbası, 2 dilim ekmek, 1 su bardağı ayran");
    await d.getByLabel("Öğün").selectOption("lunch");
    await d.getByRole("button", { name: "Çözümle" }).click();
    await expect(d.getByRole("button", { name: /kalemi kaydet/ })).toBeEnabled({ timeout: 4000 });
  });
  await step("Yazarak ekle penceresini kapatır", "Eşleşme çıkmayınca vazgeçer", async () => {
    await page.keyboard.press("Escape");
  });

  await step("Besin & Tarif sayfasını keşfeder", "Besinleri nereden ekleyeceğini arar", async () => {
    await page.getByRole("link", { name: "Besin & Tarif" }).click();
    await expect(page.getByRole("button", { name: /Besin Kataloğu/ })).toBeVisible();
  });
  await step("Türk ev yemeklerini ekler", "Tarifler sekmesinde Türk ev yemekleri önerisini görür ve ekler", async () => {
    await page.getByRole("button", { name: /^Tarifler/ }).click();
    await page.getByRole("button", { name: /Türk ev yemeklerini ekle/ }).click();
    await expect(page.getByText("Mercimek Çorbası").first()).toBeVisible();
  });

  await step("Yazarak ekle: ikinci deneme", "Panoya dönüp aynı cümleyi tekrar yazar ve kaydeder", async () => {
    await page.getByRole("link", { name: "Ana Panel" }).click();
    await page.getByRole("button", { name: /Yazarak ekle/ }).first().click();
    const d = page.getByRole("dialog", { name: "Yazarak öğün ekle" });
    await d.getByLabel("Ne yedin?").fill("1 kase mercimek çorbası, 2 dilim ekmek, 1 su bardağı ayran");
    await d.getByLabel("Öğün").selectOption("lunch");
    await d.getByRole("button", { name: "Çözümle" }).click();
    await d.getByRole("button", { name: /kalemi kaydet/ }).click();
    await d.waitFor({ state: "hidden" });
  });
  await step("Su ve çay", "İki bardak su ve bir çay içtiğini girer", async () => {
    await page.getByRole("button", { name: "Su bardağı · 200 ml" }).click();
    await page.getByRole("button", { name: "Su bardağı · 200 ml" }).click();
    await page.getByRole("button", { name: "Çay · 1 bardak" }).click();
    await expect(page.getByText(/500 \/ \d/)).toBeVisible();
  });
  await step("Sabah tartısı", "Bugünkü kilosunu girer: 89,6", async () => {
    const s = page.locator("#quick-wellbeing-section");
    await s.getByLabel("Sabah Kilosu (kg)").fill("89,6");
    await s.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(s.getByText(/Kayıt güncellendi/)).toBeVisible();
  });

  // Ayşe uygulamayı önceki 7 gün de kullanmış gibi: öğünler ve tartılar.
  for (let i = 1; i <= 8; i++) {
    const date = isoDay(-i);
    await backfillFood(request, BASE, date, [
      { mealType: "breakfast", name: "Menemen", grams: 250, kcal: 330, protein: 16, time: "08:30" },
      { mealType: "lunch", name: "Kuru Fasulye", grams: 300, kcal: 420, protein: 22, time: "12:30" },
      { mealType: "dinner", name: "Tavuk Sote", grams: 300, kcal: 380, protein: 40, time: "19:30" },
      ...(i % 3 === 0 ? [{ mealType: "extra", name: "Baklava", grams: 80, kcal: 340, protein: 4, time: "21:30" }] : []),
    ]);
    await request.post(`${BASE}/api/progress`, { data: { date, weightKg: 90.4 - (8 - i) * 0.1 } });
  }

  await step("Gün sonu panoya bakar", "Bugünkü toplamını ve hedefini görür", async () => {
    await page.reload();
    await expect(page.getByText("Bugün Kaydedilen Öğünler")).toBeVisible();
  });
  await step("İlerleme sayfası", "Haftanın nasıl geçtiğini görmek ister", async () => {
    await page.getByRole("link", { name: "İlerleme" }).click();
    await expect(page.getByRole("heading", { name: "Haftalık değerlendirme" })).toBeVisible();
  });
  await step("Geçen haftayı değerlendir", "Haftalık değerlendirmeyi ister", async () => {
    await page.getByRole("button", { name: "Geçen haftayı değerlendir" }).click();
    await expect(page.getByText("Bu haftanın tek adımı:")).toBeVisible({ timeout: 20_000 });
  });
});

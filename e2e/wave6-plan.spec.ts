import fs from "node:fs";
import * as XLSX from "xlsx";
import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect, uniq } from "./fixtures";

/**
 * Dalga 6, alan C: yemek planı, alışveriş listesi ve diyetisyen raporu (Zeynep'in bulguları).
 * Testler aynı veritabanını paylaşır; her test kendi (rastgele, uzak) gününde çalışır.
 */

/** Paylaşılan veritabanında başka testlerle çakışmayan bir gün (2031–2040). */
function uniqDate(): string {
  const day = new Date(Date.UTC(2031, 0, 1) + Math.floor(Math.random() * 3650) * 86_400_000);
  return day.toISOString().slice(0, 10);
}
const dayLabel = (iso: string) => new RegExp(`${iso.slice(8, 10)}\\.${iso.slice(5, 7)}`);

async function openDay(page: Page, date: string) {
  await page.goto("/nutrition");
  await page.getByLabel("Tarih:").fill(date);
}

async function recipeMeal(api: APIRequestContext, date: string, mealType: string, label: string) {
  const food = await (await api.post("/api/foods", { data: { name: uniq(`${label} besini`), calories: 200, proteinG: 10, carbsG: 30, fatG: 5 } })).json();
  const recipe = await (await api.post("/api/recipes", { data: { name: uniq(label), ingredients: [{ foodItemId: food.id, grams: 200 }] } })).json();
  const res = await api.post("/api/meal-plans/meals", { data: { date, mealType, recipeId: recipe.id, servings: 1 } });
  expect(res.ok()).toBe(true);
  return recipe as { id: string; name: string };
}

test.describe("Dalga 6 · plan, alışveriş ve rapor", () => {
  test("B08: günlük plan haftalık editörde girilen menüyü gösterir; plan yoksa boş durum çıkar", async ({ page, api }) => {
    const date = uniqDate();
    const menu = uniq("2 yumurta, 1 dilim tam buğday ekmeği, 5 zeytin");
    await openDay(page, date);

    // Plan yok: sabit örnek öğün yerine boş durum ve haftalık editöre bağlantı.
    await expect(page.getByText("Bu gün için planlı öğün yok.")).toBeVisible();
    await expect(page.getByText(/Yulaflı Lorlu|Fırın Tavuk Göğsü|Muzlu Yoğurt/)).toHaveCount(0);
    await page.getByRole("link", { name: "Hafta'dan ekle" }).click();

    const day = page.getByRole("region", { name: dayLabel(date) });
    await day.getByRole("button", { name: "+ Öğün" }).click();
    const dialog = page.getByRole("dialog", { name: "Öğün ekle" });
    await dialog.getByLabel("Öğün", { exact: true }).selectOption("breakfast");
    await dialog.getByLabel("Öğün adı").fill(menu);
    await dialog.getByRole("button", { name: "Kaydet" }).click();
    await expect(dialog).toBeHidden();

    const lunch = await recipeMeal(api, date, "lunch", "E2E Izgara tavuk");
    await page.getByRole("button", { name: "Yemek Planı", exact: true }).click();

    const breakfast = page.getByRole("article", { name: menu });
    await expect(breakfast).toBeVisible();
    await expect(breakfast).toContainText("Kahvaltı");
    await expect(breakfast).toContainText("Tarife bağlı değil");
    await expect(breakfast).not.toContainText("kcal");

    const lunchCard = page.getByRole("article", { name: lunch.name });
    await expect(lunchCard).toContainText("Öğle Yemeği");
    await expect(lunchCard).toContainText("400 kcal");
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(page.getByText(/Yulaflı Lorlu|Fırın Tavuk Göğsü|Muzlu Yoğurt/)).toHaveCount(0);
  });

  test("B03: Yemek Planı başlığı profildeki hedefi gösterir ve 'sayıları gizle'ye uyar", async ({ page, api }) => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...original } = await (await api.get("/api/profile")).json();
    try {
      const put = await api.put("/api/profile", {
        data: { ...original, sex: "female", calorieTarget: 1500, calorieCeiling: 1600, proteinTargetG: 110, carbTargetG: 150, fatTargetG: 50, isOnboarded: true, hideNumbers: false },
      });
      expect(put.ok()).toBe(true);
      await page.goto("/nutrition");
      await expect(page.getByText("Hedef: 1.500 kcal · 110 g protein · 150 g karbonhidrat · 50 g yağ")).toBeVisible();
      await expect(page.getByText(/2\.080/)).toHaveCount(0);

      await api.put("/api/profile", { data: { ...original, sex: "female", calorieTarget: 1500, calorieCeiling: 1600, isOnboarded: true, hideNumbers: true } });
      await page.reload();
      await expect(page.getByText(/Sayılar gizli/)).toBeVisible();
      await expect(page.getByText(/1\.500 kcal/)).toHaveCount(0);
    } finally {
      await api.put("/api/profile", { data: original });
    }
  });

  test("B09: tarifsiz plan öğünü kalori girilerek ya da katalogla eşleştirilerek kaydedilir", async ({ page, api }) => {
    const date = uniqDate();
    const menu = uniq("Zeytinyağlı taze fasulye, laktozsuz yoğurt");
    const food = await (await api.post("/api/foods", { data: { name: uniq("E2E Bulgur"), calories: 350, proteinG: 12, carbsG: 70, fatG: 2 } })).json();
    const matchable = `120 g ${food.name}`;
    for (const [mealType, customName] of [["dinner", menu], ["lunch", matchable]]) {
      expect((await api.post("/api/meal-plans/meals", { data: { date, mealType, customName, servings: 1 } })).ok()).toBe(true);
    }
    await openDay(page, date);

    // 1) Kalori girerek
    const dinner = page.getByRole("article", { name: menu });
    await dinner.getByRole("button", { name: "Yedim Olarak Kaydet" }).click();
    let dialog = page.getByRole("dialog", { name: "Planlı öğünü kaydet" });
    await dialog.getByLabel("Kalori (kcal)").fill("420");
    await dialog.getByLabel("Protein (g)").fill("18,5");
    await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/günlüğe kaydedildi/)).toBeVisible();
    await expect(dinner.getByRole("button", { name: "Uygulandı" })).toHaveAttribute("aria-pressed", "true");

    // 2) Katalogla eşleştirerek
    await page.getByRole("article", { name: matchable }).getByRole("button", { name: "Yedim Olarak Kaydet" }).click();
    dialog = page.getByRole("dialog", { name: "Planlı öğünü kaydet" });
    await dialog.getByRole("tab", { name: "Katalogla eşleştir" }).click();
    await expect(dialog.getByText("420 kcal")).toBeVisible();
    await dialog.getByRole("button", { name: "1 kalemi kaydet" }).click();
    await expect(dialog).toBeHidden();

    const logs = (await (await api.get(`/api/food-logs?date=${date}`)).json()).logs;
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: menu, mealType: "dinner", caloriesSnapshot: 420, proteinSnapshot: 18.5, grams: 0 }),
        expect.objectContaining({ name: food.name, mealType: "lunch", foodItemId: food.id, grams: 120, caloriesSnapshot: 420 }),
      ])
    );
  });

  test("B09: alışveriş listesi tarifsiz öğünlerin nedenini yazar; elle kalem eklenir ve yenilemede kalır", async ({ page, api }) => {
    const date = uniqDate();
    const menu = uniq("2 yumurta, 1 dilim ekmek");
    const item = uniq("Laktozsuz yoğurt");
    await api.post("/api/meal-plans/meals", { data: { date, mealType: "breakfast", customName: menu, servings: 1 } });
    await openDay(page, date);
    await page.getByRole("button", { name: "Alışveriş Listesi" }).click();

    const note = page.getByRole("note", { name: "Listeye girmeyen öğünler" });
    await expect(note).toContainText("1 öğün tarife bağlı değil");
    await expect(note).toContainText(menu);

    await page.getByLabel("Kalem adı").fill(item);
    await page.getByLabel("Miktar").fill("2");
    await page.getByRole("button", { name: "Kalemi ekle" }).click();
    await expect(page.getByRole("checkbox", { name: new RegExp(item) })).toContainText("2 adet");

    await page.getByRole("button", { name: "Kileri Düşerek Yenile" }).click();
    await expect(page.getByText(/kiler stokları düşülerek güncellendi/)).toBeVisible();
    await expect(page.getByRole("checkbox", { name: new RegExp(item) })).toBeVisible();

    await page.getByRole("button", { name: `${item} sil` }).click();
    await expect(page.getByRole("checkbox", { name: new RegExp(item) })).toHaveCount(0);
  });

  test("B43: rapor ölçüleri, haftalık uyumu ve plan–gerçekleşeni gösterir; yazdırma ve Excel'de de var", async ({ page, api }) => {
    // Paylaşılan veritabanında başka testlerin dokunmadığı geçmiş iki hafta (Pazartesi başlangıçlı).
    const monday = new Date(Date.UTC(2016, 0, 4) + Math.floor(Math.random() * 400) * 7 * 86_400_000).toISOString().slice(0, 10);
    const day = (offset: number) => new Date(Date.parse(`${monday}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
    const from = day(0);
    const to = day(13);
    const breakfast = uniq("2 yumurta, 5 zeytin");

    await api.put("/api/body-metrics", { data: { date: day(0), waistCm: 93, hipCm: 108 } });
    await api.put("/api/body-metrics", { data: { date: day(13), waistCm: 91, hipCm: 107 } });
    const lunch = await recipeMeal(api, day(1), "lunch", "E2E Bulgur pilavı"); // 400 kcal
    const planned = await (await api.post("/api/meal-plans/meals", { data: { date: day(1), mealType: "breakfast", customName: breakfast, servings: 1 } })).json();
    const plan = (await (await api.get(`/api/meal-plans?date=${day(1)}`)).json())[0];
    const lunchMeal = plan.meals.find((m: { recipeId: string | null }) => m.recipeId === lunch.id);
    await api.patch("/api/meal-plans/adherence", { data: { plannedMealId: planned.id, adherence: "done" } });
    await api.patch("/api/meal-plans/adherence", { data: { plannedMealId: lunchMeal.id, adherence: "partial" } });
    await api.post("/api/food-logs", { data: { date: day(1), time: "08:00", mealType: "breakfast", name: breakfast, caloriesSnapshot: 350, proteinSnapshot: 20 } });
    await api.post("/api/food-logs", { data: { date: day(1), time: "12:30", mealType: "lunch", recipeId: lunch.id, name: lunch.name, servings: 1.5 } });
    await api.post("/api/food-logs", { data: { date: day(8), time: "19:00", mealType: "dinner", name: uniq("Taze fasulye"), caloriesSnapshot: 300 } });

    await page.goto("/report");
    await page.getByLabel("Başlangıç").fill(from);
    await page.getByLabel("Bitiş").fill(to);
    await expect(page.getByRole("heading", { name: "Beslenme ve aktivite raporu" })).toBeVisible();

    const waist = page.getByRole("region", { name: "Vücut ölçüleri" }).getByRole("row", { name: /^Bel \d/ });
    await expect(waist).toContainText("93 cm");
    await expect(waist).toContainText("91 cm");
    await expect(waist).toContainText("-2 cm");

    await expect(page.getByRole("region", { name: "Plana uyum" }).getByRole("row", { name: dayLabel(from) })).toContainText("%75");
    const lunchRow = page.getByRole("region", { name: "Plan ve gerçekleşen" }).getByRole("row", { name: new RegExp(lunch.name) });
    await expect(lunchRow).toContainText("400");
    await expect(lunchRow).toContainText("600");
    await expect(lunchRow).toContainText("+200");
    await expect(lunchRow).toContainText("Kısmen");

    const summary = page.getByRole("region", { name: "Özet" });
    await expect(summary.getByRole("group", { name: "Ort. kalori" })).toHaveAttribute("data-status", /ok|warn|off/);
    await expect(summary.getByRole("group", { name: "Plana uyum" })).toContainText("%75");

    const log = page.getByRole("region", { name: "Öğün günlüğü" });
    await expect(log.getByRole("group")).toHaveCount(2);
    await expect(log.getByRole("group", { name: dayLabel(day(1)) })).toContainText("950 kcal");

    // Yazdırma görünümü: kontroller gizlenir, yeni bölümler kalır.
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: /Excel indir/ })).toBeHidden();
    await expect(page.getByRole("region", { name: "Vücut ölçüleri" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Plan ve gerçekleşen" })).toBeVisible();
    await page.emulateMedia({ media: "screen" });

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Excel indir/ }).click();
    // xlsx'in ESM derlemesi dosya sistemi taşımaz: dosya Node ile okunur.
    const wb = XLSX.read(fs.readFileSync((await (await download).path())!), { type: "buffer" });
    expect(wb.SheetNames).toEqual(expect.arrayContaining(["Ölçüler", "Plana uyum", "Plan ve gerçekleşen"]));
    expect(XLSX.utils.sheet_to_json(wb.Sheets["Ölçüler"])).toContainEqual(expect.objectContaining({ Ölçü: "Bel (cm)", İlk: 93, Son: 91, Fark: -2 }));
  });
});

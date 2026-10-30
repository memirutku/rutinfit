import { test, expect, todayStr, uniq } from "./fixtures";

/** Dalga 3 (beslenme derinliği + koç) akışları. */
test.describe("Dalga 3", () => {
  test("F73: besine kendi ölçüsü eklenir", async ({ page, api }) => {
    const name = uniq("E2E Ölçü Besini");
    await api.post("/api/foods", { data: { name, calories: 100, proteinG: 5, carbsG: 10, fatG: 4 } });
    await page.goto("/foods");
    await page.getByPlaceholder(/Besin ara/).fill(name.toLocaleLowerCase("tr-TR"));
    await page.getByRole("button", { name: `${name} ölçüleri` }).click();
    const dialog = page.getByRole("dialog", { name: `${name} · ev ölçüleri` });
    await dialog.getByLabel("Ölçü", { exact: true }).selectOption("yemek kaşığı");
    await dialog.getByLabel("Gram", { exact: true }).fill("17");
    await dialog.getByRole("button", { name: "Ölçüyü kaydet" }).click();
    await expect(dialog.getByText(/yemek kaşığı · 17 g · senin tartımın/)).toBeVisible();
  });

  test("F74: Türk ev yemekleri tarif olarak eklenir", async ({ page, api }) => {
    await page.goto("/foods");
    await page.getByRole("button", { name: /Tarifler \(/ }).click();
    const install = page.getByRole("button", { name: /Türk ev yemeklerini ekle/ });
    // Aynı veritabanını paylaşan önceki proje kataloğu kurmuş olabilir.
    if (await install.isVisible()) {
      await install.click();
      await expect(install).toBeHidden();
    }
    const recipes = await (await api.get("/api/recipes")).json();
    expect(recipes.some((r: any) => r.name === "Mercimek Çorbası")).toBe(true);
    await expect(page.getByText("Mercimek Çorbası").first()).toBeVisible();
  });

  test("F06: yazarak girilen öğün çözümlenip kaydedilir", async ({ page, api }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Yazarak ekle/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Yazarak öğün ekle" });
    await dialog.getByLabel("Ne yedin?").fill("137 g tavuk göğsü");
    await dialog.getByRole("button", { name: "Çözümle" }).click();
    await expect(dialog.getByRole("list", { name: "Önizleme" })).toBeVisible();
    await dialog.getByRole("button", { name: "1 kalemi kaydet" }).click();
    await expect(dialog).toBeHidden();
    const logs = (await (await api.get(`/api/food-logs?date=${todayStr()}`)).json()).logs;
    expect(logs.some((l: any) => /Tavuk/.test(l.name) && l.grams === 137)).toBe(true);
  });

  test("F30: haftalık plana serbest adlı öğün eklenir", async ({ page }) => {
    const name = uniq("E2E Hafta Öğünü");
    await page.goto("/nutrition");
    await page.getByRole("button", { name: "Hafta" }).click();
    await page.getByRole("button", { name: "+ Öğün" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Öğün ekle" });
    await dialog.getByLabel("Öğün adı").fill(name);
    await dialog.getByRole("button", { name: "Kaydet" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name)).toBeVisible();
  });

  test("F52: koça notlar kaydedilir ve sayfa yenilenince durur", async ({ page }) => {
    const note = uniq("E2E: dizimde sakatlık var");
    await page.goto("/settings");
    const notes = page.getByLabel(/Koça notlar/);
    await notes.fill(note);
    await page.getByRole("button", { name: "Hedefleri Güncelle" }).click();
    await expect(page.getByRole("button", { name: "Hedefleri Güncelle" })).toBeEnabled();
    await page.reload();
    await expect(page.getByLabel(/Koça notlar/)).toHaveValue(note);
  });

  test("F50: geçmiş sorusu kayıtlardan hesaplanan kartla yanıtlanır", async ({ page, api }) => {
    await api.post("/api/cardio", { data: { date: todayStr(), kind: "run", durationMin: 30, distanceKm: 5.5 } });
    await page.goto("/coach");
    await page.getByPlaceholder(/Sorunuzu yazın/).fill("Bu hafta kaç km koştum?");
    await page.getByRole("button", { name: /Gönder/ }).click();
    // B31: koşu sorusu yalnız koşuyu toplar; başlık türü söyler, kart kaynağını belirtir.
    await expect(page.getByText("Koşu · Bu hafta").last()).toBeVisible();
    await expect(page.getByText("Kayıtlarından hesaplandı").last()).toBeVisible();
    await page.getByText("Kaynak kayıtlar").last().click();
    await expect(page.getByText(/5,5 km/).last()).toBeVisible();
  });

  test("F49 + F10: geçen hafta değerlendirilir; özet ve dayanakları görünür", async ({ page, mocks }) => {
    const summary = uniq("E2E haftalık özet");
    await mocks.queueLLM(summary);
    await page.goto("/progress");
    await expect(page.getByRole("heading", { name: "Gerçek harcama tahmini" })).toBeVisible();
    await page.getByRole("button", { name: "Geçen haftayı değerlendir" }).click();
    await expect(page.getByText(summary)).toBeVisible();
    await expect(page.getByText("AI özeti")).toBeVisible();
    await expect(page.getByText("Bu haftanın tek adımı:")).toBeVisible();
    await page.getByText("Bu değerlendirme neye dayanıyor?").click();
    await expect(page.getByText(/\d\/7 gün/)).toBeVisible();
  });
});

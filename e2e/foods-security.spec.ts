import { test, expect, uniq } from "./fixtures";

test.describe("Besin kataloğu ve Open Food Facts (sahte)", () => {
  test("Türkçe büyük/küçük harf duyarsız arama", async ({ page, api }) => {
    const name = uniq("İnek Sütü E2E");
    await api.post("/api/foods", { data: { name, calories: 60, proteinG: 3, carbsG: 5, fatG: 3 } });
    await page.goto("/foods");
    await page.getByPlaceholder(/Besin ara/).fill("inek sütü e2e");
    await expect(page.getByText(name)).toBeVisible();
  });

  test("barkodla bulunan ürün kataloğa kaydedilir", async ({ page, api }) => {
    await page.goto("/foods");
    await page.getByRole("button", { name: /Paketli Gıda & Barkod/ }).click();
    await page.getByPlaceholder(/Barkod numarası/).fill("8690000000017");
    await page.getByRole("button", { name: /Ürün Ara/ }).click();
    await expect(page.getByText("Test Granola").first()).toBeVisible();
    await page.getByRole("button", { name: /Kataloğa Kaydet/ }).first().click();
    await expect
      .poll(async () => (await (await api.get("/api/foods?search=granola")).json()).some((f: any) => f.barcode === "8690000000017"))
      .toBe(true);
  });

  test("bulunamayan barkod için açıklayıcı mesaj gösterilir", async ({ page }) => {
    await page.goto("/foods");
    await page.getByRole("button", { name: /Paketli Gıda & Barkod/ }).click();
    await page.getByPlaceholder(/Barkod numarası/).fill("8690000000999");
    await page.getByRole("button", { name: /Ürün Ara/ }).click();
    await expect(page.getByText(/bulunamadı/).first()).toBeVisible();
  });
});

test.describe("Güvenlik (gerçek tarayıcı)", () => {
  test("başka bir siteden gelen form gönderimi veri yazamaz", async ({ page, api, baseURL }) => {
    const before = (await (await api.get("/api/progress")).json()).weights.length;
    // Saldırgan sayfa: farklı köken (data: URL) → tarayıcı Sec-Fetch-Site: cross-site gönderir
    await page.goto("data:text/html,<html><body>evil</body></html>");
    await page.evaluate(async (target) => {
      await fetch(`${target}/api/progress`, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ date: "2030-01-01", weightKg: 1 }),
      }).catch(() => {});
    }, baseURL!);
    const after = (await (await api.get("/api/progress")).json()).weights;
    expect(after.length).toBe(before);
    expect(after.some((w: any) => w.date === "2030-01-01")).toBe(false);
  });
});

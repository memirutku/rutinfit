import fs from "node:fs";
import { test, expect } from "./fixtures";

test.describe("Ayarlar ve yedekleme", () => {
  test("kalori hedefi değişince ana panel yeni hedefi gösterir", async ({ page, api }) => {
    const original = await (await api.get("/api/profile")).json();
    await page.goto("/settings");
    await page.getByLabel("Kalori Hedefi (kcal)").fill("1950");
    await page.getByRole("button", { name: "Hedefleri Güncelle" }).click();
    await expect.poll(async () => (await (await api.get("/api/profile")).json()).calorieTarget).toBe(1950);

    await page.goto("/");
    await expect(page.getByText("/ 1950 kcal")).toBeVisible();
    await api.put("/api/profile", { data: { ...original, isOnboarded: undefined, id: undefined, createdAt: undefined, updatedAt: undefined } });
  });

  test("yedek indirilir ve aynı dosya geri yüklenebilir", async ({ page }, testInfo) => {
    await page.goto("/settings");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Tüm Verileri JSON Olarak İndir/ }).click(),
    ]);
    const file = testInfo.outputPath("backup.json");
    await download.saveAs(file);
    const backup = JSON.parse(fs.readFileSync(file, "utf-8"));
    expect(backup.version).toBe("2.0");
    expect(backup.data.foodItem.length).toBeGreaterThan(0);

    page.once("dialog", (d) => d.accept());
    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.getByRole("status").filter({ hasText: "Yedek başarıyla geri yüklendi" })).toBeVisible();
  });

  test("bozuk yedek dosyası hata olarak gösterilir ve onay kutusu sorulur", async ({ page }, testInfo) => {
    const file = testInfo.outputPath("bozuk.json");
    fs.writeFileSync(file, '{"version":"2.0","data":{"foodLog":[{"id":"x","caloriesSnapshot":"çok"}]}}');
    await page.goto("/settings");
    let asked = false;
    page.once("dialog", (d) => {
      asked = true;
      d.accept();
    });
    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.getByRole("alert").filter({ hasText: "Yedek dosyası geçersiz" })).toBeVisible();
    expect(asked).toBe(true);
  });
});

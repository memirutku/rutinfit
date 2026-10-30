import { test, expect } from "./fixtures";

/**
 * Dalga 6 · F alanı (ayarlar, gizlilik, veri). WebKit'te ayarlar sayfasında rol/metin seçicileri
 * zaman zaman iç hata verdiği için kimlik (#id) seçicileri kullanılır.
 */
test.describe("Dalga 6 · Ayarlar", () => {
  test("B34: 390 px'te içindekiler görünür, teknik bölümler Gelişmiş altında; anahtar dokununca kaydeder", async ({ page, api }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const original = (await (await api.get("/api/profile")).json()).cycleTracking as boolean;
    try {
      await page.goto("/settings");
      const nav = page.locator('nav[aria-label="Ayarlar bölümleri"]');
      await expect(nav).toBeVisible();
      await expect(nav.locator("a")).toHaveCount(7);
      // Sayfa yatay kaymaz.
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

      // Teknik bölümler kapalı gelir; içindekilerden açılır.
      await expect(page.locator("#tanilama")).toBeHidden();
      await nav.locator('a[href="#gelismis"]').click();
      await expect(page.locator("#gelismis")).toHaveAttribute("open", "");
      await expect(page.locator("#tanilama")).toBeVisible();
      await expect(page.locator("#seffaflik")).toBeVisible();

      // Döngü notu ayrı bir "Kaydet" beklemeden kaydedilir.
      const toggle = page.locator("#settings-cycle-tracking");
      await toggle.scrollIntoViewIfNeeded();
      await toggle.setChecked(!original);
      await expect.poll(async () => (await (await api.get("/api/profile")).json()).cycleTracking).toBe(!original);
      await page.reload();
      await expect(page.locator("#settings-cycle-tracking")).toBeChecked({ checked: !original });
    } finally {
      const profile = await (await api.get("/api/profile")).json();
      const { id: _id, createdAt: _c, updatedAt: _u, isOnboarded: _o, ...rest } = profile;
      await api.put("/api/profile", { data: { ...rest, cycleTracking: original, acknowledgeLowCalorie: true } });
    }
  });
});

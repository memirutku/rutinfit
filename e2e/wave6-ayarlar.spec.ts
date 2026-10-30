import fs from "node:fs";
import { test, expect } from "./fixtures";

const pageHasText = (page: import("@playwright/test").Page, text: string) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), text);

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

  test("B36: yedek yerel saatli adla iner; Finder'da göster ve yolu kopyala çalışır; klasör seçici seçilen klasörü kaydeder", async ({ page, api }, testInfo) => {
    // Gerçek Finder ve klasör penceresi açılmasın: iki yerel işlem isteği sayfada yakalanır.
    const reveals: unknown[] = [];
    await page.route("**/api/system/reveal", async (route) => {
      reveals.push(route.request().postDataJSON());
      await route.fulfill({ json: { ok: true, path: "/" } });
    });
    const folder = testInfo.outputPath("secilen-yedek-klasoru");
    fs.mkdirSync(folder, { recursive: true });
    await page.route("**/api/system/choose-folder", (route) => route.fulfill({ json: { path: folder } }));
    const before = await (await api.get("/api/backup/auto")).json();
    try {
      await page.goto("/settings#yedek");
      const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#backup-export").click()]);
      const name = download.suggestedFilename();
      const m = /^rutinfit-backup-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.json$/.exec(name);
      expect(m, name).toBeTruthy();
      // Ad yerel saattedir (UTC değil): şimdiki yerel zamana iki dakikadan yakın.
      const [y, mo, d, h, mi, se] = m!.slice(1).map(Number);
      expect(Math.abs(new Date(y, mo - 1, d, h, mi, se).getTime() - Date.now())).toBeLessThan(120_000);
      await pageHasText(page, `Yedek indirildi: ${name} (İndirilenler klasörü)`);

      await page.locator(`button[aria-label="İndirilen dosyayı Finder'da göster"]`).click();
      await expect.poll(() => reveals.length).toBe(1);
      expect(reveals[0]).toEqual({ download: name });
      await page.locator(`button[aria-label="Uygulama klasöründeki kopyayı Finder'da göster"]`).click();
      await expect.poll(() => reveals.length).toBe(2);
      expect((reveals[1] as { path: string }).path).toMatch(new RegExp(`backups/${name.replace(/\./g, "\\.")}$`));
      await page.locator(`button[aria-label="Uygulama klasöründeki kopyanın yolunu kopyala"]`).click();
      await pageHasText(page, "Yol kopyalandı");

      // Klasör seçme penceresinden dönen klasör ayrı bir "Kaydet" beklemeden kaydedilir.
      await page.locator("#auto-backup-choose").click();
      await expect.poll(async () => (await (await api.get("/api/backup/auto")).json()).folderPath).toBe(fs.realpathSync(folder));
      await expect(page.locator("#auto-backup-folder")).toHaveValue(fs.realpathSync(folder));
    } finally {
      await api.put("/api/backup/auto", { data: { enabled: false, folderPath: before.folderPath } });
    }
  });
});

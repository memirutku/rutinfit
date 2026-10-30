import fs from "node:fs";
import { test, expect, todayStr } from "./fixtures";

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

  test("B37: Apple Sağlık içe aktarımı hangi kaynağın alındığını ve kaynak dökümünü gösterir", async ({ page, api }) => {
    const day = todayStr();
    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<HealthData locale="tr_TR">`,
      ` <Record type="HKQuantityTypeIdentifierStepCount" sourceName="E2E iPhone" unit="count" startDate="${day} 09:00:00 +0300" endDate="${day} 09:30:00 +0300" value="6000"/>`,
      ` <Record type="HKQuantityTypeIdentifierStepCount" sourceName="E2E Apple Watch" unit="count" startDate="${day} 09:00:00 +0300" endDate="${day} 09:30:00 +0300" value="6400"/>`,
      `</HealthData>`,
    ].join("\n");
    try {
      await page.goto("/progress");
      await page.locator("#apple-health-file").setInputFiles({ name: "export.xml", mimeType: "text/xml", buffer: Buffer.from(xml) });
      await pageHasText(page, "Adım: 1 günde birden çok kaynak vardı; aynı gün için yalnız yüksek kaynak alındı (E2E Apple Watch).");
      await page.locator("details:has(table) > summary").first().click();
      await pageHasText(page, "E2E iPhone");
    } finally {
      await api.delete("/api/apple-health");
    }
  });

  test("B38: tanılama sürümü, günlük yolunu ve bütün tabloları gösterir; yedekten sonra kendiliğinden yenilenir", async ({ page }) => {
    await page.goto("/settings#tanilama");
    await expect(page.locator("#gelismis")).toHaveAttribute("open", "");
    const diag = page.locator("#tanilama");
    await expect(diag).toContainText(/RutinFit \d+\.\d+\.\d+/);
    await expect(diag).toContainText("rutinfit.log");
    await expect(diag).toContainText("Kardiyo kayıtları");
    await expect(diag).toContainText("Apple Sağlık kayıtları");
    const count = async () => Number(/Uygulama klasöründe: (\d+) yedek/.exec((await diag.innerText()) ?? "")?.[1] ?? NaN);
    await expect.poll(count).not.toBeNaN();
    const before = await count();
    await Promise.all([page.waitForEvent("download"), page.locator("#backup-export").click()]);
    // "Yenile"ye basmadan sayı artar.
    await expect.poll(count).toBe(before + 1);
  });

  test("B41: hatırlatmalar takvim dosyası olarak iner; dosya geçerli, haftalık tekrarlı ve alarmlıdır", async ({ page, api }, testInfo) => {
    const title = `E2E Kreatin; al, ${Date.now().toString(36)}`;
    const created = await (await api.post("/api/reminders", { data: { kind: "custom", title, time: "09:00", days: "135" } })).json();
    try {
      await page.goto("/settings#hatirlatmalar");
      const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#reminders-ics").click()]);
      expect(download.suggestedFilename()).toMatch(/^rutinfit-hatirlatmalar-\d{4}-\d{2}-\d{2}\.ics$/);
      const file = testInfo.outputPath("hatirlatmalar.ics");
      await download.saveAs(file);
      const ics = fs.readFileSync(file, "utf8");
      expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
      expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
      const unfolded = ics.replace(/\r\n /g, "");
      const event = unfolded.split("BEGIN:VEVENT").find((e) => e.includes(`UID:${created.id}@rutinfit.local`))!;
      expect(event).toContain(`SUMMARY:${title.replace(/;/g, "\\;").replace(/,/g, "\\,")}\r\n`);
      expect(event).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR\r\n");
      expect(event).toMatch(/DTSTART:\d{8}T090000\r\n/);
      expect(event).toContain("BEGIN:VALARM");
      await pageHasText(page, "(İndirilenler klasörü)");
    } finally {
      await api.delete(`/api/reminders?id=${created.id}`);
    }
  });

  test("B35: 390 px'te şeffaflık tablosu karta döner, sayfa yatay kaymaz; dosya seçiciler Türkçe", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings#seffaflik");
    await expect(page.locator("#seffaflik table")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    // Kart görünümünde başlık satırı gizli, hücreler alt alta.
    expect(await page.locator("#seffaflik tbody tr").first().evaluate((tr) => getComputedStyle(tr).display)).toBe("block");
    await expect(page.locator("#backup-import")).toBeAttached();
    await pageHasText(page, "Yedek dosyası seç (JSON)");

    await page.goto("/progress");
    await pageHasText(page, "Fotoğraf seç");
    for (const id of ["#photo-file", "#apple-health-file"]) {
      // Tarayıcının kendi (İngilizce) dosya düğmesi görünmez; girdi yalnız ekran okuyucu içindir.
      expect(await page.locator(id).evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(1);
    }
  });
});

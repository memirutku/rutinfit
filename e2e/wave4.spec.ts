import zlib from "node:zlib";
import { test, expect, todayStr, uniq } from "./fixtures";

/** Dalga 4 (platform, Türkiye, sağlık verisi) akışları. Ayar değiştiren testler sonunda geri alır. */

const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

function zipOf(name: string, text: string): Buffer {
  const raw = Buffer.from(text, "utf8");
  const data = zlib.deflateRawSync(raw);
  const n = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(zlib.crc32(raw), 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(zlib.crc32(raw), 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(n.length, 28);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(46 + n.length, 12);
  eocd.writeUInt32LE(30 + n.length + data.length, 16);
  return Buffer.concat([local, n, data, central, n, eocd]);
}

const hhmm = () => new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

test.describe("Dalga 4", () => {
  test("F15: ayarlardan eklenen takviye panoda tek tıkla işaretlenir", async ({ page, api }) => {
    const name = uniq("E2E Omega");
    await page.goto("/settings");
    await page.getByLabel("Takviye adı").fill(name);
    await page.getByLabel("Doz", { exact: true }).fill("2");
    await page.getByLabel("Birim").selectOption("kapsül");
    await page.getByRole("button", { name: "Takviye ekle" }).click();
    await expect(page.getByText(name)).toBeVisible();

    await page.goto("/");
    const chip = page.getByRole("button", { name: new RegExp(name) });
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    const list = (await (await api.get(`/api/supplements?date=${todayStr()}`)).json()).supplements;
    expect(list.find((s: any) => s.name === name).takenToday).toBe(true);
  });

  test("F83: vakti gelen hatırlatma uygulama içinde görünür ve bugün tekrar gelmez", async ({ page, api }) => {
    const title = uniq("E2E hatırlatma");
    const created = await (await api.post("/api/reminders", { data: { kind: "custom", title, time: hhmm() } })).json();
    try {
      await page.goto("/");
      await expect(page.getByText(title)).toBeVisible();
      await page.getByRole("button", { name: `${title} hatırlatmasını kapat` }).click();
      await page.reload();
      await page.waitForTimeout(1500);
      await expect(page.getByText(title)).toHaveCount(0);
    } finally {
      await api.delete(`/api/reminders?id=${created.id}`);
    }
  });

  test("F76: Ramazan modu panoda il ve vakitlerle geri sayım gösterir", async ({ page, api }) => {
    try {
      await page.goto("/settings");
      await page.getByLabel("Ramazan modu").check();
      await page.getByLabel("İl", { exact: true }).selectOption("Ankara");
      await expect(page.getByText("Kaydedildi ✓")).toBeVisible();
      await page.goto("/");
      // B26: Ramazan dışında başlık "Ramazan modu" olur ve kalan gün gösterilir; vakitler her durumda görünür.
      await expect(page.getByText(/^Ramazan( modu)? · Ankara$/)).toBeVisible();
      await expect(page.getByText(/(İmsak|imsak) \d{2}:\d{2} · (İftar|iftar) \d{2}:\d{2}/)).toBeVisible();
    } finally {
      await api.put("/api/fasting/settings", { data: { ramadanMode: false } });
    }
  });

  test("F14: aralıklı oruç başlatılır ve bitirilir", async ({ page, api }) => {
    await api.put("/api/fasting/settings", { data: { ramadanMode: false, fastingTargetHours: 16 } });
    try {
      await page.goto("/");
      await page.getByRole("button", { name: "Orucu başlat (16 sa)" }).click();
      await expect(page.getByRole("button", { name: "Orucu bitir" })).toBeVisible();
      await page.getByRole("button", { name: "Orucu bitir" }).click();
      await expect(page.getByText(/Son \d+ oruç: \d+ kez hedef tuttu/)).toBeVisible();
    } finally {
      await api.post("/api/fasting/stop", { data: {} });
      await api.put("/api/fasting/settings", { data: { fastingTargetHours: null } });
    }
  });

  test("F16: ölçü kaydedilir; fotoğraf eklenir ve galeride görünür", async ({ page }) => {
    await page.goto("/progress");
    await page.getByLabel("Bel (cm)").fill("97,5");
    await page.getByRole("button", { name: "Ölçüleri kaydet" }).click();
    await expect(page.getByText("97,5 cm")).toBeVisible();

    const before = await page.getByRole("img", { name: /Önden/ }).count();
    await page.getByLabel("Fotoğraf", { exact: true }).setInputFiles({ name: "on.png", mimeType: "image/png", buffer: PNG_1X1 });
    await page.getByRole("button", { name: "Fotoğrafı ekle" }).click();
    await expect.poll(() => page.getByRole("img", { name: /Önden/ }).count()).toBeGreaterThan(before);
  });

  test("F62: Apple Sağlık export.zip tarayıcıda okunur ve özet görünür", async ({ page }) => {
    const d = todayStr();
    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<HealthData locale="tr_TR">`,
      ` <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="${d} 08:00:00 +0300" endDate="${d} 08:10:00 +0300" value="4321"/>`,
      ` <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Watch" unit="count/min" startDate="${d} 07:00:00 +0300" endDate="${d} 07:00:00 +0300" value="58"/>`,
      `</HealthData>`,
    ].join("\n");
    await page.goto("/progress");
    await page.getByLabel("Apple Sağlık dışa aktarımı (export.zip)").setInputFiles({ name: "export.zip", mimeType: "application/zip", buffer: zipOf("apple_health_export/export.xml", xml) });
    await expect(page.getByText(/2 kayıt içe aktarıldı/)).toBeVisible();
    await expect(page.getByText("58 atım/dk")).toBeVisible();
  });

  test("F77: diyetisyen raporu açılır ve Excel indirilir", async ({ page }) => {
    await page.goto("/progress");
    await page.getByRole("link", { name: "Diyetisyen raporu" }).click();
    await expect(page.getByRole("heading", { name: "Beslenme ve aktivite raporu" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Günlük tablo" })).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Excel indir/ }).click();
    expect((await download).suggestedFilename()).toMatch(/^rutinfit-diyetisyen-raporu-.*\.xlsx$/);
    await expect(page.getByText(/Excel indirildi/)).toBeVisible();
  });

  test("F82: döngü notu açılınca günlük ritimde seçilip kaydedilir", async ({ page, api }) => {
    const profile = await (await api.get("/api/profile")).json();
    const { id: _id, createdAt: _c, updatedAt: _u, ...body } = profile;
    try {
      await api.put("/api/profile", { data: { ...body, cycleTracking: true } });
      await page.goto("/");
      await page.getByLabel(/Döngü/).selectOption("period_start");
      await page.locator("#quick-wellbeing-section").getByRole("button", { name: "Kaydet", exact: true }).click();
      await expect.poll(async () => (await (await api.get("/api/progress")).json()).today.cycleNote).toBe("period_start");
    } finally {
      await api.post("/api/progress", { data: { date: todayStr(), cycleNote: null } });
      await api.put("/api/profile", { data: { ...body, cycleTracking: false } });
    }
  });
});

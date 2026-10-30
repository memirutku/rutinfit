import { test, expect, todayStr, uniq } from "./fixtures";

/** Dalga 2 (antrenman derinliği) akışları. */
test.describe("Dalga 2", () => {
  test("F25: kütüphane Türkçe karakter gerektirmeden arar ve ipuçlarını gösterir", async ({ page }) => {
    await page.goto("/workouts");
    await page.getByRole("button", { name: "Egzersizler" }).click();
    await page.getByLabel("Egzersiz ara").fill("sinav");
    await page.getByRole("button", { name: /Şınav/ }).first().click();
    await expect(page.getByText("Baştan topuğa düz bir çizgi koru.")).toBeVisible();
  });

  test("F28: metinden yazılan antrenman önizlenir ve seans olarak kaydedilir", async ({ page, api }) => {
    await page.goto("/workouts");
    await page.getByRole("button", { name: "Metinden ekle" }).click();
    const dialog = page.getByRole("dialog", { name: "Metinden antrenman ekle" });
    const name = uniq("E2E Metin");
    await dialog.getByLabel("Antrenman metni").fill("squat 2x5 60\nşınav 1x12 rpe 8");
    await dialog.getByLabel("Seans adı").fill(name);
    await expect(dialog.getByText(/Pushup · 1 set/)).toBeVisible();
    await dialog.getByRole("button", { name: "Seans olarak kaydet (3 set)" }).click();
    await expect(dialog).toBeHidden();
    const sessions = (await (await api.get(`/api/workouts?date=${todayStr()}`)).json()).sessions;
    const saved = sessions.find((s: any) => s.name === name);
    expect(saved.setLogs).toHaveLength(3);
    expect(saved.setLogs.find((s: any) => s.exerciseName === "Pushup").rpe).toBe(8);
  });

  test("F17: şablon editörüyle not değiştirilir", async ({ page, api }) => {
    const sunday = (await (await api.get("/api/workouts")).json()).templates.find((t: any) => t.dayOfWeek === 7);
    await page.goto("/workouts");
    await page.getByRole("button", { name: `${sunday.name} şablonunu düzenle` }).last().click();
    const dialog = page.getByRole("dialog", { name: "Şablonu düzenle" });
    const note = uniq("E2E not");
    await dialog.getByLabel("Not").fill(note);
    await dialog.getByRole("button", { name: "Şablonu kaydet" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(note)).toBeVisible();
  });

  test("F27: kardiyo kaydı listede tempo ve süreyle görünür", async ({ page }) => {
    await page.goto("/workouts");
    await page.getByRole("button", { name: "Kardiyo" }).click();
    await page.getByLabel("Tür").selectOption("run");
    await page.getByLabel("Süre (dk)").fill("27,5");
    await page.getByLabel("Mesafe (km)").fill("5");
    await page.getByRole("button", { name: "Kardiyoyu kaydet" }).click();
    await expect(page.getByText(/5:30 \/km/).first()).toBeVisible();
  });

  test("F51: günlük durumda ölçek seçilince hazır olma skoru görünür", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Kas ağrısı 2/5" }).click();
    // Recheck: tek girdiden skor çıkmaz; ikinci girdiyle görünür.
    await page.getByRole("button", { name: "Ruh hâli 4/5" }).click();
    await expect(page.getByText(/Hazır olma: \d+ · (Düşük|Orta|Yüksek)/)).toBeVisible();
  });
});

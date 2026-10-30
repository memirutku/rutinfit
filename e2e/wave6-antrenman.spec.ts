import { test, expect, todayStr } from "./fixtures";
import type { Page, Request } from "@playwright/test";

/** Dalga 6, D alanı (antrenman): persona bulguları B17–B20 kilit akışları. */

const DRAFT_KEY = "rutinfit_active_workout_draft";

/** Antrenman sayfasını taslaksız açar; önceki seans ağırlıkları yüklenene kadar bekler. */
async function openWorkouts(page: Page) {
  await page.goto("/workouts");
  await page.evaluate((k) => localStorage.removeItem(k), DRAFT_KEY);
  const lastSets = page.waitForResponse((r) => r.url().includes("/api/workouts/last-sets"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Haftalık Antrenman Planı" })).toBeVisible();
  await lastSets;
}

const isWorkoutPost = (r: Request) => r.method() === "POST" && new URL(r.url()).pathname === "/api/workouts";

test.describe("Dalga 6 · Antrenman", () => {
  test("B17: tamamlanmayan setler kaydedilmez; ağırlık 40 kg ile değil boş ya da önceki seansla başlar", async ({ page, api }) => {
    await openWorkouts(page);
    await page.getByRole("button", { name: /^Başla \(/ }).first().click();
    await expect(page.getByRole("button", { name: "Antrenmanı Bitir & Kaydet" })).toBeVisible();

    // Ağırlık alanları ya boş ya da o egzersizin son seansındaki ağırlıkla dolu; sabit 40 yok.
    const swapLabel = await page.getByRole("button", { name: / egzersizini değiştir$/ }).first().getAttribute("aria-label");
    const firstExercise = swapLabel!.replace(/ egzersizini değiştir$/, "");
    const last = await (await api.get(`/api/workouts/last-sets?exercise=${encodeURIComponent(firstExercise)}`)).json();
    const expected = last[firstExercise]?.sets?.[0]?.weightKg;
    await expect(page.getByLabel("Ağırlık:").first()).toHaveValue(expected === undefined ? "" : String(expected).replace(".", ","));

    const sets = await page.getByLabel("Ağırlık:").count();
    await page.getByLabel("Ağırlık:").first().fill("100");
    await page.getByLabel("Tekrar:").first().fill("5");
    await page.getByRole("button", { name: "Tamamla" }).first().click();

    await page.getByRole("button", { name: "Antrenmanı Bitir & Kaydet" }).click();
    const prompt = page.getByRole("group", { name: `${sets - 1} set tamamlanmadı.` });
    await expect(prompt).toBeVisible();

    const posted = page.waitForRequest(isWorkoutPost);
    const response = page.waitForResponse((r) => isWorkoutPost(r.request()));
    await prompt.getByRole("button", { name: "At ve kaydet" }).click();
    const body = (await posted).postDataJSON();
    expect(body.setLogs).toHaveLength(1);
    expect(body.setLogs[0]).toMatchObject({ exerciseName: firstExercise, weightKg: 100, reps: 5, setNumber: 1 });

    const saved = await (await response).json();
    expect(saved.session.setLogs).toHaveLength(1);
    expect(saved.session.setLogs[0].weightKg).toBe(100);
    await expect(page.getByText(/Seans Tamamlandı/)).toBeVisible();

    // Sunucu da tamamlanmamış ya da boş seti kabul etmez.
    const empty = await api.post("/api/workouts", {
      data: { date: todayStr(), name: "Boş", durationMinutes: 10, setLogs: [{ exerciseName: "Squat", setNumber: 1, weightKg: 40, reps: 8, completed: false }] },
    });
    expect(empty.status()).toBe(400);
  });
});

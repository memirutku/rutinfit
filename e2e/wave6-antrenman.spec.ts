import { test, expect, todayStr, uniq } from "./fixtures";
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

/** "YYYY-MM-DD" ± gün (saat diliminden bağımsız takvim aritmetiği). */
function shiftDay(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
const trDate = (iso: string) => iso.split("-").reverse().join(".");

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

  test("B18: seans şablondaki set sayısıyla (4 ve 2) açılır; set eklenir ve silinir", async ({ page, api }) => {
    const name = uniq("E2E Üst");
    const created = await api.post("/api/workouts/templates", {
      data: {
        name,
        type: "strength",
        dayOfWeek: 7,
        targetDurationMinutes: 50,
        exercises: [
          { exerciseName: "Bench Press", targetSets: 4, repMin: 6, repMax: 8, restSeconds: 150 },
          { exerciseName: "Tricep Pushdown", targetSets: 2, repMin: 10, repMax: 15, restSeconds: 60 },
        ],
      },
    });
    expect(created.status()).toBe(201);
    const templateId = (await created.json()).id;
    try {
      await openWorkouts(page);
      await page.getByRole("article", { name }).getByRole("button", { name: "Başla (50 dk)" }).click();

      const bench = page.getByRole("group", { name: "Bench Press" });
      const pushdown = page.getByRole("group", { name: "Tricep Pushdown" });
      await expect(bench.getByLabel("Ağırlık:")).toHaveCount(4);
      await expect(pushdown.getByLabel("Ağırlık:")).toHaveCount(2);

      await pushdown.getByRole("button", { name: "Tricep Pushdown için set ekle" }).click();
      await expect(pushdown.getByLabel("Ağırlık:")).toHaveCount(3);
      await bench.getByRole("button", { name: "Bench Press 4. seti sil" }).click();
      await expect(bench.getByLabel("Ağırlık:")).toHaveCount(3);
      await expect(bench.getByRole("button", { name: "Bench Press 3. seti sil" })).toBeVisible();

      await page.getByRole("button", { name: "Vazgeç" }).first().click();
    } finally {
      await api.delete(`/api/workouts/templates?id=${templateId}`);
    }
  });

  test("B19: metinden eklenen dünkü antrenman düne yazılır; geçmişte görülür, düzenlenir ve onayla silinir", async ({ page, api }) => {
    const yesterday = shiftDay(todayStr(), -1);
    const name = uniq("E2E Dünkü");
    await openWorkouts(page);
    await page.getByRole("button", { name: "Metinden ekle" }).click();
    const dialog = page.getByRole("dialog", { name: "Metinden antrenman ekle" });
    await expect(dialog.getByLabel("Tarih")).toHaveValue(todayStr());
    await dialog.getByLabel("Antrenman metni").fill("squat 3x8 80 kg");
    await dialog.getByLabel("Seans adı").fill(name);
    await dialog.getByLabel("Tarih").fill(yesterday);
    await dialog.getByRole("button", { name: "Seans olarak kaydet (3 set)" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: `${trDate(yesterday)} tarihine 3 set kaydedildi.` })).toBeVisible();

    const onYesterday = (await (await api.get(`/api/workouts?date=${yesterday}`)).json()).sessions;
    expect(onYesterday.some((x: { name: string }) => x.name === name)).toBe(true);
    const onToday = (await (await api.get(`/api/workouts?date=${todayStr()}`)).json()).sessions;
    expect(onToday.some((x: { name: string }) => x.name === name)).toBe(false);

    const history = page.getByRole("list", { name: "Seans geçmişi" });
    const row = history.getByRole("listitem").filter({ hasText: name });
    await expect(row).toContainText(trDate(yesterday));
    await expect(row).toContainText("Dün");

    // Düzenle: ad ve bir setin ağırlığı
    const label = `${name} · ${trDate(yesterday)}`;
    await page.getByRole("button", { name: `${label} seansını düzenle` }).click();
    const edit = page.getByRole("dialog", { name: "Seansı düzenle" });
    const renamed = `${name} düzeltildi`;
    await edit.getByLabel("Seans adı").fill(renamed);
    await edit.getByLabel("Squat 1. set ağırlık").fill("82,5");
    await edit.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
    await expect(edit).toBeHidden();
    const renamedLabel = `${renamed} · ${trDate(yesterday)}`;
    await page.getByRole("button", { name: `${renamedLabel} setlerini gör` }).click();
    await expect(page.getByRole("list", { name: `${renamedLabel} setleri` })).toContainText("82,5 kg × 8");

    // Sil: önce onay sorulur
    await page.getByRole("button", { name: `${renamedLabel} seansını sil` }).click();
    const confirm = page.getByRole("dialog", { name: "Seans silinsin mi?" });
    await expect(confirm).toContainText(trDate(yesterday));
    await confirm.getByRole("button", { name: "Sil" }).click();
    await expect(history.getByRole("listitem").filter({ hasText: renamed })).toHaveCount(0);
    const after = (await (await api.get(`/api/workouts?date=${yesterday}`)).json()).sessions;
    expect(after.some((x: { name: string }) => x.name === renamed)).toBe(false);
  });
});

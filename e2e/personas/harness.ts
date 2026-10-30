import fs from "node:fs";
import path from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";

/**
 * Persona yolculuğu: her adım süre, ekran görüntüsü, konsol hataları ve başarısız isteklerle
 * kaydedilir. Bir adım başarısız olursa yolculuk durmaz; adım "başarısız" olarak işaretlenir
 * (bu bir bulgudur: persona o işi yapamadı). Sonuç reports/personas/<ad>/log.json.
 */

export const MOCK = "http://127.0.0.1:3300";
export const baseFor = (i: number) => `http://127.0.0.1:${3301 + i}`;

export interface StepLog {
  n: number;
  title: string;
  /** Personanın bu adımda yapmak istediği (değerlendirici için). */
  intent?: string;
  ok: boolean;
  ms: number;
  error?: string;
  screenshot: string;
  consoleErrors: string[];
  httpErrors: string[];
}

const slug = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

export function journey(page: Page, persona: string, profile: Record<string, unknown>) {
  const dir = path.resolve(__dirname, "../../reports/personas", persona);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const log: { persona: string; profile: Record<string, unknown>; steps: StepLog[] } = { persona, profile, steps: [] };
  let consoleErrors: string[] = [];
  let httpErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on("response", (r) => {
    if (r.status() >= 400) httpErrors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });
  page.setDefaultTimeout(6000);

  async function step(title: string, intent: string, fn: () => Promise<unknown>) {
    const n = log.steps.length + 1;
    consoleErrors = [];
    httpErrors = [];
    const start = Date.now();
    let ok = true;
    let error: string | undefined;
    try {
      await fn();
    } catch (e) {
      ok = false;
      error = String((e as Error).message ?? e)
        .replace(/\u001b\[\d+m/g, "")
        .split("\n")
        .slice(0, 4)
        .join(" | ")
        .slice(0, 500);
    }
    await page.waitForTimeout(400);
    const screenshot = `${String(n).padStart(2, "0")}-${slug(title)}.png`;
    await page.screenshot({ path: path.join(dir, screenshot), fullPage: true }).catch(() => {});
    log.steps.push({ n, title, intent, ok, ms: Date.now() - start, error, screenshot, consoleErrors: [...consoleErrors], httpErrors: [...httpErrors] });
    fs.writeFileSync(path.join(dir, "log.json"), JSON.stringify(log, null, 2));
  }

  return { step, dir };
}

/** Geçmiş günleri doldurmak için (persona uygulamayı önceki günlerde de kullanmış gibi). */
export async function backfillFood(api: APIRequestContext, base: string, date: string, items: Array<{ mealType: string; name: string; grams: number; kcal: number; protein: number; carbs?: number; fat?: number; time?: string }>) {
  for (const i of items) {
    await api.post(`${base}/api/food-logs`, {
      data: {
        date,
        time: i.time ?? "12:00",
        mealType: i.mealType,
        name: i.name,
        grams: i.grams,
        caloriesSnapshot: i.kcal,
        proteinSnapshot: i.protein,
        carbsSnapshot: i.carbs ?? Math.round(i.kcal * 0.1),
        fatSnapshot: i.fat ?? Math.round(i.kcal * 0.03),
      },
    });
  }
}

export const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(d);
};

export const queueLLM = (api: APIRequestContext, content: string) => api.post(`${MOCK}/__control/llm/queue`, { data: { content } });

/** İlk açılış sihirbazı (personanın gerçekten doldurduğu adımlar). */
export async function fillWizard(
  page: Page,
  o: {
    sex: "Erkek" | "Kadın";
    age: number;
    height: number;
    weight: number;
    activity: RegExp;
    goal: "Kilo ver" | "Kiloyu koru" | "Kilo al";
    target?: number;
    rate?: string;
    /** B06: başlarken adımı (dalga 6). Verilmezse adım boş geçilir. */
    dayPattern?: "Ofis / iş yeri" | "Okul" | "Vardiyalı" | "Evden / esnek";
    homeTime?: string;
    ramadanProvince?: string;
    program?: RegExp;
  }
) {
  const d = page.getByRole("dialog", { name: "Hedeflerini birlikte kuralım" });
  await d.getByLabel("Cinsiyet").selectOption({ label: o.sex });
  await d.getByLabel("Yaş").fill(String(o.age));
  await d.getByLabel("Boy (cm)").fill(String(o.height));
  await d.getByLabel("Kilo (kg)").fill(String(o.weight));
  await d.getByRole("button", { name: "İleri" }).click();
  await d.getByRole("radio", { name: o.activity }).check({ force: true });
  await d.getByRole("button", { name: "İleri" }).click();
  await d.getByLabel(o.goal).check({ force: true });
  if (o.target) await d.getByLabel("Hedef kilo (kg)").fill(String(o.target));
  if (o.rate) await d.getByLabel("Haftalık hız").selectOption(o.rate);
  await d.getByRole("button", { name: "İleri" }).click();
  // B06: başlarken
  if (o.dayPattern) await d.getByRole("radio", { name: o.dayPattern }).check();
  if (o.homeTime) await d.getByLabel("Eve varış saati").fill(o.homeTime);
  if (o.ramadanProvince) {
    await d.getByRole("checkbox", { name: /Ramazan'da oruç tutuyorum/ }).check();
    await d.getByLabel("İl").selectOption(o.ramadanProvince);
  }
  if (o.program) await d.getByRole("radio", { name: o.program }).check();
  await d.getByRole("button", { name: "İleri" }).click();
}

export async function saveWizard(page: Page) {
  const d = page.getByRole("dialog", { name: "Hedeflerini birlikte kuralım" });
  await d.getByRole("button", { name: "Kaydet ve başla" }).click();
  await d.waitFor({ state: "hidden" });
}

export async function backfillWorkout(
  api: APIRequestContext,
  base: string,
  date: string,
  name: string,
  sets: Array<[exercise: string, weightKg: number, reps: number, rpe?: number]>
) {
  await api.post(`${base}/api/workouts`, {
    data: {
      date,
      name,
      durationMinutes: 60,
      setLogs: sets.map(([exerciseName, weightKg, reps, rpe], i) => ({ exerciseName, setNumber: i + 1, weightKg, reps, rpe: rpe ?? null })),
    },
  });
}

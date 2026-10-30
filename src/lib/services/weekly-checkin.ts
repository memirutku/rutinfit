/**
 * F49: Haftalık değerlendirme. Bütün metrikler kodda hesaplanır; model yalnız 3–5 cümlelik özeti
 * yazar (ulaşılamazsa otomatik özet). Tek bir öneri seçilir; hedef değişikliği önerisi onaylı
 * taslak (nutrition_targets) olarak gelir ve F56 kurallarından geçer.
 *
 * B40: Öneri yalnız "tek adım" kutusunda gösterilir; özet onu tekrar etmez (modele de verilmez).
 * Özet ortalamaları hedefle karşılaştırır.
 */
import { prisma } from "../prisma";
import { addDaysToDateString, getLocalDateString, startOfWeek } from "../date-utils";
import { computeAdherence } from "../adherence";
import { formatDateTr, formatNumberTr } from "../format";
import { tonePrompt } from "../coach-tone";
import { checkAIBaseUrl, DEFAULT_AI_BASE_URL, shouldSendOpenAIKey } from "../security/ai-endpoint";
import { createActionDraft } from "../ai-tools/action-tools";
import { loadAdaptiveTdee } from "./adaptive-tdee";

export interface WeeklyMetrics {
  weekStart: string;
  weekEnd: string;
  loggedDays: number;
  avgCalories: number | null;
  calorieTarget: number;
  daysOnTarget: number;
  avgProtein: number | null;
  proteinTarget: number;
  proteinDaysHit: number;
  weightAvg: number | null;
  weightDeltaKg: number | null;
  workouts: number;
  plannedWorkouts: number;
  workingSets: number;
  cardioMinutes: number;
  planAdherencePercent: number | null;
  adaptiveTdee: number | null;
  /** F82: adet günleri (yalnız döngü notu açıksa; modele gönderilmez). */
  cycleDays: number | null;
}

export interface CheckinSuggestion {
  kind: "targets" | "habit" | "protein" | "training" | "keep";
  text: string;
  calorieTarget?: number;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export async function computeWeeklyMetrics(weekStart: string): Promise<WeeklyMetrics> {
  const weekEnd = addDaysToDateString(weekStart, 6);
  const prevStart = addDaysToDateString(weekStart, -7);
  const range = { gte: weekStart, lte: weekEnd };
  const [profile, days, weights, prevWeights, sessions, cardio, planned, strengthTemplates, cycle] = await Promise.all([
    prisma.userProfile.findFirst(),
    prisma.foodLog.groupBy({ by: ["date"], where: { date: range }, _sum: { caloriesSnapshot: true, proteinSnapshot: true } }),
    prisma.weightLog.findMany({ where: { date: range } }),
    prisma.weightLog.findMany({ where: { date: { gte: prevStart, lt: weekStart } } }),
    prisma.workoutSession.findMany({ where: { date: range, completed: true }, include: { setLogs: { where: { setType: { not: "warmup" } }, select: { id: true } } } }),
    prisma.cardioLog.findMany({ where: { date: range } }),
    prisma.plannedMeal.findMany({ where: { mealPlan: { date: range } }, select: { adherence: true } }),
    prisma.workoutTemplate.count({ where: { type: "strength" } }),
    prisma.dailyWellbeing.count({ where: { date: range, cycleNote: { in: ["period_start", "period"] } } }),
  ]);
  const target = profile?.calorieTarget ?? 2000;
  const ceiling = profile?.calorieCeiling ?? target + 100;
  const proteinTarget = profile?.proteinTargetG ?? 0;
  const kcal = days.map((d) => d._sum.caloriesSnapshot ?? 0);
  const protein = days.map((d) => d._sum.proteinSnapshot ?? 0);
  const wAvg = avg(weights.map((w) => w.weightKg));
  const pAvg = avg(prevWeights.map((w) => w.weightKg));
  const adherence = computeAdherence(planned);
  const adaptive = await loadAdaptiveTdee(addDaysToDateString(weekEnd, 1));
  return {
    weekStart,
    weekEnd,
    loggedDays: days.length,
    avgCalories: avg(kcal) === null ? null : Math.round(avg(kcal)!),
    calorieTarget: target,
    daysOnTarget: kcal.filter((k) => k >= target * 0.9 && k <= ceiling).length,
    avgProtein: avg(protein) === null ? null : Math.round(avg(protein)!),
    proteinTarget,
    proteinDaysHit: protein.filter((p) => proteinTarget > 0 && p >= proteinTarget * 0.9).length,
    weightAvg: r1(wAvg),
    weightDeltaKg: wAvg !== null && pAvg !== null ? r1(wAvg - pAvg) : null,
    workouts: sessions.length,
    plannedWorkouts: strengthTemplates,
    workingSets: sessions.reduce((a, s) => a + s.setLogs.length, 0),
    cardioMinutes: Math.round(cardio.reduce((a, c) => a + c.durationMin, 0)),
    planAdherencePercent: adherence.percent,
    adaptiveTdee: adaptive.ok ? adaptive.tdee : null,
    cycleDays: profile?.cycleTracking ? cycle : null,
  };
}

/** Öncelik: hedef ayarı > kayıt alışkanlığı > protein > antrenman > devam. */
export async function chooseSuggestion(m: WeeklyMetrics): Promise<CheckinSuggestion> {
  const adaptive = await loadAdaptiveTdee(addDaysToDateString(m.weekEnd, 1));
  if (adaptive.ok && adaptive.suggestion) {
    return {
      kind: "targets",
      text: `Günlük kalori hedefini ${formatNumberTr(adaptive.suggestion.calorieTarget)} kcal yap (şu an ${formatNumberTr(m.calorieTarget)}). ${adaptive.suggestion.reason}`,
      calorieTarget: adaptive.suggestion.calorieTarget,
    };
  }
  if (m.loggedDays < 5) {
    return { kind: "habit", text: `Bu hafta ${m.loggedDays} gün kayıt girdin. Önümüzdeki hafta en az 5 gün öğünlerini kaydetmeye çalış; tahminler ancak böyle doğru çıkar.` };
  }
  if (m.proteinTarget > 0 && m.proteinDaysHit < 4) {
    return { kind: "protein", text: `Proteini artır: ortalaman ${formatNumberTr(m.avgProtein ?? 0)} g, hedef ${formatNumberTr(m.proteinTarget)} g. Her öğüne bir protein kaynağı (yumurta, yoğurt, tavuk, mercimek) ekle.` };
  }
  if (m.plannedWorkouts > 0 && m.workouts < m.plannedWorkouts) {
    return { kind: "training", text: `Planında haftada ${m.plannedWorkouts} ağırlık günü var, ${m.workouts} tanesini yaptın. Yorgunsan 25 dakikalık kısaltılmış seans da sayılır.` };
  }
  return { kind: "keep", text: "Böyle devam et; plan işliyor." };
}

function metricLines(m: WeeklyMetrics): string[] {
  const lines = [
    `Kayıt: ${m.loggedDays}/7 gün`,
    m.avgCalories !== null
      ? `Ortalama kalori: ${m.avgCalories} kcal (hedef ${m.calorieTarget}, hedefle fark: ${signedDiff(m.avgCalories - m.calorieTarget)} kcal), hedef aralığında ${m.daysOnTarget} gün`
      : "Kalori kaydı yok",
    m.avgProtein !== null
      ? `Ortalama protein: ${m.avgProtein} g (hedef ${m.proteinTarget}, hedefle fark: ${signedDiff(m.avgProtein - m.proteinTarget)} g), hedefe ulaşılan ${m.proteinDaysHit} gün`
      : "Protein kaydı yok",
    m.weightDeltaKg !== null ? `Kilo ortalaması değişimi: ${m.weightDeltaKg} kg (önceki haftaya göre)` : "Kilo eğilimi için yeterli tartı yok",
    `Antrenman: ${m.workouts} seans, ${m.workingSets} çalışma seti; kardiyo ${m.cardioMinutes} dk`,
  ];
  if (m.planAdherencePercent !== null) lines.push(`Plana uyum: %${m.planAdherencePercent}`);
  if (m.adaptiveTdee !== null) lines.push(`Tahmini harcama: ${m.adaptiveTdee} kcal`);
  return lines;
}

const signedDiff = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** B40: kalori farkı bu kadar küçükse "neredeyse aynı" sayılır. */
const CALORIE_NEAR = 50;
const PROTEIN_NEAR = 5;

/** B40: otomatik özet. Ortalamayı hedefle karşılaştırır; öneriyi yazmaz (o kutuda). */
function ruleSummary(m: WeeklyMetrics): string {
  const parts = [`${formatDateTr(m.weekStart, { short: true })}–${formatDateTr(m.weekEnd, { short: true })} haftasında ${m.loggedDays} gün kayıt girdin.`];
  if (m.avgCalories !== null) {
    const diff = m.avgCalories - m.calorieTarget;
    const target = `${formatNumberTr(m.calorieTarget)} kcal`;
    const compare =
      Math.abs(diff) <= CALORIE_NEAR
        ? `hedefinle (${target}) neredeyse aynıydı`
        : `hedefin (${target}) ortalama ${formatNumberTr(Math.abs(diff))} kcal ${diff < 0 ? "altındaydın" : "üstündeydin"}`;
    parts.push(`Ortalaman ${formatNumberTr(m.avgCalories)} kcal; ${compare}; ${m.daysOnTarget} gün hedef aralığındaydın.`);
  }
  if (m.avgProtein !== null && m.proteinTarget > 0) {
    const diff = m.avgProtein - m.proteinTarget;
    const target = `${formatNumberTr(m.proteinTarget)} g`;
    const compare =
      Math.abs(diff) <= PROTEIN_NEAR ? `hedefinle (${target}) neredeyse aynı` : `hedefin (${target}) ${formatNumberTr(Math.abs(diff))} g ${diff < 0 ? "altında" : "üstünde"}`;
    parts.push(`Protein ortalaman ${formatNumberTr(m.avgProtein)} g; ${compare}.`);
  }
  if (m.weightDeltaKg !== null) parts.push(`Kilo ortalaman önceki haftaya göre ${m.weightDeltaKg > 0 ? "+" : ""}${formatNumberTr(m.weightDeltaKg)} kg değişti.`);
  parts.push(`${m.workouts} antrenman ve ${m.cardioMinutes} dakika kardiyo yaptın.`);
  return parts.join(" ");
}

/** Model 3–5 cümle yazar; ulaşılamazsa null (otomatik özet kullanılır). */
async function aiSummary(m: WeeklyMetrics): Promise<string | null> {
  const settings = await prisma.aISettings.findFirst();
  if (settings && !settings.coachEnabled) return null;
  const baseUrl = settings?.baseUrl ?? DEFAULT_AI_BASE_URL;
  if (!checkAIBaseUrl(baseUrl).ok) return null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (shouldSendOpenAIKey(settings?.providerType ?? "ollama", baseUrl) && process.env.OPENAI_API_KEY) headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: settings?.modelName ?? "llama3.2",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: `Sen RutinFit'in haftalık değerlendirme koçusun. Türkçe yaz. ${tonePrompt(settings?.tone)} Yalnız verilen sayıları kullan, yeni sayı uydurma. 3–5 cümle yaz, tıbbi teşhis koyma. Ortalamaları hedefle karşılaştır (altında, üstünde ya da yakın). Öneri ya da tavsiye yazma: haftanın tek adımı ayrı bir kutuda gösterilir.`,
          },
          { role: "user", content: `Geçen haftanın metrikleri:\n${metricLines(m).map((l) => `- ${l}`).join("\n")}` },
        ],
      }),
    });
    if (!res.ok) return null;
    const text = (await res.json())?.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function createWeeklyCheckin(today = getLocalDateString()) {
  const weekStart = addDaysToDateString(startOfWeek(today), -7);
  const metrics = await computeWeeklyMetrics(weekStart);
  const suggestion = await chooseSuggestion(metrics);
  const ai = await aiSummary(metrics);
  let summary = ai ?? ruleSummary(metrics);
  // F82: modele gönderilmez; özetin sonuna kodla eklenir.
  if (metrics.cycleDays) {
    summary += ` Bu hafta adet dönemi (${metrics.cycleDays} gün) vardı; su tutma kiloyu birkaç gün geçici olarak artırabilir.`;
  }

  let draft: { draftId: string; approvalToken: string } | null = null;
  if (suggestion.kind === "targets" && suggestion.calorieTarget) {
    const profile = await prisma.userProfile.findFirst();
    const protein = profile?.proteinTargetG ?? 150;
    const fat = Math.round((suggestion.calorieTarget * 0.27) / 9);
    const carbs = Math.max(0, Math.round((suggestion.calorieTarget - protein * 4 - fat * 9) / 4));
    draft = await createActionDraft({
      draftType: "nutrition_targets",
      proposedChanges: { calorieTarget: suggestion.calorieTarget, calorieCeiling: suggestion.calorieTarget + 100, proteinTargetG: protein, fatTargetG: fat, carbTargetG: carbs },
      impactSummary: suggestion.text,
      ttlMinutes: 7 * 24 * 60,
    });
  }

  const saved = await prisma.weeklyCheckin.upsert({
    where: { weekStart },
    update: { metrics: JSON.stringify(metrics), summary, aiGenerated: !!ai, suggestion: JSON.stringify(suggestion), draftId: draft?.draftId ?? null },
    create: { weekStart, metrics: JSON.stringify(metrics), summary, aiGenerated: !!ai, suggestion: JSON.stringify(suggestion), draftId: draft?.draftId ?? null },
  });
  return { id: saved.id, weekStart, weekEnd: metrics.weekEnd, metrics, summary, aiGenerated: !!ai, suggestion, draftId: draft?.draftId ?? null, draftStatus: (draft ? "pending" : null) as DraftStatus, approvalToken: draft?.approvalToken ?? null };
}

export type DraftStatus = "pending" | "applied" | "rejected" | "expired" | null;

export async function listCheckins(limit = 8) {
  const rows = await prisma.weeklyCheckin.findMany({ orderBy: { weekStart: "desc" }, take: limit });
  const ids = rows.map((r) => r.draftId).filter((x): x is string => !!x);
  const drafts = ids.length ? await prisma.actionDraft.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, expiresAt: true } }) : [];
  const now = Date.now();
  const statusOf = (id: string | null): DraftStatus => {
    const d = id ? drafts.find((x) => x.id === id) : undefined;
    if (!d) return null;
    if (d.status === "applied" || d.status === "approved") return "applied";
    if (d.status === "rejected") return "rejected";
    return d.expiresAt.getTime() < now ? "expired" : "pending";
  };
  return rows.map((r) => ({
    draftStatus: statusOf(r.draftId),
    id: r.id,
    weekStart: r.weekStart,
    metrics: JSON.parse(r.metrics) as WeeklyMetrics,
    summary: r.summary,
    aiGenerated: r.aiGenerated,
    suggestion: r.suggestion ? (JSON.parse(r.suggestion) as CheckinSuggestion) : null,
    draftId: r.draftId,
  }));
}

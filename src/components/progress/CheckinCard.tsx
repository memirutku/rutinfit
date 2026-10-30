"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Sparkles } from "lucide-react";
import { Explanation } from "@/components/ui/Explanation";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { queryKeys } from "@/lib/client/queries/keys";
import { formatDateTr, formatNumberTr } from "@/lib/format";
import type { CheckinSuggestion, DraftStatus, WeeklyMetrics } from "@/lib/services/weekly-checkin";

interface Checkin {
  id: string;
  weekStart: string;
  metrics: WeeklyMetrics;
  summary: string;
  aiGenerated: boolean;
  suggestion: CheckinSuggestion | null;
  draftId: string | null;
  draftStatus: DraftStatus;
}

const KEY = [...queryKeys.progress, "checkins"];

/**
 * B40: öneri yalnız "tek adım" kutusunda yazar. Önceki sürümün kaydettiği özetlerin sonundaki
 * "Öneri: …" cümlesi gösterilirken çıkarılır.
 */
export function summaryWithoutSuggestion(summary: string, suggestion: CheckinSuggestion | null | undefined): string {
  if (!suggestion) return summary;
  return summary.replace(` Öneri: ${suggestion.text}`, "").replace(`Öneri: ${suggestion.text}`, "").trim();
}
const signed = (n: number) => (n < 0 ? `−${formatNumberTr(-n)}` : n > 0 ? `+${formatNumberTr(n)}` : "0");

function metricItems(m: WeeklyMetrics) {
  const items = [
    { label: "Kayıt", value: `${m.loggedDays}/7 gün` },
    {
      label: "Kalori",
      value: m.avgCalories !== null ? `ort. ${formatNumberTr(m.avgCalories)} kcal (hedef ${formatNumberTr(m.calorieTarget)}), ${m.daysOnTarget} gün aralıkta` : "kayıt yok",
    },
    {
      label: "Protein",
      value: m.avgProtein !== null ? `ort. ${formatNumberTr(m.avgProtein)} g (hedef ${formatNumberTr(m.proteinTarget)}), ${m.proteinDaysHit} gün tuttu` : "kayıt yok",
    },
    { label: "Kilo değişimi", value: m.weightDeltaKg !== null ? `${signed(m.weightDeltaKg)} kg` : "yeterli tartı yok" },
    { label: "Antrenman", value: `${m.workouts} seans, ${m.workingSets} çalışma seti, ${m.cardioMinutes} dk kardiyo` },
  ];
  if (m.planAdherencePercent !== null) items.push({ label: "Plana uyum", value: `%${m.planAdherencePercent}` });
  if (m.adaptiveTdee !== null) items.push({ label: "Tahmini harcama", value: `${formatNumberTr(m.adaptiveTdee)} kcal` });
  return items;
}

/**
 * F49: Haftalık değerlendirme. Sayılar kodda hesaplanır; özeti model ya da kural yazar.
 * Hedef değişikliği önerisi onaysız uygulanmaz.
 */
export function CheckinCard() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: KEY, queryFn: () => apiFetch<{ checkins: Checkin[] }>("/api/checkins") });
  const [freshToken, setFreshToken] = useState<{ draftId: string; token: string } | null>(null);

  const create = useMutation({
    mutationFn: () => apiFetch<Checkin & { approvalToken: string | null }>("/api/checkins", { method: "POST" }),
    onSuccess: (data) => {
      setFreshToken(data.draftId && data.approvalToken ? { draftId: data.draftId, token: data.approvalToken } : null);
      return qc.invalidateQueries({ queryKey: KEY });
    },
  });

  const decide = useMutation({
    mutationFn: async ({ draftId, approve }: { draftId: string; approve: boolean }) => {
      if (!approve) return apiFetch("/api/ai/actions", { method: "POST", json: { draftId, action: "reject", reason: "Haftalık değerlendirmede reddedildi" } });
      let token = freshToken?.draftId === draftId ? freshToken.token : null;
      if (!token) {
        const re = await apiFetch<{ approvalToken: string }>("/api/ai/actions", { method: "POST", json: { draftId, action: "reissue" } });
        token = re.approvalToken;
      }
      return apiFetch("/api/ai/actions", { method: "POST", json: { draftId, action: "approve", approvalToken: token } });
    },
    onSuccess: () => {
      setFreshToken(null);
      return Promise.all([qc.invalidateQueries({ queryKey: KEY }), qc.invalidateQueries({ queryKey: queryKeys.profile })]);
    },
  });

  const latest = list.data?.checkins[0];
  const s = latest?.suggestion;

  return (
    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-brand-600" />
          <h3 className="font-bold text-slate-900 text-base">Haftalık değerlendirme</h3>
        </div>
        <button
          type="button"
          disabled={create.isPending}
          onClick={() => create.mutate()}
          className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
        >
          {create.isPending ? "Hazırlanıyor…" : "Geçen haftayı değerlendir"}
        </button>
      </div>
      {create.isError && (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(create.error, "Değerlendirme oluşturulamadı.")}
        </p>
      )}

      {!latest ? (
        list.isSuccess && <p className="text-sm text-slate-500">Henüz haftalık değerlendirme yok. Her pazartesi geçen haftanı tek tıkla özetleyebilirsin.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">
              {formatDateTr(latest.metrics.weekStart, { short: true })} – {formatDateTr(latest.metrics.weekEnd, { short: true })}
            </span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold ${latest.aiGenerated ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600"}`}>
              {latest.aiGenerated && <Sparkles className="w-3 h-3" aria-hidden />}
              {latest.aiGenerated ? "AI özeti" : "Otomatik özet"}
            </span>
          </div>
          <p className="text-sm text-slate-800 whitespace-pre-line">{summaryWithoutSuggestion(latest.summary, s)}</p>

          {s && (
            <div className="p-3 rounded-xl bg-brand-50 border border-brand-200 text-sm text-brand-900 space-y-2">
              <p>
                <strong>Bu haftanın tek adımı:</strong> {s.text}
              </p>
              {s.kind === "targets" && latest.draftId && (
                <>
                  {latest.draftStatus === "pending" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ draftId: latest.draftId!, approve: true })}
                        className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold disabled:opacity-50"
                      >
                        Hedefi uygula
                      </button>
                      <button
                        type="button"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ draftId: latest.draftId!, approve: false })}
                        className="px-3 py-1.5 rounded-lg border border-brand-300 text-brand-800 text-xs font-bold disabled:opacity-50"
                      >
                        Reddet
                      </button>
                    </div>
                  )}
                  {latest.draftStatus === "applied" && <p className="text-xs font-semibold text-emerald-700">✓ Hedef güncellendi.</p>}
                  {latest.draftStatus === "rejected" && <p className="text-xs text-slate-600">Öneriyi reddettin; hedefin aynı kaldı.</p>}
                  {latest.draftStatus === "expired" && <p className="text-xs text-slate-600">Önerinin süresi doldu. Yeniden değerlendirme oluşturabilirsin.</p>}
                </>
              )}
              {decide.isError && (
                <p role="alert" className="text-xs text-rose-700">
                  {errorMessage(decide.error, "İşlem yapılamadı.")}
                </p>
              )}
            </div>
          )}

          <Explanation title="Bu değerlendirme neye dayanıyor?" items={metricItems(latest.metrics)} />
        </div>
      )}
    </section>
  );
}

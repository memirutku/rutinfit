"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, RefreshCw } from "lucide-react";
import { ApiError, errorMessage } from "@/lib/client/api";
import { useAISettings, useSaveAISettings, useTestAIConnection } from "@/lib/client/queries/system";
import { useAIStatus } from "@/lib/client/queries/coach";
import { queryKeys } from "@/lib/client/queries/keys";
import type { AIStatus } from "@/lib/schemas/chat";
import { COACH_TONES, COACH_TONE_KEYS, type CoachTone } from "@/lib/coach-tone";
import type { AISettingsView, TestConnectionInput, TestConnectionResult } from "@/lib/schemas/system";

type Provider = TestConnectionInput["providerType"];

const LABEL = "block text-xs font-semibold text-slate-600 mb-1";
const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";
const PROVIDER_URLS: Partial<Record<Provider, string>> = {
  ollama: "http://127.0.0.1:11434/v1",
  lmstudio: "http://127.0.0.1:1234/v1",
};
const NETWORK_ERROR = "Test sırasında bir bağlantı hatası oluştu.";

/** Sunucunun reddettiği ayar (ör. güvenli olmayan adres) mesajıyla, ağ hatası sabit metinle gösterilir. */
function failureResult(error: unknown): TestConnectionResult {
  const message = error instanceof ApiError && error.status === 0 ? NETWORK_ERROR : errorMessage(error, NETWORK_ERROR);
  return { success: false, message };
}

/** F67: kayıtlı (kullanılan) uç noktanın yeri. B28: yer bilgisidir, "hazır" anlamı taşımaz (nötr renk). */
function EndpointBadge({ settings }: { settings: AISettingsView | undefined }) {
  if (!settings) return null;
  let host = settings.baseUrl;
  try {
    host = new URL(settings.baseUrl).host;
  } catch {
    // geçersiz adres olduğu gibi gösterilir
  }
  const [label, tone] =
    settings.endpointKind === "local"
      ? [`Bu bilgisayarda · ${host}`, "bg-slate-100 text-slate-700"]
      : settings.endpointKind === "cloud"
        ? [`Bulut · ${host}`, "bg-amber-50 text-amber-800"]
        : ["Geçersiz adres", "bg-rose-50 text-rose-700"];
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tone}`}>{label}</span>;
}

const CONNECTION_LABELS: Record<AIStatus["status"], [string, string]> = {
  ready: ["Bağlı", "bg-emerald-50 text-emerald-700"],
  model_missing: ["Model bulunamadı", "bg-amber-50 text-amber-800"],
  no_models: ["Model yüklü değil", "bg-amber-50 text-amber-800"],
  unreachable: ["Ulaşılamıyor", "bg-rose-50 text-rose-700"],
  server_error: ["Sunucu hatası", "bg-rose-50 text-rose-700"],
  invalid_url: ["Geçersiz adres", "bg-rose-50 text-rose-700"],
  disabled: ["Koç kapalı", "bg-slate-100 text-slate-600"],
};

/** B28: kayıtlı ayarla model sunucusunun gerçek durumu (yeşil yalnız model gerçekten hazırsa). */
function ConnectionBadge({ status, failed }: { status: AIStatus | undefined; failed: boolean }) {
  const [label, tone] = status
    ? CONNECTION_LABELS[status.status]
    : [failed ? "Durum bilinmiyor" : "Denetleniyor…", "bg-slate-100 text-slate-600"];
  const text = status?.status === "ready" ? `${label} · ${status.modelName}` : label;
  return (
    <span data-testid="ai-connection-badge" title={status?.message} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tone}`}>
      {text}
    </span>
  );
}

/** Yerel yapay zekâ sağlayıcısı: adres/model seçimi ve bağlantı testi. */
export function AIProviderSection() {
  const saved = useAISettings();
  const saveSettings = useSaveAISettings();
  const status = useAIStatus();
  const qc = useQueryClient();
  // B28: koç sayfasındaki "Ayarlar'da test et" bağlantısı bu bölüme iner (sayfa veriyle geç çizilir).
  useEffect(() => {
    if (window.location.hash === "#yapay-zeka") document.getElementById("yapay-zeka")?.scrollIntoView?.({ block: "start" });
  }, []);
  const [provider, setProvider] = useState<Provider>("ollama");
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:11434/v1");
  const [model, setModel] = useState("llama3.2");
  // Kayıtlı ayar gelince form ona göre kurulur (önceden her açılışta varsayılan gösteriliyordu).
  const [seededFrom, setSeededFrom] = useState<AISettingsView | undefined>(undefined);
  if (saved.data && saved.data !== seededFrom) {
    setSeededFrom(saved.data);
    setProvider(saved.data.providerType as Provider);
    setBaseUrl(saved.data.baseUrl);
    setModel(saved.data.modelName);
  }
  const coachEnabled = saved.data?.coachEnabled ?? true;
  const tone: CoachTone = saved.data?.tone ?? "supportive";
  const test = useTestAIConnection();
  const result: TestConnectionResult | null = test.data ?? (test.isError ? failureResult(test.error) : null);

  /** Bağlantıyı test eder; başarılı test ayarı kaydeder, rozet ve koç durumu yeniden denetlenir. */
  function runTest(modelName: string) {
    test.mutate(
      { providerType: provider, baseUrl, modelName },
      { onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.aiStatus }) }
    );
  }

  /** B30: algılanan model seçilince o modelle test edilip kaydedilir. */
  function chooseModel(name: string) {
    setModel(name);
    runTest(name);
  }

  return (
    <div id="yapay-zeka" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 scroll-mt-16">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-900 text-base">Yerel Yapay Zekâ Sağlayıcısı</h3>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <EndpointBadge settings={saved.data} />
          <ConnectionBadge status={status.data} failed={status.isError} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="settings-field-12" className={LABEL}>
              Sağlayıcı
            </label>
            <select
              id="settings-field-12"
              value={provider}
              onChange={(e) => {
                const next = e.target.value as Provider;
                setProvider(next);
                const url = PROVIDER_URLS[next];
                if (url) setBaseUrl(url);
              }}
              className={INPUT}
            >
              <option value="ollama">Ollama (Önerilen, Yerel)</option>
              <option value="lmstudio">LM Studio (Yerel)</option>
              <option value="openai">OpenAI API (Bulut, İsteğe Bağlı)</option>
            </select>
          </div>

          <div>
            <label htmlFor="settings-field-13" className={LABEL}>
              Base URL
            </label>
            <input id="settings-field-13" type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className={INPUT} />
          </div>

          <div>
            <label htmlFor="settings-field-14" className={LABEL}>
              Model Adı
            </label>
            <input
              id="settings-field-14"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Örn: llama3.2 veya mistral"
              className={INPUT}
            />
          </div>
        </div>

        {provider === "openai" && (
          <div role="note" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
            OpenAI seçildiğinde mesajların, profil özetin (boy, kilo, hedefler), bugünkü öğünlerin, haftalık değerlendirme
            sayıların ve eklediğin dosyaların içeriği OpenAI sunucularına gönderilir. Diğer tüm veriler bu bilgisayarda kalır.
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => runTest(model)}
            disabled={test.isPending}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${test.isPending ? "animate-spin" : ""}`} />
            <span>Bağlantıyı Test Et</span>
          </button>
        </div>

        {/* F58: koç kontrolleri */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={coachEnabled}
              disabled={saveSettings.isPending}
              onChange={(e) => saveSettings.mutate({ coachEnabled: e.target.checked })}
            />
            <span>
              <span className="font-bold">AI koçu açık</span>
              <span className="block text-slate-500">Kapalıyken modele hiçbir veri gönderilmez; takip özellikleri çalışmaya devam eder.</span>
            </span>
          </label>
          <div>
            <label htmlFor="settings-coach-tone" className={LABEL}>
              Koçun üslubu
            </label>
            <select
              id="settings-coach-tone"
              value={tone}
              disabled={saveSettings.isPending}
              onChange={(e) => saveSettings.mutate({ tone: e.target.value as CoachTone })}
              className={INPUT}
            >
              {COACH_TONE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {COACH_TONES[key].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {result && (
          <div
            role="status"
            className={`p-4 rounded-xl border text-xs leading-relaxed ${
              result.success ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            <p className="font-bold">{result.message}</p>
            {result.models && result.models.length > 0 && (
              <div className="mt-2 pt-2 border-t border-emerald-200/60 space-y-1.5">
                <p className="font-semibold">Algılanan modeller (seçince test edilip kaydedilir):</p>
                <div role="group" aria-label="Algılanan modeller" className="flex flex-wrap gap-1.5">
                  {result.models.map((name) => {
                    const selected = name === model;
                    return (
                      <button
                        key={name}
                        type="button"
                        aria-pressed={selected}
                        disabled={test.isPending}
                        onClick={() => chooseModel(name)}
                        className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] transition-colors disabled:opacity-50 ${
                          selected
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "bg-white border-slate-200 text-slate-700 hover:border-emerald-500"
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

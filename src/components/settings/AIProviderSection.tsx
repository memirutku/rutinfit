"use client";

import { useState } from "react";
import { Bot, RefreshCw } from "lucide-react";
import { ApiError, errorMessage } from "@/lib/client/api";
import { useTestAIConnection } from "@/lib/client/queries/system";
import type { TestConnectionInput, TestConnectionResult } from "@/lib/schemas/system";

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

/** Yerel yapay zekâ sağlayıcısı: adres/model seçimi ve bağlantı testi. */
export function AIProviderSection() {
  const [provider, setProvider] = useState<Provider>("ollama");
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:11434/v1");
  const [model, setModel] = useState("llama3.2");
  const test = useTestAIConnection();
  const result: TestConnectionResult | null = test.data ?? (test.isError ? failureResult(test.error) : null);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-900 text-base">Yerel Yapay Zekâ Sağlayıcısı</h3>
        </div>
        <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-full">Gizlilik Garantili</span>
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

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => test.mutate({ providerType: provider, baseUrl, modelName: model })}
            disabled={test.isPending}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${test.isPending ? "animate-spin" : ""}`} />
            <span>Bağlantıyı Test Et</span>
          </button>
        </div>

        {result && (
          <div
            className={`p-4 rounded-xl border text-xs leading-relaxed ${
              result.success ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            <p className="font-bold">{result.message}</p>
            {result.models && result.models.length > 0 && (
              <div className="mt-2 pt-2 border-t border-emerald-200/60">
                <span className="font-semibold">Algılanan Modeller:</span> {result.models.join(", ")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

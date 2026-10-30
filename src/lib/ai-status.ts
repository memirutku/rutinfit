/**
 * B28: yerel yapay zekâ bağlantısının durumu (saf mantık; sunucu ve istemci ortak kullanır).
 * Koç sayfası açılınca ve ayarlarda bu durum gösterilir; rozet buna bağlıdır.
 */
export const AI_STATUS_KINDS = [
  "ready",
  "disabled",
  "invalid_url",
  "unreachable",
  "server_error",
  "no_models",
  "model_missing",
] as const;
export type AIStatusKind = (typeof AI_STATUS_KINDS)[number];

/** `/models` ucunun yoklama sonucu. */
export interface AIProbe {
  reachable: boolean;
  httpStatus?: number;
  models: string[];
}

/** Seçili model sunucunun listesinde var mı? Ollama "ad" ile "ad:latest"i aynı sayar. */
export function modelAvailable(modelName: string, models: string[]): boolean {
  const want = modelName.trim().toLowerCase();
  if (!want) return models.length > 0;
  return models.some((m) => {
    const id = m.toLowerCase();
    return id === want || id === `${want}:latest`;
  });
}

export function classifyAIProbe(probe: AIProbe, modelName: string): AIStatusKind {
  if (!probe.reachable) return "unreachable";
  if (probe.httpStatus && probe.httpStatus >= 400) return "server_error";
  if (probe.models.length === 0) return "no_models";
  return modelAvailable(modelName, probe.models) ? "ready" : "model_missing";
}

/** Koçun hiç yanıt üretemeyeceği durumlar (model seçimi hatası hariç). */
export function isCoachUnavailable(kind: AIStatusKind | undefined): boolean {
  return kind === "unreachable" || kind === "server_error" || kind === "no_models" || kind === "invalid_url";
}

/** Kullanıcıya gösterilen düz metin açıklama (markdown yok). */
export function aiStatusMessage(
  kind: AIStatusKind,
  ctx: { baseUrl: string; modelName: string; httpStatus?: number; reason?: string }
): string {
  switch (kind) {
    case "ready":
      return `Model hazır: ${ctx.modelName}.`;
    case "disabled":
      return "AI koçu ayarlardan kapatıldı.";
    case "invalid_url":
      return ctx.reason ?? "Kayıtlı yapay zekâ adresi izinli değil.";
    case "unreachable":
      return `${ctx.baseUrl} adresinde çalışan bir model sunucusu bulunamadı.`;
    case "server_error":
      return `Model sunucusu yanıt verdi ama hata döndürdü (${ctx.httpStatus ?? "?"}).`;
    case "no_models":
      return "Model sunucusu çalışıyor ama yüklü bir model yok.";
    case "model_missing":
      return `"${ctx.modelName}" modeli bu sunucuda yok.`;
  }
}

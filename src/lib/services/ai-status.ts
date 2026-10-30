/** B28: kayıtlı yapay zekâ ayarıyla model sunucusunun gerçek durumunu denetler. */
import { prisma } from "../prisma";
import { checkAIBaseUrl, DEFAULT_AI_BASE_URL, shouldSendOpenAIKey } from "../security/ai-endpoint";
import { aiStatusMessage, classifyAIProbe, type AIProbe } from "../ai-status";
import type { AIStatus } from "../schemas/chat";

const DEFAULT_MODEL = "llama3.2";

/**
 * OpenAI uyumlu `/models` ucunu yoklar. Adresin izinli olduğu (yerel ya da api.openai.com)
 * çağırandan önce denetlenmiş olmalıdır.
 */
export async function probeAIEndpoint(providerType: string, baseUrl: string, timeoutMs = 4000): Promise<AIProbe & { timedOut?: boolean }> {
  const modelsUrl = baseUrl.endsWith("/") ? `${baseUrl}models` : `${baseUrl}/models`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (shouldSendOpenAIKey(providerType, baseUrl) && process.env.OPENAI_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.OPENAI_API_KEY}`;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(modelsUrl, { headers, signal: controller.signal, cache: "no-store" });
    if (!res.ok) return { reachable: true, httpStatus: res.status, models: [] };
    const data = (await res.json().catch(() => ({}))) as { data?: Array<{ id?: string; name?: string }> };
    const models = Array.isArray(data.data) ? data.data.map((m) => m.id || m.name).filter((m): m is string => !!m) : [];
    return { reachable: true, httpStatus: res.status, models };
  } catch (error) {
    return { reachable: false, models: [], timedOut: (error as Error)?.name === "AbortError" };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getAIStatus(): Promise<AIStatus> {
  const row = await prisma.aISettings.findFirst();
  const providerType = row?.providerType ?? "ollama";
  const baseUrl = row?.baseUrl || DEFAULT_AI_BASE_URL;
  const modelName = row?.modelName || DEFAULT_MODEL;
  const base = { providerType, baseUrl, modelName };

  if (row && !row.coachEnabled) {
    return { ...base, status: "disabled", models: [], message: aiStatusMessage("disabled", base) };
  }
  const check = checkAIBaseUrl(baseUrl);
  if (!check.ok) {
    return { ...base, status: "invalid_url", models: [], message: aiStatusMessage("invalid_url", { ...base, reason: check.reason }) };
  }
  const probe = await probeAIEndpoint(providerType, baseUrl, 2500);
  const status = classifyAIProbe(probe, modelName);
  return { ...base, status, models: probe.models, message: aiStatusMessage(status, { ...base, httpStatus: probe.httpStatus }) };
}

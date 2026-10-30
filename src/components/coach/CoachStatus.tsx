"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { isCoachUnavailable } from "@/lib/ai-status";
import type { AIStatus } from "@/lib/schemas/chat";

/** Ayarlardaki yapay zekâ bölümü (bağlantı testi orada). */
export const AI_SETTINGS_HREF = "/settings#yapay-zeka";

const TONES = {
  ok: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-900",
  off: "bg-rose-100 text-rose-800",
  idle: "bg-slate-100 text-slate-600",
} as const;

function badgeFor(status: AIStatus | undefined, failed: boolean): [string, keyof typeof TONES] {
  if (!status) return failed ? ["Durum bilinmiyor", "idle"] : ["Bağlantı denetleniyor…", "idle"];
  if (status.status === "ready") return [`Model hazır · ${status.modelName}`, "ok"];
  if (status.status === "model_missing") return ["Model bulunamadı", "warn"];
  if (status.status === "disabled") return ["Koç kapalı", "idle"];
  return ["Koç kapalı", "off"];
}

/** B28: başlıktaki rozet sabit "hazır" değil, model sunucusunun gerçek durumudur. */
export function AIStatusBadge({ status, failed = false }: { status: AIStatus | undefined; failed?: boolean }) {
  const [label, tone] = badgeFor(status, failed);
  return (
    <span data-testid="ai-status-badge" className={`text-xs font-bold px-2 py-0.5 rounded-full ${TONES[tone]}`}>
      {label}
    </span>
  );
}

function titleFor(status: AIStatus): string {
  if (status.status === "model_missing") return `Koç kapalı: "${status.modelName}" modeli bulunamadı`;
  if (status.status === "invalid_url") return "Koç kapalı: kayıtlı yapay zekâ adresi izinli değil";
  return "Koç kapalı: yerel model bulunamadı";
}

/**
 * B28: sayfa açılınca model sunucusuna ulaşılamıyorsa (ya da seçili model yoksa) ne olduğunu,
 * nasıl düzeleceğini ve Ayarlar'daki teste giden yolu gösterir.
 */
export function ModelUnavailableNotice({ status, onRetry, retrying }: { status: AIStatus; onRetry: () => void; retrying: boolean }) {
  const missing = status.status === "model_missing";
  if (!missing && !isCoachUnavailable(status.status)) return null;
  return (
    <div role="alert" className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-sm space-y-2">
      <p className="font-bold flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>{titleFor(status)}</span>
      </p>
      <p className="text-amber-900 [overflow-wrap:anywhere]">{status.message}</p>
      {missing ? (
        <p className="text-amber-900">
          {status.models.length > 0
            ? `Sunucuda bulunan modeller: ${status.models.join(", ")}. Ayarlar'da birini seçip test et.`
            : "Ayarlar'da sunucudaki bir modeli seçip test et."}
        </p>
      ) : (
        <ol className="list-decimal pl-5 space-y-1 text-amber-900">
          <li>
            Ollama: ollama.com&apos;dan kur, sonra Terminal&apos;de <code className="font-mono">ollama pull {status.modelName}</code> yaz.
          </li>
          <li>LM Studio: bir model indir, Developer sekmesinden yerel sunucuyu başlat (127.0.0.1:1234).</li>
          <li>Ayarlar&apos;da sağlayıcıyı seç ve &quot;Bağlantıyı Test Et&quot;e bas; başarılı test ayarı kaydeder.</li>
        </ol>
      )}
      <p className="text-xs text-amber-800">
        Model olmadan da takip özelliklerin çalışır; geçmiş soruların (ör. &quot;bu hafta kaç km koştum?&quot;) kayıtlarından yanıtlanır.
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Link href={AI_SETTINGS_HREF} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800">
          Ayarlar&apos;da test et
        </Link>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-300 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
          Yeniden dene
        </button>
      </div>
    </div>
  );
}

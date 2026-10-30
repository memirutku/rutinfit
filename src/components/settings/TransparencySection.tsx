"use client";

import { ShieldCheck } from "lucide-react";
import { useAIExposure, useAISettings, useDiagnostics } from "@/lib/client/queries/system";

interface EgressRow {
  feature: string;
  what: string;
  where: string;
  /** Bu satır kayıtlı AI uç noktasına karşılık geliyorsa. */
  endpoint?: "local" | "cloud";
}

const ROWS: EgressRow[] = [
  {
    feature: "AI koçu (yerel model)",
    what: "Mesajın, profil özetin ve haftalık değerlendirme sayıların, yalnız bu bilgisayardaki model sunucusuna",
    where: "Dışarı çıkmaz (127.0.0.1)",
    endpoint: "local",
  },
  {
    feature: "AI koçu (OpenAI seçiliyse)",
    what: "Mesajın, profil özetin, bugünkü öğünlerin, haftalık değerlendirme sayıların ve eklediğin dosyaların içeriği",
    where: "api.openai.com",
    endpoint: "cloud",
  },
  { feature: "Paketli gıda araması ve barkod", what: "Barkod numarası ya da arama kelimesi", where: "world.openfoodfacts.org" },
  { feature: "Adresten tarif içe aktarma", what: "Yalnız yapıştırdığın adrese sayfa isteği (veri gönderilmez)", where: "Girdiğin tarif sitesi" },
  { feature: "openGym eşitlemesi", what: "Hiçbir şey; bu bilgisayardaki openGym dosyası okunur", where: "—" },
  { feature: "Yedekler ve dışa aktarma", what: "Hiçbir şey; dosya bu bilgisayara yazılır", where: "—" },
  { feature: "İlerleme fotoğrafları", what: "Hiçbir şey; fotoğraflar yalnız bu bilgisayardaki veri klasöründe durur", where: "—" },
];

/**
 * F67: Şeffaflık paketi. Bu bilgisayardan neyin çıktığını, kullanılan AI uç noktasını,
 * yerel model sunucusunun ağa açık olup olmadığını ve sürüm doğrulamasını gösterir.
 */
export function TransparencySection() {
  const settings = useAISettings();
  const exposure = useAIExposure();
  const diagnostics = useDiagnostics();
  const active = settings.data?.endpointKind;
  const version = diagnostics.data?.system.appVersion;

  return (
    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600" />
        <h3 className="font-bold text-slate-900 text-base">Şeffaflık: Hesap yok, bulut yok</h3>
      </div>
      <p className="text-sm text-slate-600">
        RutinFit hesap istemez ve verilerini hiçbir sunucuya yüklemez; veritabanın bu bilgisayarda durur. Aşağıdaki tablo
        bu bilgisayardan dışarı çıkabilen her şeyi gösterir.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <caption className="sr-only">Cihazdan ne çıkar?</caption>
          <thead>
            <tr className="text-slate-500 border-b border-slate-200">
              <th scope="col" className="py-2 pr-3 font-semibold">Özellik</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Ne gider</th>
              <th scope="col" className="py-2 font-semibold">Nereye</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.feature} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-3 font-semibold text-slate-800">
                  {row.feature}
                  {row.endpoint && row.endpoint === active && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 text-[10px] font-bold">Şu an kullanılan</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-slate-600">{row.what}</td>
                <td className="py-2 text-slate-800 font-mono">{row.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {exposure.data?.applicable &&
        (exposure.data.exposed ? (
          <div role="alert" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
            <p className="font-bold">
              Yerel model sunucun yerel ağa açık: <span className="font-mono">{exposure.data.exposedAt}</span>
            </p>
            <p>
              Aynı ağdaki biri modelini kullanabilir. Ollama'yı <code className="font-mono">OLLAMA_HOST=127.0.0.1</code> ortam
              değişkeniyle başlat ya da LM Studio'da yerel ağda sunma seçeneğini kapat.
            </p>
            <button type="button" onClick={() => exposure.refetch()} className="font-bold underline">
              Yeniden kontrol et
            </button>
          </div>
        ) : (
          <p className="text-xs text-emerald-800">
            ✓ Yerel model sunucun yalnız bu bilgisayardan erişilebilir (port {exposure.data.port}).
          </p>
        ))}

      <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1.5">
        {version && <p className="font-bold text-slate-800">Sürüm {version}</p>}
        <p>
          İndirdiğin dosyanın özgün olduğunu doğrulamak için Terminal'de aşağıdaki komutu çalıştır ve sonucu GitHub sürüm
          sayfasındaki SHA256SUMS.txt dosyasıyla karşılaştır:
        </p>
        <code className="block px-3 py-2 rounded-lg bg-slate-900 text-slate-100 font-mono">
          shasum -a 256 RutinFit_{version ?? "<sürüm>"}_aarch64.dmg
        </code>
        <p>İmzalı sürümler Apple Developer ID ile imzalanır ve Apple tarafından onaylanır (notarization).</p>
      </div>
    </section>
  );
}

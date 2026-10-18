"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  User,
  Flame,
  Bot,
  Download,
  Upload,
  Check,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  // AI Ayarları
  const [aiProvider, setAiProvider] = useState("ollama");
  const [aiBaseUrl, setAiBaseUrl] = useState("http://127.0.0.1:11434/v1");
  const [aiModel, setAiModel] = useState("llama3.2");
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<any>(null);

  // openGym Ayarları
  const [openGymUrl, setOpenGymUrl] = useState("http://localhost:8080");
  const [isTestingOpenGym, setIsTestingOpenGym] = useState(false);
  const [openGymResult, setOpenGymResult] = useState<any>(null);

  // Yedek İçe Aktarma
  const [importMessage, setImportMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/profile");
      const json = await res.json();
      setProfile(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        setProfileMessage("Profil ve hedefler başarıyla güncellendi! ✓");
        setTimeout(() => setProfileMessage(null), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleTestAI() {
    setIsTestingAI(true);
    setAiTestResult(null);
    try {
      const res = await fetch("/api/ai/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerType: aiProvider,
          baseUrl: aiBaseUrl,
          modelName: aiModel,
        }),
      });
      const data = await res.json();
      setAiTestResult(data);
    } catch (e: any) {
      setAiTestResult({
        success: false,
        message: "Test sırasında bir bağlantı hatası oluştu.",
      });
    } finally {
      setIsTestingAI(false);
    }
  }

  async function handleTestOpenGym() {
    setIsTestingOpenGym(true);
    setOpenGymResult(null);
    try {
      const res = await fetch("/api/opengym/status");
      const data = await res.json();
      setOpenGymResult(data);
    } catch (e: any) {
      setOpenGymResult({
        isOnline: false,
        error: "openGym servisi ile bağlantı kurulamadı.",
      });
    } finally {
      setIsTestingOpenGym(false);
    }
  }

  async function handleExportBackup() {
    window.location.href = "/api/backup/export";
  }

  async function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });

      const data = await res.json();
      if (res.ok) {
        setImportMessage("Yedek başarıyla geri yüklendi! Sayfa yenileniyor...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setImportMessage(`Hata: ${data.error}`);
      }
    } catch (err: any) {
      setImportMessage(`Geçersiz JSON dosyası: ${err.message}`);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm">Ayarlar yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Üst Başlık */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Ayarlar & Yapılandırma ⚙️
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Kişisel hedefler, yerel AI sağlayıcısı ve tam veritabanı yedekleme.
        </p>
      </div>

      {/* 1. PROFİL VE HEDEFLER */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <User className="w-5 h-5 text-brand-600" />
          <h3 className="font-bold text-slate-900 text-base">
            Kullanıcı Profili & Hedefleri
          </h3>
        </div>

        {profileMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold">
            {profileMessage}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Boy (cm)
              </label>
              <input
                type="number"
                value={profile?.heightCm || 181}
                onChange={(e) =>
                  setProfile({ ...profile, heightCm: parseFloat(e.target.value) })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Yaş
              </label>
              <input
                type="number"
                value={profile?.age || 25}
                onChange={(e) =>
                  setProfile({ ...profile, age: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cinsiyet
              </label>
              <select
                value={profile?.sex || "male"}
                onChange={(e) => setProfile({ ...profile, sex: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                <option value="male">Erkek</option>
                <option value="female">Kadın</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Güncel Kilo (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={profile?.currentWeightKg || 112}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    currentWeightKg: parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>

          {/* Kalori & Makro Hedefleri */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Kalori Hedefi (kcal)
              </label>
              <input
                type="number"
                value={profile?.calorieTarget || 2080}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    calorieTarget: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Üst Sınır Tavan (kcal)
              </label>
              <input
                type="number"
                value={profile?.calorieCeiling || 2100}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    calorieCeiling: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Protein Hedefi (g)
              </label>
              <input
                type="number"
                value={profile?.proteinTargetG || 165}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    proteinTargetG: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-emerald-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Karbonhidrat (g)
              </label>
              <input
                type="number"
                value={profile?.carbTargetG || 220}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    carbTargetG: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-amber-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Yağ Hedefi (g)
              </label>
              <input
                type="number"
                value={profile?.fatTargetG || 60}
                onChange={(e) =>
                  setProfile({ ...profile, fatTargetG: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-indigo-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Hedef Uyanış Saati
              </label>
              <input
                type="time"
                value={profile?.wakeTime || "06:00"}
                onChange={(e) =>
                  setProfile({ ...profile, wakeTime: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                İşten Eve Varış Saati
              </label>
              <input
                type="time"
                value={profile?.workdayHomeTime || "19:30"}
                onChange={(e) =>
                  setProfile({ ...profile, workdayHomeTime: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
            >
              {isSavingProfile ? "Kaydediliyor..." : "Hedefleri Güncelle"}
            </button>
          </div>
        </form>
      </div>

      {/* 2. YEREL YAPAY ZEKÂ YAPILANDIRMASI */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">
              Yerel Yapay Zekâ Sağlayıcısı
            </h3>
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-full">
            Gizlilik Garantili
          </span>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Sağlayıcı
              </label>
              <select
                value={aiProvider}
                onChange={(e) => {
                  setAiProvider(e.target.value);
                  if (e.target.value === "ollama") {
                    setAiBaseUrl("http://127.0.0.1:11434/v1");
                  } else if (e.target.value === "lmstudio") {
                    setAiBaseUrl("http://127.0.0.1:1234/v1");
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                <option value="ollama">Ollama (Önerilen, Yerel)</option>
                <option value="lmstudio">LM Studio (Yerel)</option>
                <option value="openai">OpenAI API (Bulut, İsteğe Bağlı)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Base URL
              </label>
              <input
                type="text"
                value={aiBaseUrl}
                onChange={(e) => setAiBaseUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Model Adı
              </label>
              <input
                type="text"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="Örn: llama3.2 veya mistral"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestAI}
              disabled={isTestingAI}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isTestingAI ? "animate-spin" : ""}`}
              />
              <span>Bağlantıyı Test Et</span>
            </button>
          </div>

          {aiTestResult && (
            <div
              className={`p-4 rounded-xl border text-xs leading-relaxed ${
                aiTestResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              <p className="font-bold">{aiTestResult.message}</p>
              {aiTestResult.models && aiTestResult.models.length > 0 && (
                <div className="mt-2 pt-2 border-t border-emerald-200/60">
                  <span className="font-semibold">Algılanan Modeller:</span>{" "}
                  {aiTestResult.models.join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. OPENGYM ENTEGRASYONU */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
              OG
            </span>
            <h3 className="font-bold text-slate-900 text-base">
              openGym Entegrasyonu (OrbStack / Docker)
            </h3>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full">
            Port 8080
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          openGym konteyneri OrbStack üzerinde bağımsız çalışır. 5.600+ hareket kütüphanesi,
          kas haritası ve Strong/Hevy içe aktarımı sunar.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              openGym Web Adresi
            </label>
            <input
              type="text"
              value={openGymUrl}
              onChange={(e) => setOpenGymUrl(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={handleTestOpenGym}
              disabled={isTestingOpenGym}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isTestingOpenGym ? "animate-spin" : ""}`}
              />
              <span>Bağlantıyı Test Et</span>
            </button>

            <a
              href={openGymUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              openGym'i Aç
            </a>
          </div>
        </div>

        {openGymResult && (
          <div
            className={`p-4 rounded-xl border text-xs leading-relaxed ${
              openGymResult.isOnline
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            <p className="font-bold">
              {openGymResult.isOnline
                ? `Bağlantı Başarılı! openGym v${openGymResult.version || "1.4.1"} aktif olarak çalışıyor.`
                : `Bağlantı Hatası: ${openGymResult.error}`}
            </p>
          </div>
        )}
      </div>

      {/* 4. VERİ YEDEKLEME VE GERİ YÜKLEME */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Download className="w-5 h-5 text-slate-700" />
          <h3 className="font-bold text-slate-900 text-base">
            Yerel Veri Yedekleme & Geri Yükleme
          </h3>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Tüm besin kataloğunuz, antrenman geçmişiniz, yemek planlarınız ve kilo
          kayıtlarınız tek bir JSON dosyasında yedeklenir. Veri kaybı yaşamadan
          başka bir cihaza aktarabilirsiniz.
        </p>

        {importMessage && (
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium">
            {importMessage}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
          >
            <Download className="w-4 h-4" />
            <span>Tüm Verileri JSON Olarak İndir</span>
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer border border-slate-200">
            <Upload className="w-4 h-4" />
            <span>Yedekten Geri Yükle (JSON Seç)</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

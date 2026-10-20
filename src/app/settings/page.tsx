"use client";

import { useEffect, useState } from "react";
import {
  User,
  Bot,
  Download,
  Upload,
  Check,
  AlertCircle,
  RefreshCw,
  Database,
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

  // Yedek İçe Aktarma & Tanılama
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importCounts, setImportCounts] = useState<any>(null);
  const [importOk, setImportOk] = useState(false);
  const [importing, setImporting] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);

  useEffect(() => {
    loadSettings();
    loadDiagnostics();
  }, []);

  async function loadDiagnostics() {
    setIsLoadingDiagnostics(true);
    try {
      const res = await fetch("/api/diagnostics");
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
      }
    } catch (err) {
      console.error("Tanılama yükleme hatası:", err);
    } finally {
      setIsLoadingDiagnostics(false);
    }
  }

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
    const input = e.target;
    const file = input.files?.[0];
    // Aynı dosya tekrar seçilebilsin diye input her durumda sıfırlanır.
    const reset = () => {
      input.value = "";
    };
    if (!file) return;

    if (
      !window.confirm(
        `"${file.name}" yedeği geri yüklensin mi?\n\nYedekteki kayıtlar eklenir veya güncellenir; yedekte olmayan mevcut kayıtlarınız silinmez.`
      )
    ) {
      reset();
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setImportOk(true);
        setImportMessage("Yedek başarıyla geri yüklendi!");
        setImportCounts(data.counts || null);
        loadDiagnostics();
        setTimeout(() => loadSettings(), 1000);
      } else {
        setImportOk(false);
        setImportMessage(`Hata: ${data.error || "Yedek geri yüklenemedi"}`);
        setImportCounts(null);
      }
    } catch (err: any) {
      setImportOk(false);
      setImportMessage(`Geçersiz JSON dosyası: ${err.message}`);
      setImportCounts(null);
    } finally {
      setImporting(false);
      reset();
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
              <label htmlFor="settings-field-1" className="block text-xs font-semibold text-slate-600 mb-1">
                Boy (cm)
              </label>
              <input id="settings-field-1"
                type="number"
                value={profile?.heightCm || 181}
                onChange={(e) =>
                  setProfile({ ...profile, heightCm: parseFloat(e.target.value) })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label htmlFor="settings-field-2" className="block text-xs font-semibold text-slate-600 mb-1">
                Yaş
              </label>
              <input id="settings-field-2"
                type="number"
                value={profile?.age || 25}
                onChange={(e) =>
                  setProfile({ ...profile, age: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label htmlFor="settings-field-3" className="block text-xs font-semibold text-slate-600 mb-1">
                Cinsiyet
              </label>
              <select id="settings-field-3"
                value={profile?.sex || "male"}
                onChange={(e) => setProfile({ ...profile, sex: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                <option value="male">Erkek</option>
                <option value="female">Kadın</option>
              </select>
            </div>
            <div>
              <label htmlFor="settings-field-4" className="block text-xs font-semibold text-slate-600 mb-1">
                Güncel Kilo (kg)
              </label>
              <input id="settings-field-4"
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
              <label htmlFor="settings-field-5" className="block text-xs font-semibold text-slate-600 mb-1">
                Kalori Hedefi (kcal)
              </label>
              <input id="settings-field-5"
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
              <label htmlFor="settings-field-6" className="block text-xs font-semibold text-slate-600 mb-1">
                Üst Sınır Tavan (kcal)
              </label>
              <input id="settings-field-6"
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
              <label htmlFor="settings-field-7" className="block text-xs font-semibold text-slate-600 mb-1">
                Protein Hedefi (g)
              </label>
              <input id="settings-field-7"
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
              <label htmlFor="settings-field-8" className="block text-xs font-semibold text-slate-600 mb-1">
                Karbonhidrat (g)
              </label>
              <input id="settings-field-8"
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
              <label htmlFor="settings-field-9" className="block text-xs font-semibold text-slate-600 mb-1">
                Yağ Hedefi (g)
              </label>
              <input id="settings-field-9"
                type="number"
                value={profile?.fatTargetG || 60}
                onChange={(e) =>
                  setProfile({ ...profile, fatTargetG: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-indigo-700"
              />
            </div>
            <div>
              <label htmlFor="settings-field-10" className="block text-xs font-semibold text-slate-600 mb-1">
                Hedef Uyanış Saati
              </label>
              <input id="settings-field-10"
                type="time"
                value={profile?.wakeTime || "06:00"}
                onChange={(e) =>
                  setProfile({ ...profile, wakeTime: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label htmlFor="settings-field-11" className="block text-xs font-semibold text-slate-600 mb-1">
                İşten Eve Varış Saati
              </label>
              <input id="settings-field-11"
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
              <label htmlFor="settings-field-12" className="block text-xs font-semibold text-slate-600 mb-1">
                Sağlayıcı
              </label>
              <select id="settings-field-12"
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
              <label htmlFor="settings-field-13" className="block text-xs font-semibold text-slate-600 mb-1">
                Base URL
              </label>
              <input id="settings-field-13"
                type="text"
                value={aiBaseUrl}
                onChange={(e) => setAiBaseUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label htmlFor="settings-field-14" className="block text-xs font-semibold text-slate-600 mb-1">
                Model Adı
              </label>
              <input id="settings-field-14"
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
              openGym Entegrasyonu (İsteğe Bağlı Yan Servis)
            </h3>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full">
            Port 8080 (Opsiyonel)
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          RutinFit masaüstü uygulaması Kas Haritası ve Plaka Hesabını yerel olarak bünyesinde barındırır. openGym ise harici bir yan servis (sidecar) olarak çalıştırılabilir; bağlandığında 5.600+ hareket kataloğu ve iki yönlü tartı senkronizasyonu sağlar. Docker zorunlu değildir.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-field-15" className="block text-xs font-semibold text-slate-600 mb-1">
              openGym Web Adresi
            </label>
            <input id="settings-field-15"
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
          <span className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-2.5 py-0.5 rounded-full ml-auto">
            Akıllı Birleştirme (Upsert)
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Tüm besin kataloğunuz, antrenman geçmişiniz, yemek planlarınız, kiler envanteriniz ve kilo
          kayıtlarınız tek bir JSON dosyasında yedeklenir. Geri yükleme işlemi <strong>Akıllı Birleştirme (Smart Merge)</strong> prensibiyle çalışır:
          Mevcut kayıtlarınız silinmez; yedekteki aynı kimliğe sahip kayıtlar güncellenir, yeni kayıtlar eklenir.
        </p>

        {importMessage && (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div
              role={importOk ? "status" : "alert"}
              className={`text-xs font-bold flex items-center gap-2 ${importOk ? "text-slate-800" : "text-rose-700"}`}
            >
              {importOk ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{importMessage}</span>
            </div>
            {importCounts && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(importCounts).map(([table, count]) => (
                  <span
                    key={table}
                    className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-slate-700"
                  >
                    {table}: <strong>{String(count)}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Tüm Verileri JSON Olarak İndir</span>
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer border border-slate-200">
            <Upload className="w-4 h-4" />
            <span>{importing ? "Geri yükleniyor..." : "Yedekten Geri Yükle (JSON Seç)"}</span>
            <input
              type="file"
              accept=".json"
              disabled={importing}
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 5. SİSTEM TANILAMA & VERİTABANI SAĞLIĞI */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">
              Sistem Tanılama & Depolama Sağlığı 🩺
            </h3>
          </div>
          <button
            onClick={loadDiagnostics}
            disabled={isLoadingDiagnostics}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiagnostics ? "animate-spin" : ""}`} />
            <span>Yenile</span>
          </button>
        </div>

        {diagnostics ? (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                  SQLite Veritabanı
                </span>
                <span className="font-mono font-bold text-slate-800 mt-0.5 block truncate" title={diagnostics.storage?.dbPath}>
                  {diagnostics.storage?.dbPath?.split("/").pop()}
                </span>
                <p className="text-[11px] text-emerald-600 font-bold mt-1">
                  Boyut: {diagnostics.storage?.dbSizeFormatted}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                  Yedek Klasörü
                </span>
                <span className="font-mono font-bold text-slate-800 mt-0.5 block truncate" title={diagnostics.storage?.backupsDir}>
                  {diagnostics.storage?.backupsDir?.split("/").pop()}
                </span>
                <p className="text-[11px] text-slate-600 mt-1">
                  Mevcut Yedekler: <strong>{diagnostics.storage?.backupCount || 0} adet</strong>
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                  Çalışma Ortamı
                </span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  Node {diagnostics.system?.nodeVersion} ({diagnostics.system?.platform}-{diagnostics.system?.arch})
                </span>
                <p className="text-[11px] text-slate-600 mt-1">
                  RAM Tüketimi: <strong>{diagnostics.system?.memoryRssMb} MB</strong>
                </p>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-700 block mb-2">
                Veritabanı Tablo Kayıt Dağılımı:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">Besinler:</span>
                  <span className="font-bold text-slate-900">{diagnostics.counts?.foods || 0}</span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">Öğün Kayıtları:</span>
                  <span className="font-bold text-slate-900">{diagnostics.counts?.foodLogs || 0}</span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">Antrenmanlar:</span>
                  <span className="font-bold text-slate-900">{diagnostics.counts?.workoutSessions || 0}</span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">Set Kayıtları:</span>
                  <span className="font-bold text-slate-900">{diagnostics.counts?.setLogs || 0}</span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">Kiler Ürünleri:</span>
                  <span className="font-bold text-slate-900">{diagnostics.counts?.pantryItems || 0}</span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">Tartı Kayıtları:</span>
                  <span className="font-bold text-slate-900">{diagnostics.counts?.weightLogs || 0}</span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">Yemek Planları:</span>
                  <span className="font-bold text-slate-900">{diagnostics.counts?.mealPlans || 0}</span>
                </div>
                <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">Tarifler:</span>
                  <span className="font-bold text-slate-900">{diagnostics.counts?.recipes || 0}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Tanılama bilgileri yükleniyor...</p>
        )}
      </div>
    </div>
  );
}

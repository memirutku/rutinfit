"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { fetchOpenGymStatus } from "@/lib/client/queries/system";

/** openGym yan servisi: adres ve kullanıcının başlattığı bağlantı testi. */
export function OpenGymSection() {
  const [openGymUrl, setOpenGymUrl] = useState("http://localhost:8080");
  // Test kullanıcı tetiklemelidir; servis kapalıyken de bir sonuç ({ isOnline: false }) döner.
  const test = useMutation({ mutationFn: fetchOpenGymStatus });
  const result = test.data;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 h-5 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">OG</span>
          <h3 className="font-bold text-slate-900 text-base">openGym bağlantısı</h3>
        </div>
        <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">İsteğe bağlı</span>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        Kas haritası ve plaka hesabı RutinFit'in içinde çalışır; openGym gerekmez. openGym bu bilgisayarda ayrıca çalıştırabileceğin
        açık kaynaklı bir antrenman uygulamasıdır (varsayılan adres: port 8080). Bağlarsan 5.600'den fazla hareketlik katalog ve tartı
        kayıtlarının iki yönlü eşitlenmesi eklenir.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="settings-field-15" className="block text-xs font-semibold text-slate-600 mb-1">
            openGym adresi
          </label>
          <input
            id="settings-field-15"
            type="text"
            value={openGymUrl}
            onChange={(e) => setOpenGymUrl(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={() => test.mutate()}
            disabled={test.isPending}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${test.isPending ? "animate-spin" : ""}`} />
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

      {result && (
        <div
          className={`p-4 rounded-xl border text-xs leading-relaxed ${
            result.isOnline ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          <p className="font-bold">
            {result.isOnline
              ? `Bağlantı Başarılı! openGym${result.version ? ` v${result.version}` : ""} aktif olarak çalışıyor.`
              : `Bağlantı Hatası: ${result.error}`}
          </p>
        </div>
      )}
    </div>
  );
}

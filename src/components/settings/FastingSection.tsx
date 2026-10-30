"use client";

import { useState } from "react";
import { Moon } from "lucide-react";
import { errorMessage } from "@/lib/client/api";
import { useSaveFastingSettings } from "@/lib/client/queries/fasting";
import { useProfile } from "@/lib/client/queries/system";
import { PROVINCES } from "@/lib/prayer-times";

const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";
const LABEL = "block text-xs font-semibold text-slate-600 mb-1";
const TARGET_HOURS = [12, 14, 16, 18, 20];

const int = (v: string) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : 0);

/** F76: Ramazan modu · F14: aralıklı oruç hedefi. */
export function FastingSection() {
  const profile = useProfile();
  const save = useSaveFastingSettings();
  const p = profile.data;
  const initial = {
    ramadanMode: p?.ramadanMode ?? false,
    ramadanProvince: p?.ramadanProvince ?? "İstanbul",
    ramadanImsakAdjust: p?.ramadanImsakAdjust ?? 0,
    ramadanIftarAdjust: p?.ramadanIftarAdjust ?? 0,
    fastingTargetHours: p?.fastingTargetHours ?? null,
  };
  const [form, setForm] = useState(initial);
  const [seeded, setSeeded] = useState(p);
  // Profil yüklenince form doldurulur (render sırasında; boş formla kare çizilmez).
  if (p && p !== seeded) {
    setSeeded(p);
    setForm(initial);
  }
  const [saved, setSaved] = useState(false);
  // B34: her değişiklik hemen kaydedilir (sayı alanları alandan çıkınca).
  function persist(next: typeof form) {
    setForm(next);
    setSaved(false);
    save.mutate(next, { onSuccess: () => setSaved(true) });
  }
  // Profil gelmeden form gösterilmez: erken yapılan seçim yüklemeyle silinmesin.
  if (!p && !profile.isError) return null;

  return (
    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Moon className="w-5 h-5 text-amber-600" />
        <h3 className="font-bold text-slate-900 text-base">Oruç ve Ramazan</h3>
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <input type="checkbox" checked={form.ramadanMode} onChange={(e) => persist({ ...form, ramadanMode: e.target.checked })} aria-label="Ramazan modu" />
        Ramazan modu
        <span className="font-normal text-xs text-slate-500">(imsak/iftar geri sayımı, sahur ve iftar öğünleri, oruç saatlerinde su hatırlatması yok)</span>
      </label>
      {form.ramadanMode && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label htmlFor="fast-province" className={LABEL}>
              İl
            </label>
            <select id="fast-province" value={form.ramadanProvince} onChange={(e) => persist({ ...form, ramadanProvince: e.target.value })} className={INPUT}>
              {PROVINCES.map((pr) => (
                <option key={pr.name} value={pr.name}>
                  {pr.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fast-imsak" className={LABEL}>
              İmsak düzeltmesi (dk)
            </label>
            <input id="fast-imsak" type="number" min={-30} max={30} value={form.ramadanImsakAdjust} onChange={(e) => setForm({ ...form, ramadanImsakAdjust: int(e.target.value) })} onBlur={() => persist(form)} className={INPUT} />
          </div>
          <div>
            <label htmlFor="fast-iftar" className={LABEL}>
              İftar düzeltmesi (dk)
            </label>
            <input id="fast-iftar" type="number" min={-30} max={30} value={form.ramadanIftarAdjust} onChange={(e) => setForm({ ...form, ramadanIftarAdjust: int(e.target.value) })} onBlur={() => persist(form)} className={INPUT} />
          </div>
          <p className="sm:col-span-3 text-[11px] text-slate-500">
            Vakitler il merkezine göre internetsiz hesaplanır. İlçende Diyanet takviminden farklıysa dakika düzeltmesi gir.
          </p>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <input
          type="checkbox"
          checked={form.fastingTargetHours !== null}
          onChange={(e) => persist({ ...form, fastingTargetHours: e.target.checked ? 16 : null })}
          aria-label="Aralıklı oruç zamanlayıcısı"
        />
        Aralıklı oruç zamanlayıcısı
      </label>
      {form.fastingTargetHours !== null && (
        <div className="max-w-xs">
          <label htmlFor="fast-target" className={LABEL}>
            Hedef süre
          </label>
          <select id="fast-target" value={form.fastingTargetHours} onChange={(e) => persist({ ...form, fastingTargetHours: Number(e.target.value) })} className={INPUT}>
            {TARGET_HOURS.map((h) => (
              <option key={h} value={h}>
                {h} saat ({h}:{24 - h})
              </option>
            ))}
          </select>
        </div>
      )}

      {(save.isPending || saved) && (
        <p role="status" className="text-xs text-emerald-700">
          {save.isPending ? "Kaydediliyor..." : "Kaydedildi ✓"}
        </p>
      )}
      {save.isError && (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(save.error, "Kaydedilemedi.")}
        </p>
      )}
    </section>
  );
}

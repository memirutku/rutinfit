"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { errorMessage } from "@/lib/client/api";
import { useSaveProfile } from "@/lib/client/queries/system";
import { useTimedMessage } from "@/hooks/useTimedMessage";
import type { Profile, ProfileInput } from "@/lib/schemas/profile";

/** Formdaki yerel taslak: profil yüklenemediyse alanlar boş başlar (varsayılanlar gösterilir). */
type ProfileDraft = Partial<Profile>;
type NumericKey =
  | "heightCm"
  | "age"
  | "currentWeightKg"
  | "calorieTarget"
  | "calorieCeiling"
  | "proteinTargetG"
  | "carbTargetG"
  | "fatTargetG";
type TimeKey = "wakeTime" | "workdayHomeTime";

interface NumberFieldDef {
  id: string;
  label: string;
  key: NumericKey;
  fallback: number;
  parse: (raw: string) => number;
  step?: string;
  tone?: string;
}

const LABEL = "block text-xs font-semibold text-slate-600 mb-1";
const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";
const int = (raw: string) => parseInt(raw, 10);

const HEIGHT: NumberFieldDef = { id: "settings-field-1", label: "Boy (cm)", key: "heightCm", fallback: 181, parse: parseFloat };
const AGE: NumberFieldDef = { id: "settings-field-2", label: "Yaş", key: "age", fallback: 25, parse: int };
const WEIGHT: NumberFieldDef = {
  id: "settings-field-4",
  label: "Güncel Kilo (kg)",
  key: "currentWeightKg",
  fallback: 112,
  parse: parseFloat,
  step: "0.1",
};
const TARGETS: NumberFieldDef[] = [
  { id: "settings-field-5", label: "Kalori Hedefi (kcal)", key: "calorieTarget", fallback: 2080, parse: int, tone: "font-bold text-slate-900" },
  { id: "settings-field-6", label: "Üst Sınır Tavan (kcal)", key: "calorieCeiling", fallback: 2100, parse: int, tone: "font-bold text-slate-900" },
  { id: "settings-field-7", label: "Protein Hedefi (g)", key: "proteinTargetG", fallback: 165, parse: int, tone: "font-bold text-emerald-700" },
  { id: "settings-field-8", label: "Karbonhidrat (g)", key: "carbTargetG", fallback: 220, parse: int, tone: "font-bold text-amber-700" },
];
const FAT: NumberFieldDef = { id: "settings-field-9", label: "Yağ Hedefi (g)", key: "fatTargetG", fallback: 60, parse: int, tone: "font-bold text-indigo-700" };

function NumberField({ field, draft, onChange }: { field: NumberFieldDef; draft: ProfileDraft; onChange: (key: NumericKey, value: number) => void }) {
  return (
    <div>
      <label htmlFor={field.id} className={LABEL}>
        {field.label}
      </label>
      <input
        id={field.id}
        type="number"
        step={field.step}
        value={draft[field.key] || field.fallback}
        onChange={(e) => onChange(field.key, field.parse(e.target.value))}
        className={field.tone ? `${INPUT} ${field.tone}` : INPUT}
      />
    </div>
  );
}

function TimeField(props: { id: string; label: string; field: TimeKey; fallback: string; draft: ProfileDraft; onChange: (key: TimeKey, value: string) => void }) {
  const { id, label, field, fallback, draft, onChange } = props;
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input id={id} type="time" value={draft[field] || fallback} onChange={(e) => onChange(field, e.target.value)} className={INPUT} />
    </div>
  );
}

/**
 * Profil ve günlük hedefler. Yazılanlar yerel taslakta tutulur; profil sorgusu yeni veri
 * getirdiğinde (kayıt yanıtı, yedekten geri yükleme) taslak yeniden kurulur.
 */
export function ProfileTargetsSection({ profile }: { profile: Profile | undefined }) {
  const [draft, setDraft] = useState<ProfileDraft>(() => profile ?? {});
  const [seededFrom, setSeededFrom] = useState(profile);
  if (profile !== seededFrom) {
    setSeededFrom(profile);
    setDraft(profile ?? {});
  }

  const save = useSaveProfile();
  const success = useTimedMessage<string>(3000);
  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    success.clear();
    // Doğrulama sunucudadır: eksik/geçersiz alan 400 döner ve hata aşağıda gösterilir.
    save.mutate(draft as ProfileInput, {
      onSuccess: () => success.show("Profil ve hedefler başarıyla güncellendi! ✓"),
    });
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <User className="w-5 h-5 text-brand-600" />
        <h3 className="font-bold text-slate-900 text-base">Kullanıcı Profili & Hedefleri</h3>
      </div>

      {success.message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold">
          {success.message}
        </div>
      )}
      {save.isError && (
        <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
          {errorMessage(save.error, "Profil güncellenemedi.")}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <NumberField field={HEIGHT} draft={draft} onChange={set} />
          <NumberField field={AGE} draft={draft} onChange={set} />
          <div>
            <label htmlFor="settings-field-3" className={LABEL}>
              Cinsiyet
            </label>
            <select
              id="settings-field-3"
              value={draft.sex || "male"}
              onChange={(e) => set("sex", e.target.value as Profile["sex"])}
              className={INPUT}
            >
              <option value="male">Erkek</option>
              <option value="female">Kadın</option>
            </select>
          </div>
          <NumberField field={WEIGHT} draft={draft} onChange={set} />
        </div>

        {/* Kalori & Makro Hedefleri */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
          {TARGETS.map((field) => (
            <NumberField key={field.key} field={field} draft={draft} onChange={set} />
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
          <NumberField field={FAT} draft={draft} onChange={set} />
          <TimeField id="settings-field-10" label="Hedef Uyanış Saati" field="wakeTime" fallback="06:00" draft={draft} onChange={set} />
          <TimeField id="settings-field-11" label="İşten Eve Varış Saati" field="workdayHomeTime" fallback="19:30" draft={draft} onChange={set} />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={save.isPending}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
          >
            {save.isPending ? "Kaydediliyor..." : "Hedefleri Güncelle"}
          </button>
        </div>
      </form>
    </div>
  );
}

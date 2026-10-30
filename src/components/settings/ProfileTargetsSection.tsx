"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { errorMessage } from "@/lib/client/api";
import { useSaveProfile } from "@/lib/client/queries/system";
import { useTimedMessage } from "@/hooks/useTimedMessage";
import { DAY_PATTERNS, DAY_PATTERN_LABELS, type DayPattern, type Profile, type ProfileInput } from "@/lib/schemas/profile";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { calorieFloor } from "@/lib/safety";
import { formatNumberTr } from "@/lib/format";
import { DEFAULT_TARGETS, NEW_PROFILE_DEFAULTS } from "@/lib/constants";
import { macroMismatch, redistributeMacros } from "@/lib/macro-balance";
import { SetupWizard } from "@/components/onboarding/SetupWizard";

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
  | "fatTargetG"
  | "waterTargetMl"
  | "householdSize";
type TimeKey = "wakeTime" | "workdayHomeTime";
type ToggleKey = "hideNumbers" | "cycleTracking";

interface NumberFieldDef {
  id: string;
  label: string;
  key: NumericKey;
  fallback: number;
  parse: (raw: string) => number;
  step?: string;
  /** F80: virgüllü ondalık kabul eden alan. */
  decimal?: boolean;
  tone?: string;
}

const LABEL = "block text-xs font-semibold text-slate-600 mb-1";
const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";
const int = (raw: string) => parseInt(raw, 10);
const CALORIE_FALLBACK = DEFAULT_TARGETS.calorieTarget;

const HEIGHT: NumberFieldDef = { id: "settings-field-1", label: "Boy (cm)", key: "heightCm", fallback: NEW_PROFILE_DEFAULTS.heightCm, parse: parseFloat, decimal: true };
const AGE: NumberFieldDef = { id: "settings-field-2", label: "Yaş", key: "age", fallback: NEW_PROFILE_DEFAULTS.age, parse: int };
const WEIGHT: NumberFieldDef = {
  id: "settings-field-4",
  label: "Güncel Kilo (kg)",
  key: "currentWeightKg",
  fallback: NEW_PROFILE_DEFAULTS.currentWeightKg,
  parse: parseFloat,
  step: "0.1",
  decimal: true,
};
// Profil yokken hedef alanları ortak varsayılanları gösterir (kişisel sabit sayı yok).
const TARGETS: NumberFieldDef[] = [
  { id: "settings-field-5", label: "Kalori Hedefi (kcal)", key: "calorieTarget", fallback: DEFAULT_TARGETS.calorieTarget, parse: int, tone: "font-bold text-slate-900" },
  { id: "settings-field-6", label: "Kalori tavanı (kcal)", key: "calorieCeiling", fallback: DEFAULT_TARGETS.calorieCeiling, parse: int, tone: "font-bold text-slate-900" },
  { id: "settings-field-7", label: "Protein Hedefi (g)", key: "proteinTargetG", fallback: DEFAULT_TARGETS.proteinTargetG, parse: int, tone: "font-bold text-emerald-700" },
  { id: "settings-field-8", label: "Karbonhidrat (g)", key: "carbTargetG", fallback: DEFAULT_TARGETS.carbTargetG, parse: int, tone: "font-bold text-amber-700" },
];
const WATER: NumberFieldDef = { id: "settings-field-water", label: "Günlük su hedefi (ml)", key: "waterTargetMl", fallback: 2500, parse: int, tone: "font-bold text-sky-700" };
const HOUSEHOLD: NumberFieldDef = { id: "settings-field-household", label: "Hane büyüklüğü (kişi)", key: "householdSize", fallback: 1, parse: int };
const FAT: NumberFieldDef = { id: "settings-field-9", label: "Yağ Hedefi (g)", key: "fatTargetG", fallback: DEFAULT_TARGETS.fatTargetG, parse: int, tone: "font-bold text-indigo-700" };

function NumberField({ field, draft, onChange }: { field: NumberFieldDef; draft: ProfileDraft; onChange: (key: NumericKey, value: number) => void }) {
  return (
    <div>
      <label htmlFor={field.id} className={LABEL}>
        {field.label}
      </label>
      {field.decimal ? (
        <DecimalInput
          id={field.id}
          value={draft[field.key] || field.fallback}
          onValueChange={(v) => onChange(field.key, v)}
          className={field.tone ? `${INPUT} ${field.tone}` : INPUT}
        />
      ) : (
        <input
          id={field.id}
          type="number"
          step={field.step}
          value={draft[field.key] || field.fallback}
          onChange={(e) => onChange(field.key, field.parse(e.target.value))}
          className={field.tone ? `${INPUT} ${field.tone}` : INPUT}
        />
      )}
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

function ToggleSaved({ show }: { show: boolean }) {
  return show ? (
    <span role="status" className="text-[11px] font-semibold text-emerald-700">
      Kaydedildi ✓
    </span>
  ) : null;
}

/**
 * Profil ve günlük hedefler. Yazılanlar yerel taslakta tutulur; profil sorgusu yeni veri
 * getirdiğinde (kayıt yanıtı, yedekten geri yükleme) taslak yeniden kurulur.
 */
export function ProfileTargetsSection({ profile }: { profile: Profile | undefined }) {
  const [draft, setDraft] = useState<ProfileDraft>(() => profile ?? {});
  const [seededFrom, setSeededFrom] = useState(profile);
  // B34: anahtar kaydından dönen profil yalnız anahtarları günceller; formdaki kaydedilmemiş düzenleme kalır.
  const [toggleSaving, setToggleSaving] = useState(false);
  if (profile !== seededFrom) {
    setSeededFrom(profile);
    setDraft((d) => (toggleSaving && profile ? { ...d, hideNumbers: profile.hideNumbers, cycleTracking: profile.cycleTracking } : profile ?? {}));
    if (toggleSaving) setToggleSaving(false);
  }

  const [acknowledgeLow, setAcknowledgeLow] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const floor = calorieFloor(draft.sex ?? "male");
  const calorieTarget = draft.calorieTarget || CALORIE_FALLBACK;
  const isLowCalorie = calorieTarget < floor;
  // B15: kalori hedefi değişince makrolar eski değerde kalabilir; enerjileri hedefle uyuşmazsa uyarılır.
  const macros = {
    proteinG: draft.proteinTargetG || DEFAULT_TARGETS.proteinTargetG,
    carbsG: draft.carbTargetG || DEFAULT_TARGETS.carbTargetG,
    fatG: draft.fatTargetG || DEFAULT_TARGETS.fatTargetG,
  };
  const balance = macroMismatch(calorieTarget, macros);
  const suggestion = balance.mismatched ? redistributeMacros(calorieTarget, macros) : null;

  const save = useSaveProfile();
  const success = useTimedMessage<string>(3000);
  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  // B34: açma-kapama ayarları dokununca kaydedilir. Kayıtlı profil + yalnız bu anahtar gönderilir;
  // formdaki kaydedilmemiş hedefler bu kayda girmez. Onay mesajı anahtarın yanında görünür.
  const toggleSave = useSaveProfile();
  const toggleDone = useTimedMessage<ToggleKey>(2500);
  function saveToggle(key: ToggleKey, value: boolean) {
    set(key, value);
    toggleDone.clear();
    if (!profile) return;
    setToggleSaving(true);
    // Kayıtlı hedef taban altındaysa daha önce onaylanmıştır (sunucu onaysız kaydetmez).
    const acknowledged = profile.calorieTarget < calorieFloor(profile.sex);
    toggleSave.mutate(
      { ...(profile as ProfileInput), [key]: value, acknowledgeLowCalorie: acknowledged || undefined },
      {
        onSuccess: () => toggleDone.show(key),
        onError: () => {
          setToggleSaving(false);
          set(key, !value);
        },
      }
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    success.clear();
    // Doğrulama sunucudadır: eksik/geçersiz alan 400 döner ve hata aşağıda gösterilir.
    const payload: ProfileInput = { ...(draft as ProfileInput), acknowledgeLowCalorie: isLowCalorie ? acknowledgeLow : undefined };
    save.mutate(payload, {
      onSuccess: () => success.show("Profil ve hedefler başarıyla güncellendi! ✓"),
    });
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <User className="w-5 h-5 text-brand-600" />
        <h3 className="font-bold text-slate-900 text-base">Kullanıcı Profili & Hedefleri</h3>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="ml-auto px-3 py-1.5 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-xs font-bold hover:bg-brand-100"
        >
          Sihirbazla yeniden hesapla
        </button>
      </div>
      <SetupWizard open={wizardOpen} profile={profile} onClose={() => setWizardOpen(false)} />

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

        {isLowCalorie && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
            <p>
              Bu hedef {formatNumberTr(floor)} kcal altında. Güvenli taban bu; daha düşük bir hedef yalnız bir doktor ya da
              diyetisyen gözetiminde uygulanmalı.
            </p>
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={acknowledgeLow} onChange={(e) => setAcknowledgeLow(e.target.checked)} />
              Bu hedefi bir doktor ya da diyetisyenle birlikte belirledim
            </label>
          </div>
        )}

        {balance.mismatched && (
          <div role="status" aria-label="Makro dengesi" className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs space-y-2">
            <p>
              Protein, karbonhidrat ve yağ hedeflerin toplam {formatNumberTr(balance.macroKcal)} kcal ediyor; kalori hedefin{" "}
              {formatNumberTr(calorieTarget)} kcal ({formatNumberTr(Math.abs(balance.diff))} kcal {balance.diff > 0 ? "fazla" : "eksik"}).
            </p>
            {suggestion && (
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  Oranları koruyarak dağıtılırsa: Protein {formatNumberTr(suggestion.proteinG)} g · Karbonhidrat {formatNumberTr(suggestion.carbsG)} g · Yağ{" "}
                  {formatNumberTr(suggestion.fatG)} g
                </span>
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, proteinTargetG: suggestion.proteinG, carbTargetG: suggestion.carbsG, fatTargetG: suggestion.fatG }))}
                  className="px-3 py-1.5 rounded-lg bg-sky-700 text-white font-bold hover:bg-sky-800"
                >
                  Makroları oranla dağıt
                </button>
              </div>
            )}
            <p className="text-sky-800">İstersen makroları elle de düzeltebilirsin; diyetisyeninin verdiği değerler varsa onları gir.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
          <NumberField field={FAT} draft={draft} onChange={set} />
          <TimeField id="settings-field-10" label="Hedef Uyanış Saati" field="wakeTime" fallback={NEW_PROFILE_DEFAULTS.wakeTime} draft={draft} onChange={set} />
          {/* B02/B06: gün düzeni; rutin bandı ve eve varış saati yalnız ofis/okulda kullanılır. */}
          <div>
            <label htmlFor="settings-day-pattern" className={LABEL}>
              Gün düzeni
            </label>
            <select
              id="settings-day-pattern"
              value={draft.dayPattern ?? ""}
              onChange={(e) => set("dayPattern", (e.target.value || null) as DayPattern | null)}
              className={INPUT}
            >
              <option value="">Belirtilmedi</option>
              {DAY_PATTERNS.map((p) => (
                <option key={p} value={p}>
                  {DAY_PATTERN_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          {(draft.dayPattern === "office" || draft.dayPattern === "school") && (
            <TimeField
              id="settings-field-11"
              label="Eve varış saati"
              field="workdayHomeTime"
              fallback={NEW_PROFILE_DEFAULTS.workdayHomeTime}
              draft={draft}
              onChange={set}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField field={WATER} draft={draft} onChange={set} />
          <NumberField field={HOUSEHOLD} draft={draft} onChange={set} />
        </div>

        <div className="pt-3 border-t border-slate-100">
          <label htmlFor="settings-coach-notes" className={LABEL}>
            Koça notlar (alerji, sakatlık, ekipman, çalışma düzeni)
          </label>
          <textarea
            id="settings-coach-notes"
            rows={3}
            maxLength={1000}
            value={draft.coachNotes ?? ""}
            placeholder="Örn: Fıstık alerjim var. Sol dizimde menisküs sorunu var. Evde bir çift dambıl var."
            onChange={(e) => set("coachNotes", e.target.value || null)}
            className={INPUT}
          />
          <p className="mt-1 text-[11px] text-slate-500">Koç bu notları her yanıtta dikkate alır. Notlar yalnız seçtiğin yapay zekâ sağlayıcısına gönderilir.</p>
        </div>

        <div className="pt-3 border-t border-slate-100 space-y-3">
          <p className="text-[11px] text-slate-500">Bu iki ayar dokununca kaydedilir.</p>
          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input
              id="settings-hide-numbers"
              type="checkbox"
              className="mt-0.5"
              checked={draft.hideNumbers ?? false}
              disabled={toggleSave.isPending}
              onChange={(e) => saveToggle("hideNumbers", e.target.checked)}
            />
            <span>
              <span className="font-bold">Kalori ve makro sayılarını gizle</span> <ToggleSaved show={toggleDone.message === "hideNumbers"} />
              <span className="block text-slate-500">Pano ilerlemeyi sayı yerine sözle gösterir. Sayılar hesaplanmaya devam eder.</span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input
              id="settings-cycle-tracking"
              type="checkbox"
              className="mt-0.5"
              checked={draft.cycleTracking ?? false}
              disabled={toggleSave.isPending}
              onChange={(e) => saveToggle("cycleTracking", e.target.checked)}
            />
            <span>
              <span className="font-bold">Adet döngüsü notu</span> <ToggleSaved show={toggleDone.message === "cycleTracking"} />
              <span className="block text-slate-500">
                Günlük ritimde isteğe bağlı not. Haftalık değerlendirme kilo dalgalanmasını açıklarken kullanır; yapay zekâ modeline gönderilmez.
              </span>
            </span>
          </label>
          {toggleSave.isError && (
            <p role="alert" className="text-xs font-semibold text-rose-700">
              {errorMessage(toggleSave.error, "Ayar kaydedilemedi.")}
            </p>
          )}
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

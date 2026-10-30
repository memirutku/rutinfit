/**
 * F56: Yeme bozukluğu ve tıbbi güvenlik önlemleri. Hedef üreten her yol (profil, kurulum
 * sihirbazı, adaptif TDEE, AI hedef taslağı) bu modülden geçer.
 */
import { formatNumberTr } from "./format";

/** Günlük kalori tabanı (kcal). Altı yalnız sağlık profesyoneli gözetiminde uygulanmalı. */
export const CALORIE_FLOOR = { female: 1200, male: 1500 } as const;

/** Haftalık azami kilo kaybı: vücut ağırlığının %1'i. */
export const MAX_WEEKLY_LOSS_FRACTION = 0.01;

/** Cinsiyet bilinmiyorsa daha düşük (kadın) taban kullanılır; hiçbir hedef 1.200'ün altına inmez. */
export function calorieFloor(sex: string | null | undefined): number {
  return sex === "male" ? CALORIE_FLOOR.male : CALORIE_FLOOR.female;
}

/** Haftalık azami kayıp (kg), 0,05 kg'a aşağı yuvarlanır. */
export function maxWeeklyLossKg(weightKg: number): number {
  const raw = Math.floor(weightKg * MAX_WEEKLY_LOSS_FRACTION * 20) / 20;
  return Math.round(raw * 100) / 100;
}

export interface TargetCheck {
  ok: boolean;
  floor: number;
  message?: string;
}

export function checkCalorieTarget(sex: string | null | undefined, calorieTarget: number): TargetCheck {
  const floor = calorieFloor(sex);
  if (calorieTarget >= floor) return { ok: true, floor };
  return {
    ok: false,
    floor,
    message: `Günlük kalori hedefi ${formatNumberTr(floor)} kcal altında olamaz. Daha düşük bir hedef yalnız bir doktor ya da diyetisyen gözetiminde uygulanmalıdır.`,
  };
}

/** Yeme bozukluğu ya da kendine zarar riski taşıyan ifadeler (Türkçe küçük harfle aranır). */
const RED_FLAG_PATTERNS: RegExp[] = [
  /kendimi\s+kustur/,
  /(yedikten|yemekten)\s+sonra\s+(kendimi\s+)?kus/,
  /laksatif|müshil/,
  /(günlerdir|hiç)\s+(bir\s+şey|yemek)?\s*(yemiyorum|yemedim)/,
  /kendimi\s+aç\s+bırak/,
  /tıkın/,
  /yeme\s+bozukluğ/,
  /anoreks|bulimi/,
  /kendime\s+zarar/,
  /intihar|ölmek\s+istiyorum/,
  /günde\s+([1-7]\d{2}|\d{1,2})\s*(kcal|kalori)/,
];

export function detectRedFlags(text: string | null | undefined): boolean {
  const t = (text ?? "").toLocaleLowerCase("tr-TR");
  return RED_FLAG_PATTERNS.some((re) => re.test(t));
}

export const SAFETY_REFERRAL_TR =
  "Yazdıkların yeme davranışınla ya da kendine zarar vermekle ilgili olabilir. Bu konuda bir doktor, diyetisyen ya da ruh sağlığı uzmanıyla konuşmanı öneririz. Acil bir durumdaysan 112'yi ara.";

import { targetsFromProfile } from "@/lib/constants";
import { formatNumberTr } from "@/lib/format";
import type { Profile } from "@/lib/schemas/profile";

/** B03: başlıktaki hedef satırı profilden üretilir; "sayıları gizle" açıkken sayı yazmaz. */
export function targetSummary(profile: Profile | undefined): string | null {
  if (!profile) return null;
  if (profile.hideNumbers) return "Sayılar gizli. Hedeflerin profilinde kayıtlı; Ayarlar'dan gösterebilirsin.";
  const t = targetsFromProfile(profile);
  const prefix = profile.isOnboarded === false ? "Tahmini hedef" : "Hedef";
  return `${prefix}: ${formatNumberTr(t.calorieTarget)} kcal · ${formatNumberTr(t.proteinTargetG)} g protein · ${formatNumberTr(t.carbTargetG)} g karbonhidrat · ${formatNumberTr(t.fatTargetG)} g yağ`;
}

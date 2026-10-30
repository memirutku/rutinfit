import { Coffee, Dumbbell, Moon, Sun, Utensils, type LucideIcon } from "lucide-react";
import type { MealType } from "@/lib/schemas/enums";

/** Gece rutini adımının kaydırdığı iyilik hali bölümü. */
export const WELLBEING_SECTION_ID = "quick-wellbeing-section";

export type RhythmAction =
  | { kind: "creatine" }
  | { kind: "quickAdd"; mealType: MealType }
  | { kind: "scrollToWellbeing" };

export interface RhythmStep {
  title: string;
  time: string;
  description: string;
  icon: LucideIcon;
  badge: string;
  actionText: string;
  action: RhythmAction;
}

/** Günün saatine göre "Sıradaki Adım" kartı. Saat dışarıdan verilir (test edilebilir). */
export function getRhythmStep(hour: number, homeTime = "19:30", creatineTaken = false): RhythmStep {
  if (hour < 11) {
    return {
      title: "Sabah Rutini & Hidrasyon",
      time: "07:00 - 11:00",
      description: "Güne 500ml su ile başla, tartılmanı kaydet ve günlük 5g kreatinini almayı unutma.",
      icon: Sun,
      badge: "Güne Başlangıç",
      actionText: creatineTaken ? "Kreatin Alındı ✓" : "Kreatin İşaretle",
      action: { kind: "creatine" },
    };
  }
  if (hour < 16) {
    return {
      title: "Öğle Beslenmesi & Odak",
      time: "12:00 - 15:30",
      description: "Yüksek proteinli öğle öğününü kaydet, hidrasyonu sürdür ve enerjini dengede tut.",
      icon: Coffee,
      badge: "Öğle Zamanı",
      actionText: "Öğle Yemeği Ekle",
      action: { kind: "quickAdd", mealType: "lunch" },
    };
  }
  if (hour < 19) {
    return {
      title: "İş Çıkışı & Antrenman Hazırlığı",
      time: `17:00 - ${homeTime}`,
      description: `İş çıkışı hafif karbonhidrat desteği ile antrenman için enerji topla. Eve varış hedefi: ${homeTime}.`,
      icon: Dumbbell,
      badge: "İş Çıkışı",
      actionText: "Ara Öğün Ekle",
      action: { kind: "quickAdd", mealType: "workSnack" },
    };
  }
  if (hour < 22) {
    return {
      title: "Toparlanma & Akşam Yemeği",
      time: `${homeTime} - 21:30`,
      description: "Antrenman sonrası kas onarımı için protein ağırlıklı akşam yemeğini ye ve günün kaydını tamamla.",
      icon: Utensils,
      badge: "Akşam Dinlenmesi",
      actionText: "Akşam Yemeği Ekle",
      action: { kind: "quickAdd", mealType: "dinner" },
    };
  }
  return {
    title: "Gece Kapanışı & Kaliteli Uyku",
    time: "22:00 - 07:00",
    description: "Mavi ışık maruziyetini azalt, yatak odasını serinlet ve 7.5 saatlik dinlenmeye geç.",
    icon: Moon,
    badge: "Gece Rutini",
    actionText: "Uyku & İyilik Halini Kaydet",
    action: { kind: "scrollToWellbeing" },
  };
}

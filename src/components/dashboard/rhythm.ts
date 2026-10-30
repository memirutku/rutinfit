import { Coffee, Dumbbell, Moon, Sun, Utensils, type LucideIcon } from "lucide-react";
import type { MealType } from "@/lib/schemas/enums";
import type { DayPattern } from "@/lib/schemas/profile";

/** Gece rutini adımının kaydırdığı iyilik hali bölümü. */
export const WELLBEING_SECTION_ID = "quick-wellbeing-section";

export type RhythmAction = { kind: "quickAdd"; mealType: MealType } | { kind: "scrollToWellbeing" };

export interface RhythmStep {
  title: string;
  time: string;
  description: string;
  icon: LucideIcon;
  badge: string;
  actionText: string;
  action: RhythmAction;
}

export interface RhythmOptions {
  /** B02/B06: gün düzeni. Girilmemişse iş/okul çıkışı ve eve varış varsayılmaz. */
  dayPattern?: DayPattern | null;
  /** Ofis ve okul düzeninde eve varış saati. */
  homeTime?: string;
}

/** Günün saatine göre "Sıradaki Adım" kartı. Saat dışarıdan verilir (test edilebilir). */
export function getRhythmStep(hour: number, options: RhythmOptions = {}): RhythmStep {
  const commute = options.dayPattern === "office" || options.dayPattern === "school" ? options.dayPattern : null;
  const homeTime = commute ? options.homeTime || "18:30" : null;

  if (hour < 11) {
    return {
      title: "Güne Başlangıç",
      time: "Sabah",
      description: "Güne bir bardak su ile başla. Tartıldıysan kilonu kaydet.",
      icon: Sun,
      badge: "Sabah",
      actionText: "Tartını Kaydet",
      action: { kind: "scrollToWellbeing" },
    };
  }
  if (hour < 16) {
    return {
      title: "Öğle Öğünü",
      time: "12:00 - 15:30",
      description: "Öğle öğününü kaydet; proteinin ve suyun gün içine yayılsın.",
      icon: Coffee,
      badge: "Öğle",
      actionText: "Öğle Yemeği Ekle",
      action: { kind: "quickAdd", mealType: "lunch" },
    };
  }
  if (hour < 19) {
    if (commute === "office") {
      return {
        title: "İş Çıkışı & Antrenman Hazırlığı",
        time: `17:00 - ${homeTime}`,
        description: `Antrenman öncesi hafif bir ara öğün enerji verir. Eve varış: ${homeTime}.`,
        icon: Dumbbell,
        badge: "İş Çıkışı",
        actionText: "Ara Öğün Ekle",
        action: { kind: "quickAdd", mealType: "workSnack" },
      };
    }
    if (commute === "school") {
      return {
        title: "Okul Çıkışı & Ara Öğün",
        time: `16:00 - ${homeTime}`,
        description: `Akşama kadar enerjini korumak için hafif bir ara öğün ekleyebilirsin. Eve varış: ${homeTime}.`,
        icon: Dumbbell,
        badge: "Okul Çıkışı",
        actionText: "Ara Öğün Ekle",
        action: { kind: "quickAdd", mealType: "workSnack" },
      };
    }
    return {
      title: "İkindi Ara Öğünü",
      time: "16:00 - 19:00",
      description: "Akşama kadar enerjini korumak için hafif bir ara öğün ekleyebilirsin.",
      icon: Coffee,
      badge: "İkindi",
      actionText: "Ara Öğün Ekle",
      action: { kind: "quickAdd", mealType: "workSnack" },
    };
  }
  if (hour < 22) {
    return {
      title: "Akşam Yemeği",
      time: homeTime ? `${homeTime} - 21:30` : "19:00 - 22:00",
      description: "Akşam yemeğini kaydet ve günün kaydını tamamla.",
      icon: Utensils,
      badge: "Akşam",
      actionText: "Akşam Yemeği Ekle",
      action: { kind: "quickAdd", mealType: "dinner" },
    };
  }
  return {
    title: "Gece Kapanışı & Kaliteli Uyku",
    time: "22:00 - 07:00",
    description: "Ekran ışığını azalt, odayı serin tut ve dinlenmeye geç.",
    icon: Moon,
    badge: "Gece",
    actionText: "Uyku & İyilik Halini Kaydet",
    action: { kind: "scrollToWellbeing" },
  };
}

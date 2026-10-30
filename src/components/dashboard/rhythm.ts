import { Coffee, Dumbbell, Moon, Sun, Utensils, type LucideIcon } from "lucide-react";
import type { MealType } from "@/lib/schemas/enums";
import type { DayPattern } from "@/lib/schemas/profile";
import { formatDuration } from "./FastingCard";

/** Gece rutini adımının kaydırdığı iyilik hali bölümü. */
export const WELLBEING_SECTION_ID = "quick-wellbeing-section";
/** B25: oruç adımının kaydırdığı Ramazan kartı. */
export const FASTING_SECTION_ID = "fasting-section";

export type RhythmAction = { kind: "quickAdd"; mealType: MealType } | { kind: "scrollToWellbeing" } | { kind: "scrollToFasting" };

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

/** B25: Ramazan modunda (Ramazan günlerinde) ritim kartı imsak ve iftara göre. */
export interface RamadanRhythmInput {
  phase: "sahur" | "fasting" | "evening";
  minutesLeft: number;
  today: { imsak: string; iftar: string };
  tomorrow: { imsak: string; iftar: string };
  waterAdvice: string;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function getRamadanRhythmStep(r: RamadanRhythmInput): RhythmStep {
  if (r.phase === "sahur") {
    return {
      title: "Sahur",
      time: `İmsak ${r.today.imsak}`,
      description: `İmsaka ${formatDuration(r.minutesLeft)} kaldı. Protein ve lif tok tutar; suyu sahura bırakma, akşamdan yay.`,
      icon: Moon,
      badge: "Ramazan",
      actionText: "Sahur Ekle",
      action: { kind: "quickAdd", mealType: "breakfast" },
    };
  }
  if (r.phase === "fasting") {
    return {
      title: "Oruç",
      time: `${r.today.imsak} - ${r.today.iftar}`,
      description: `İftara ${formatDuration(r.minutesLeft)} kaldı. Oruç saatlerinde yemek ve su önerisi yok.`,
      icon: Moon,
      badge: "Ramazan",
      actionText: "Vakitleri Gör",
      action: { kind: "scrollToFasting" },
    };
  }
  const nowMin = 1440 + toMin(r.tomorrow.imsak) - r.minutesLeft;
  if (nowMin - toMin(r.today.iftar) <= 150) {
    return {
      title: "İftar",
      time: `${r.today.iftar} sonrası`,
      description: "İftarı hafif başlat (su, çorba), sonra ana yemeğe geç. Kaydını eklemeyi unutma.",
      icon: Utensils,
      badge: "Ramazan",
      actionText: "İftar Ekle",
      action: { kind: "quickAdd", mealType: "dinner" },
    };
  }
  return {
    title: "Gece: Su ve Dinlenme",
    time: `Sahura ${formatDuration(r.minutesLeft)}`,
    description: r.waterAdvice,
    icon: Moon,
    badge: "Ramazan",
    actionText: "Uykunu Kaydet",
    action: { kind: "scrollToWellbeing" },
  };
}

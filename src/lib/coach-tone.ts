/** F58: Koçun üslubu. Sistem isteminin üslup cümlesi buradan gelir. */
export const COACH_TONES = {
  supportive: {
    label: "Destekleyici",
    prompt: "Tonun sakin, destekleyici, gerçekçi ve asla suçlayıcı değildir.",
  },
  direct: {
    label: "Doğrudan",
    prompt: "Kısa, net ve doğrudan konuşursun; gereksiz övgü ve dolgu cümlesi kullanmazsın. Asla suçlayıcı değilsin.",
  },
  brief: {
    label: "Çok kısa",
    prompt: "Yanıtların en fazla 3 cümle olur; yalnız en önemli bilgiyi verirsin. Asla suçlayıcı değilsin.",
  },
} as const;

export type CoachTone = keyof typeof COACH_TONES;
export const COACH_TONE_KEYS = Object.keys(COACH_TONES) as [CoachTone, ...CoachTone[]];

export function tonePrompt(tone: string | null | undefined): string {
  return (COACH_TONES[tone as CoachTone] ?? COACH_TONES.supportive).prompt;
}

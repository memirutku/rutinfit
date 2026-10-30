/**
 * B39: AI koçunun modele gönderdiği verinin tek listesi. Yerel model de OpenAI da aynı istemi
 * alır; fark yalnız verinin nereye gittiğidir. Liste koç isteminin (coach-context.ts) ve
 * haftalık değerlendirme özetinin (weekly-checkin.ts) içeriğine göre yazılmıştır; bunlar
 * değişirse burası da güncellenir. Adet döngüsü notu modele gönderilmez.
 */
export const COACH_DATA_ITEMS = [
  "mesajların ve bu sohbetin önceki mesajları",
  "profil özetin (boy, yaş, kilo, kalori ve makro hedeflerin)",
  "koça notların",
  "bugünkü öğün toplamların, enerji ve uyku durumun",
  "bugünkü antrenman planın ve openGym bağlantı durumu",
  "geçmiş sorularına kayıtlarından hesaplanan sonuçlar",
  "haftalık değerlendirme sayıların",
  "eklediğin dosyaların içeriği",
] as const;

/** "a, b ve c" biçiminde, cümle başı büyük harfli metin. */
export function coachDataText(): string {
  const items = [...COACH_DATA_ITEMS];
  const last = items.pop()!;
  const text = `${items.join(", ")} ve ${last}`;
  return text.charAt(0).toLocaleUpperCase("tr-TR") + text.slice(1);
}

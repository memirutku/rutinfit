/**
 * F02: Gıda arama ve sıralama (bellek içi; katalog birkaç yüz kayıttır).
 * Puan = eşleşme kalitesi + kullanım sıklığı + yakınlık + kaynak güvenilirliği.
 * Türkçe karakter yazmadan arama yapılabilir ("sut" → "Süt"); iyelik eki gibi küçük
 * farklara tolerans vardır ("göğüs" → "Göğsü").
 */
import { compareTr } from "./text";

const FOLD: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** Türkçe küçük harf + aksan katlama: "Şeker ÇİLEK" → "seker cilek". */
export function foldTr(value: string | null | undefined): string {
  return (value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[çğıöşüâîû]/g, (c) => FOLD[c] ?? c)
    .replace(/\s+/g, " ")
    .trim();
}

const words = (s: string) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

export interface FoodUsage {
  count: number;
  /** Son kullanım günü (YYYY-MM-DD). */
  lastDate: string | null;
}

export interface RankableFood {
  id: string;
  name: string;
  brand?: string | null;
  confidence?: string | null;
}

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

/** Sorgu metinde bütün kelime(ler) olarak geçiyor mu ("zeytin" → "siyah zeytin" evet, "zeytinyağı" hayır)? */
function hasWholeWord(hay: string, query: string): boolean {
  for (let i = hay.indexOf(query); i !== -1; i = hay.indexOf(query, i + 1)) {
    if (!isWordChar(hay[i - 1]) && !isWordChar(hay[i + query.length])) return true;
  }
  return false;
}

function matchScore(query: string, name: string, brand: string): number {
  const hay = brand ? `${name} ${brand}` : name;
  const hayWords = words(hay);
  let score: number;
  // B10: bütün kelime eşleşmesi daha uzun bir kelimenin önekinden önce gelir ("5 zeytin"
  // Zeytinyağı'na değil zeytine eşlenir); ad birebir aynıysa küçük bir öncelik daha alır.
  if (name.startsWith(query) && !isWordChar(name[query.length])) score = name === query ? 125 : 120;
  else if (hasWholeWord(hay, query)) score = 110;
  else if (name.startsWith(query)) score = 100;
  else if (hayWords.some((w) => w.startsWith(query))) score = 80;
  else if (hay.includes(query)) score = 50;
  else {
    // Çok kelimeli arama: her kelime geçmeli (tam ya da ek toleranslı kelime başı).
    let total = 0;
    for (const q of words(query)) {
      if (hay.includes(q)) total += 2;
      else if (q.length >= 4 && hayWords.some((w) => w.startsWith(q.slice(0, Math.max(3, q.length - 2))))) total += 1;
      else return 0;
    }
    score = 20 + total * 5;
  }
  return score;
}

function usageScore(usage: FoodUsage | undefined, today: string | undefined): number {
  if (!usage) return 0;
  let score = Math.min(30, usage.count * 3);
  if (usage.lastDate && today) {
    const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${usage.lastDate}T00:00:00Z`)) / 86_400_000;
    if (days <= 7) score += 20;
    else if (days <= 30) score += 10;
  }
  return score;
}

const CONFIDENCE_SCORE: Record<string, number> = { Yüksek: 10, Kullanıcı: 5 };

/**
 * Sorguya uyan gıdaları puana göre sıralar. Boş sorguda hepsi döner: önce kullanım, sonra
 * Türk alfabesi.
 */
export function rankFoods<T extends RankableFood>(
  foods: T[],
  query: string,
  usage: Map<string, FoodUsage> = new Map(),
  today?: string
): T[] {
  const q = foldTr(query);
  return foods
    .map((f) => {
      const match = q ? matchScore(q, foldTr(f.name), foldTr(f.brand)) : 1;
      return { f, match, total: match + usageScore(usage.get(f.id), today) + (CONFIDENCE_SCORE[f.confidence ?? ""] ?? 0) };
    })
    .filter((r) => r.match > 0)
    .sort((a, b) => b.total - a.total || compareTr(a.f.name, b.f.name))
    .map((r) => r.f);
}

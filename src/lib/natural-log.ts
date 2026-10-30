/**
 * F06: Doğal dille yazılan öğünü ayrıştırır ("1 kase mercimek çorbası, 2 dilim ekmek").
 * Kurallı ayrıştırıcıdır: miktar (rakam ya da "yarım", "bir buçuk"...), birim (ev ölçüleri ve
 * gram) ve besin metni. Eşleme ve sayılar katalogdan gelir (bkz. services/natural-log).
 */
import { foldTr } from "./food-search";

export interface ParsedFood {
  quantity: number;
  /** MEASURE_NAMES'ten biri, "gram" ya da birim yazılmadıysa null. */
  unit: string | null;
  food: string;
}

/** Katlanmış (Türkçe karaktersiz) yazımlar → birim. Uzun olan önce denenir. */
const UNIT_SYNONYMS: Array<[string, string]> = [
  ["su bardagi", "su bardağı"],
  ["cay bardagi", "çay bardağı"],
  ["yemek kasigi", "yemek kaşığı"],
  ["tatli kasigi", "tatlı kaşığı"],
  ["cay kasigi", "çay kaşığı"],
  ["bardak", "su bardağı"],
  ["kasik", "yemek kaşığı"],
  ["kase", "kase"],
  ["kepce", "kepçe"],
  ["dilim", "dilim"],
  ["adet", "adet"],
  ["tane", "adet"],
  ["avuc", "avuç"],
  ["porsiyon", "porsiyon"],
  ["tabak", "porsiyon"],
  ["kutu", "kutu"],
  ["kup", "küp"],
  ["gram", "gram"],
  ["gr", "gram"],
  ["g", "gram"],
  ["ml", "gram"],
];

const NUMBER_WORDS: Record<string, number> = {
  ceyrek: 0.25,
  yarim: 0.5,
  bir: 1,
  iki: 2,
  uc: 3,
  dort: 4,
  bes: 5,
  alti: 6,
  yedi: 7,
  sekiz: 8,
  dokuz: 9,
  on: 10,
};

export function splitFoodText(text: string): string[] {
  return text
    .split(/\n|,(?!\d)|\+|;|\s+ve\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Baştaki miktarı okur; okuduğu kelime sayısını da döner. */
function readQuantity(words: string[]): { quantity: number; used: number } | null {
  const first = words[0];
  if (first === undefined) return null;
  const numeric = /^(\d+(?:[.,]\d+)?)([a-zçğıöşü]*)$/i.exec(first);
  if (numeric) {
    const value = Number(numeric[1].replace(",", "."));
    // "150g" gibi bitişik birim: kelimeyi ikiye böl.
    if (numeric[2]) words.splice(0, 1, numeric[1], numeric[2]);
    return { quantity: value, used: 1 };
  }
  const f = foldTr(first);
  if (f in NUMBER_WORDS) {
    let quantity = NUMBER_WORDS[f];
    let used = 1;
    if (foldTr(words[1]) === "bucuk") {
      quantity += 0.5;
      used = 2;
    }
    return { quantity, used };
  }
  return null;
}

/** Sözcük dizisinin başındaki birimi okur. */
function readUnit(words: string[]): { unit: string; used: number } | null {
  const folded = words.map((w) => foldTr(w));
  for (const [syn, unit] of UNIT_SYNONYMS) {
    const parts = syn.split(" ");
    if (parts.every((p, i) => folded[i] === p)) return { unit, used: parts.length };
  }
  return null;
}

export function parseFoodText(text: string): ParsedFood {
  const words = text.trim().split(/\s+/);
  const q = readQuantity(words);
  if (q) {
    const rest = words.slice(q.used);
    const u = readUnit(rest);
    const food = (u ? rest.slice(u.used) : rest).join(" ");
    return { quantity: q.quantity, unit: u?.unit ?? null, food };
  }
  // "tavuk göğsü 200 gr": miktar sonda.
  const tail = /^(.*\S)\s+(\d+(?:[.,]\d+)?)\s*([a-zçğıöşü ]*)$/i.exec(text.trim());
  if (tail) {
    const u = tail[3] ? readUnit(tail[3].trim().split(/\s+/)) : null;
    if (!tail[3] || u) return { quantity: Number(tail[2].replace(",", ".")), unit: u?.unit ?? null, food: tail[1] };
  }
  return { quantity: 1, unit: null, food: text.trim() };
}

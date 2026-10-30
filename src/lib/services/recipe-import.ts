/**
 * F33: Tarif adresinden içe aktarma. Sayfa güvenli biçimde getirilir (SSRF denetimi, en çok 3
 * yönlendirme, 2 MB, 8 sn), schema.org Recipe okunur, malzemeler Türkçe ölçülerle grama çevrilip
 * katalogla eşlenir. Kullanıcı önizlemede onaylar; tarif ancak o zaman kaydedilir.
 */
import { prisma } from "../prisma";
import { HttpError } from "../api-error";
import { rankFoods } from "../food-search";
import { builtinMeasuresFor, mergeMeasures } from "../measures";
import { parseFoodText } from "../natural-log";
import { extractRecipeFromHtml, type RecipeDraft } from "../recipe-jsonld";
import { assertPublicUrl } from "../security/url-safety";
import type { MatchRef } from "./natural-log";

const MAX_BYTES = 2 * 1024 * 1024;
const QUANTITY_START = /^\s*(\d|çeyrek|yarım|bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on)\b/i;

export interface IngredientPreview {
  raw: string;
  match: MatchRef | null;
  alternatives: MatchRef[];
  grams: number | null;
  note?: string;
}

export type RecipePreview = Awaited<ReturnType<typeof previewRecipe>>;

export async function previewRecipe(draft: RecipeDraft, sourceUrl: string) {
  const foods = await prisma.foodItem.findMany({ include: { measures: true } });
  const candidates = foods.map((f) => ({ id: f.id, name: f.name, brand: f.brand, confidence: f.confidence }));
  const ingredients: IngredientPreview[] = draft.ingredients.map((raw) => {
    if (!QUANTITY_START.test(raw)) return { raw, match: null, alternatives: [], grams: null, note: "Miktar yok (tuz, baharat gibi); eklenmeyecek." };
    const parsed = parseFoodText(raw);
    const ranked = rankFoods(candidates, parsed.food);
    const refs = ranked.slice(0, 4).map((c) => ({ type: "food" as const, id: c.id, name: c.name }));
    if (!ranked.length) return { raw, match: null, alternatives: [], grams: null, note: `"${parsed.food}" katalogda bulunamadı.` };
    const food = foods.find((f) => f.id === ranked[0].id)!;
    const measures = mergeMeasures(builtinMeasuresFor(food.name), food.measures);
    const unit = parsed.unit ?? (measures.some((m) => m.name === "adet") ? "adet" : null);
    const measure = unit && unit !== "gram" ? measures.find((m) => m.name === unit) : undefined;
    const grams = unit === "gram" ? parsed.quantity : measure ? parsed.quantity * measure.grams : null;
    return {
      raw,
      match: refs[0],
      alternatives: refs.slice(1),
      grams: grams === null ? null : Math.round(grams * 10) / 10,
      note: grams === null ? `"${parsed.unit ?? "birim"}" için gram bilinmiyor; gramı sen gir.` : undefined,
    };
  });
  return { ...draft, sourceUrl, ingredients };
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new HttpError("Sayfa çok büyük.", 422);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Sayfayı her yönlendirmede adresi yeniden denetleyerek getirir. */
export async function fetchRecipePage(raw: string, deps: { fetchImpl?: FetchImpl; lookup?: Parameters<typeof assertPublicUrl>[1] } = {}): Promise<string> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  let url = await assertPublicUrl(raw, deps.lookup);
  for (let hop = 0; hop < 4; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetchImpl(url.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "text/html", "User-Agent": "RutinFit/1.0 (tarif içe aktarma)" },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString(), deps.lookup);
        continue;
      }
      if (!res.ok) throw new HttpError(`Sayfa açılamadı (${res.status}).`, 422);
      return await readLimited(res);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError("Sayfaya ulaşılamadı.", 422);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new HttpError("Çok fazla yönlendirme.", 422);
}

export async function importRecipeFromUrl(raw: string) {
  const html = await fetchRecipePage(raw);
  const draft = extractRecipeFromHtml(html);
  if (!draft) throw new HttpError("Bu sayfada okunabilir tarif bilgisi (schema.org Recipe) bulunamadı.", 422);
  return previewRecipe(draft, raw);
}

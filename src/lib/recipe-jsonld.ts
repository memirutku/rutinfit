/** F33: Sayfadaki schema.org Recipe (JSON-LD) verisini okur. */
export interface RecipeDraft {
  name: string;
  servings: number;
  prepMinutes: number;
  ingredients: string[];
  instructions: string;
}

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "PT1H15M" → 75. */
export function parseIsoMinutes(value: unknown): number | null {
  const m = /^P(?:T)?(?:(\d+)H)?(?:(\d+)M)?$/i.exec(String(value ?? "").trim());
  if (!m || (!m[1] && !m[2])) return null;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}

/** "4 kişilik", ["6", "6 kişilik"], 8 → sayı; okunamazsa 1. */
export function parseServings(value: unknown): number {
  const first = Array.isArray(value) ? value[0] : value;
  const n = parseInt(String(first ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 1;
}

const isRecipe = (node: any) => {
  const t = node?.["@type"];
  return Array.isArray(t) ? t.includes("Recipe") : t === "Recipe";
};

function findRecipe(data: unknown): any {
  const queue = [data];
  while (queue.length) {
    const node: any = queue.shift();
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    if (isRecipe(node)) return node;
    if (node["@graph"]) queue.push(node["@graph"]);
  }
  return null;
}

function instructionsText(value: unknown): string {
  if (typeof value === "string") return decode(value);
  const steps: string[] = [];
  const walk = (v: any) => {
    if (!v) return;
    if (typeof v === "string") steps.push(decode(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v.itemListElement) walk(v.itemListElement);
    else if (v.text) steps.push(decode(String(v.text)));
  };
  walk(value);
  return steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

export function extractRecipeFromHtml(html: string): RecipeDraft | null {
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const r = findRecipe(data);
    if (!r?.name) continue;
    const ingredients = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : Array.isArray(r.ingredients) ? r.ingredients : [])
      .map((x: unknown) => decode(String(x)))
      .filter(Boolean);
    return {
      name: decode(String(r.name)),
      servings: parseServings(r.recipeYield),
      prepMinutes:
        parseIsoMinutes(r.totalTime) ?? ((parseIsoMinutes(r.prepTime) ?? 0) + (parseIsoMinutes(r.cookTime) ?? 0) || 30),
      ingredients,
      instructions: instructionsText(r.recipeInstructions),
    };
  }
  return null;
}

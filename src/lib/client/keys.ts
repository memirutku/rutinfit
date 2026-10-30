let counter = 0;

/** İstemcide oluşturulan satırlar için kararlı, benzersiz anahtar (sunucu kimliği olmayan öğeler). */
export function clientId(prefix = "c"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/**
 * Kimliği olmayan değişmez listeler için içerikten React anahtarı üretir. Aynı içerik
 * tekrar ederse sıra numarası eklenir ("Yulaf", "Yulaf#2"); dizin tek başına anahtar olmaz.
 */
export function keyedBy<T>(items: readonly T[], keyOf: (item: T) => string): Array<{ key: string; item: T }> {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = keyOf(item);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { key: n === 1 ? base : `${base}#${n}`, item };
  });
}

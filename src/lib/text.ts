/** Türkçe duyarlı metin yardımcıları (İ/ı, I/i doğru eşlenir). */

/** Karşılaştırma anahtarı: kırpılmış, Türkçe küçük harf, tek boşluk. */
export function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

/** Türkçe büyük/küçük harf duyarsız "içerir" araması. */
export function includesTr(haystack: string | null | undefined, needle: string | null | undefined): boolean {
  return normalizeName(haystack).includes(normalizeName(needle));
}

/** Metni kelimelere ayırır (harf/rakam dışı her şey ayraçtır). */
export function wordsTr(value: string | null | undefined): string[] {
  return normalizeName(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

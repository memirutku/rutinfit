"use client";

/**
 * B36/B38: metni panoya kopyalar. Önce Clipboard API; yoksa ya da reddedilirse (WKWebView'de izin,
 * güvenli olmayan bağlam) gizli metin alanı + `execCommand("copy")`. Başarısızsa false.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Eski yönteme düş.
  }
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

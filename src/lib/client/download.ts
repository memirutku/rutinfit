"use client";

/**
 * Sayfayı dosya adresine götürmek masaüstü görünümünde (WKWebView) dosyayı indirmek yerine
 * içeriği pencerede açıyordu ve geri dönüş yolu yoktu. Dosya blob olarak indirilir; sunucu bir
 * kopyasını uygulama klasörüne yazdıysa yolu başlıkta döner.
 */
export async function downloadFile(endpoint: string, fallbackName: string, pathHeader: string): Promise<{ name: string; savedPath: string | null }> {
  const res = await fetch(endpoint);
  if (!res.ok) {
    const data: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(data.error || "Dışa aktarılamadı");
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const savedPath = res.headers.get(pathHeader);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // WebKit indirmeyi başlatmadan adres iptal edilirse indirme düşer; kısa gecikmeyle bırakılır.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { name, savedPath: savedPath ? decodeURIComponent(savedPath) : null };
}

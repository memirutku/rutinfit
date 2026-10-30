import { minimalPdf } from "../scripts/lib/minimal-pdf.cjs";
import { test, expect, uniq } from "./fixtures";

test.describe("Dosya yükleme (paketli sunucu)", () => {
  // pdf-parse, `@napi-rs/canvas`'ı ve `pdf.worker.mjs`'i çalışma anında dinamik yükler. Dosya
  // izleyici onları standalone'a katmazsa birim testleri (düz Node) geçer ama paketli sunucu
  // PDF'den metin çıkaramaz ("DOMMatrix is not defined"). Bkz. next.config.mjs.
  test("PDF'ten metin çıkarılır", async ({ api }) => {
    const text = uniq("Kahvalti: yulaf 80 g, sut 200 ml");
    const res = await api.post("/api/files/upload", {
      multipart: { file: { name: "ogun-plani.pdf", mimeType: "application/pdf", buffer: minimalPdf(text) } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Ayrıştırma hatası burada görünür (ör. "PDF ayrıştırma sırasında hata oluştu: ...").
    expect(body.artifact.uncertainties.filter((u: string) => u.includes("PDF"))).toEqual([]);
    expect(body.artifact.structuredData.text).toContain(text);
    expect(body.sanitizedContent).toContain(text);
  });
});

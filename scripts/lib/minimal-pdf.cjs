/**
 * Tek sayfalık, tek satır metinli en küçük geçerli PDF (gömülü yazı tipi yok, Helvetica).
 * PDF'den metin çıkarmanın gerçekten çalıştığını sınamak için: birim testi, e2e testi ve
 * scripts/prepare-desktop.mjs (paketteki pdf-parse gömülü Node ile denenir).
 *
 * Yalnız yazdırılabilir ASCII: standart yazı tipinin kodlaması Türkçe harfleri kapsamaz.
 *
 * @param {string} text
 * @returns {Buffer}
 */
function minimalPdf(text) {
  if (!/^[\x20-\x7e]*$/.test(text)) throw new Error("minimalPdf yalnız yazdırılabilir ASCII metin kabul eder.");
  const stream = `BT /F1 12 Tf 50 780 Td (${text.replace(/[\\()]/g, "\\$&")}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const offset = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

module.exports = { minimalPdf };

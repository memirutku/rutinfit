import { classifyContent } from './heuristics';
import { sanitizeExtractedText } from './sanitizer';
import { ParseFileInput, ParsedFileResult } from './types';

export async function parsePdfFile(input: ParseFileInput): Promise<ParsedFileResult> {
  const { buffer, originalName, mimeType } = input;
  let rawText = '';
  let pageCount = 1;
  const uncertainties: string[] = [];

  try {
    // Dynamic require or import of pdf-parse to handle CJS/ESM compatibility
    // eslint-disable-next-line
    const pdfParseModule = require('pdf-parse');
    const PDFParse = pdfParseModule.PDFParse || pdfParseModule.default?.PDFParse || pdfParseModule;

    if (typeof PDFParse === 'function') {
      const parser = new PDFParse({ data: buffer });
      await parser.load();
      const extracted = await parser.getText();
      rawText = typeof extracted === 'string' ? extracted : extracted?.text || '';
      pageCount = extracted?.total || 1;
      await parser.destroy();
    } else {
      throw new Error('PDFParse sınıfı yüklenemedi');
    }
  } catch (err: any) {
    uncertainties.push(`PDF ayrıştırma sırasında hata oluştu: ${err?.message || 'Bilinmeyen hata'}`);
    rawText = '';
  }

  const { sanitizedContent, securityWarnings } = sanitizeExtractedText(
    rawText,
    originalName,
    mimeType
  );

  const analysis = classifyContent(rawText);
  const allUncertainties = [...analysis.uncertainties, ...uncertainties, ...securityWarnings];

  if (!rawText.trim()) {
    allUncertainties.push('PDF dosyasından okunabilir metin çıkarılamadı (taranmış görsel PDF olabilir).');
  }

  return {
    rawText,
    sanitizedContent,
    normalizedType: analysis.normalizedType,
    structuredData: {
      pageCount,
      textLength: rawText.length,
      // Modelin PDF'i gerçekten okuyabilmesi için metin (üst sınırlı) saklanır.
      text: rawText.slice(0, 50_000),
    },
    confidence: rawText.trim() ? analysis.confidence : 'low',
    uncertainties: allUncertainties,
    sourceSummary: `PDF Belgesi (${pageCount} sayfa, ${rawText.trim().length} karakter)`,
    metadata: {
      pageCount,
      wordCount: rawText.split(/\s+/).filter(Boolean).length,
      format: 'pdf',
    },
  };
}

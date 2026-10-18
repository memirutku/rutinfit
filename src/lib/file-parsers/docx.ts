import mammoth from 'mammoth';
import { classifyContent } from './heuristics';
import { sanitizeExtractedText } from './sanitizer';
import { ParseFileInput, ParsedFileResult } from './types';

export async function parseDocxFile(input: ParseFileInput): Promise<ParsedFileResult> {
  const { buffer, originalName, mimeType } = input;
  const extraction = await mammoth.extractRawText({ buffer });
  const rawText = extraction.value || '';

  const { sanitizedContent, securityWarnings } = sanitizeExtractedText(
    rawText,
    originalName,
    mimeType
  );

  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const analysis = classifyContent(rawText);

  const uncertainties = [...analysis.uncertainties, ...securityWarnings];
  if (extraction.messages && extraction.messages.length > 0) {
    for (const msg of extraction.messages) {
      if (msg.type === 'warning') {
        uncertainties.push(`DOCX uyarısı: ${msg.message}`);
      }
    }
  }

  return {
    rawText,
    sanitizedContent,
    normalizedType: analysis.normalizedType,
    structuredData: {
      paragraphs: lines,
      lineCount: lines.length,
    },
    confidence: analysis.confidence,
    uncertainties,
    sourceSummary: `Word Belgesi (${lines.length} paragraf/satır)`,
    metadata: {
      wordCount: rawText.split(/\s+/).filter(Boolean).length,
      format: 'docx',
    },
  };
}

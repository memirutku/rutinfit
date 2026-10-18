import { classifyContent } from './heuristics';
import { sanitizeExtractedText } from './sanitizer';
import { ParseFileInput, ParsedFileResult } from './types';

export function parseTextFile(input: ParseFileInput): ParsedFileResult {
  const { buffer, originalName, mimeType } = input;
  const rawText = buffer.toString('utf-8');
  let structuredData: Record<string, any> = {};
  let parsedJson: any = null;

  if (originalName.endsWith('.json') || mimeType.includes('json')) {
    try {
      parsedJson = JSON.parse(rawText);
      structuredData = { jsonContent: parsedJson };
    } catch {
      structuredData = { rawText, jsonParseError: 'Geçersiz JSON formatı' };
    }
  } else {
    // Split into non-empty lines
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
    structuredData = { lines, lineCount: lines.length };
  }

  const { sanitizedContent, securityWarnings } = sanitizeExtractedText(
    rawText,
    originalName,
    mimeType
  );

  const tableData = Array.isArray(parsedJson) ? parsedJson : undefined;
  const analysis = classifyContent(rawText, tableData);

  const uncertainties = [...analysis.uncertainties, ...securityWarnings];

  return {
    rawText,
    sanitizedContent,
    normalizedType: analysis.normalizedType,
    structuredData: parsedJson ? { json: parsedJson } : structuredData,
    confidence: analysis.confidence,
    uncertainties,
    sourceSummary: analysis.sourceSummary,
    metadata: {
      wordCount: rawText.split(/\s+/).filter(Boolean).length,
      format: originalName.endsWith('.json') ? 'json' : originalName.endsWith('.md') ? 'markdown' : 'text',
    },
  };
}

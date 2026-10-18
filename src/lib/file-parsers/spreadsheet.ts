import * as XLSX from 'xlsx';
import { classifyContent } from './heuristics';
import { sanitizeExtractedText } from './sanitizer';
import { ParseFileInput, ParsedFileResult } from './types';

export function parseSpreadsheetFile(input: ParseFileInput): ParsedFileResult {
  const { buffer, originalName, mimeType } = input;
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const sheetNames = workbook.SheetNames;
  const allTables: Record<string, Array<Record<string, any>>> = {};
  const textChunks: string[] = [];
  let totalRows = 0;

  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    allTables[sheetName] = rows;
    totalRows += rows.length;

    const csvText = XLSX.utils.sheet_to_csv(worksheet);
    textChunks.push(`### Sayfa: ${sheetName}\n${csvText.trim()}`);
  }

  const rawText = textChunks.join('\n\n');
  const { sanitizedContent, securityWarnings } = sanitizeExtractedText(
    rawText,
    originalName,
    mimeType
  );

  const primarySheetRows = sheetNames.length > 0 ? allTables[sheetNames[0]] : [];
  const analysis = classifyContent(rawText, primarySheetRows);

  const uncertainties = [...analysis.uncertainties, ...securityWarnings];
  if (totalRows === 0) {
    uncertainties.push('Tabloda hiç satır bulunamadı veya boş sayfa.');
  }

  return {
    rawText,
    sanitizedContent,
    normalizedType: analysis.normalizedType,
    structuredData: {
      sheets: allTables,
      sheetNames,
      totalRows,
    },
    confidence: analysis.confidence,
    uncertainties,
    sourceSummary: `${analysis.sourceSummary} (${sheetNames.length} sayfa, ${totalRows} satır)`,
    metadata: {
      sheetNames,
      rowCount: totalRows,
      format: originalName.endsWith('.csv') ? 'csv' : 'excel',
    },
  };
}

import crypto from 'crypto';
import { parseDocxFile } from './docx';
import { parseImageFile } from './image';
import { parsePdfFile } from './pdf';
import { parseSpreadsheetFile } from './spreadsheet';
import { parseTextFile } from './text';
import { ParseFileInput, ParsedFileResult } from './types';
import { formatDecimalTr } from "../format";

export * from './types';
export * from './sanitizer';
export * from './heuristics';

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function validateMagicBytes(buffer: Buffer, originalName: string, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  const ext = originalName.split('.').pop()?.toLowerCase() || '';

  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (ext === 'pdf' || mimeType.includes('pdf')) {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  // ZIP based formats: .xlsx, .docx (PK.. 0x50 0x4B 0x03 0x04)
  if (ext === 'xlsx' || ext === 'docx') {
    return buffer[0] === 0x50 && buffer[1] === 0x4b;
  }

  // PNG: 0x89 0x50 0x4E 0x47
  if (ext === 'png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }

  // JPEG: 0xFF 0xD8 0xFF
  if (ext === 'jpg' || ext === 'jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // Text formats (.txt, .md, .csv, .json) do not have fixed magic bytes, accept them
  return true;
}

export async function parseFile(input: ParseFileInput): Promise<
  ParsedFileResult & {
    hash: string;
    sizeBytes: number;
    isValidSignature: boolean;
  }
> {
  const { buffer, originalName, mimeType } = input;
  const sizeBytes = buffer.length;

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Dosya boyutu (${formatDecimalTr(sizeBytes / (1024 * 1024), 1)} MB) izin verilen 20 MB sınırını aşıyor.`);
  }

  const hash = computeFileHash(buffer);
  const isValidSignature = validateMagicBytes(buffer, originalName, mimeType);

  const ext = originalName.split('.').pop()?.toLowerCase() || '';
  let result: ParsedFileResult;

  if (ext === 'pdf' || mimeType.includes('pdf')) {
    result = await parsePdfFile(input);
  } else if (['xlsx', 'xls', 'csv'].includes(ext) || mimeType.includes('spreadsheet') || mimeType.includes('csv')) {
    result = parseSpreadsheetFile(input);
  } else if (ext === 'docx' || mimeType.includes('wordprocessingml')) {
    result = await parseDocxFile(input);
  } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext) || mimeType.startsWith('image/')) {
    result = parseImageFile(input);
  } else {
    // Defaults to text / markdown / json
    result = parseTextFile(input);
  }

  if (!isValidSignature) {
    result.uncertainties.push(
      'Dosya uzantısı ile dosya ikili imza baytları (magic bytes) uyuşmuyor; dosya içeriği yanıltıcı olabilir.'
    );
    result.confidence = 'low';
  }

  return {
    ...result,
    hash,
    sizeBytes,
    isValidSignature,
  };
}

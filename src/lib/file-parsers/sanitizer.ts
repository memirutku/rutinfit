/**
 * Prompt injection defense and content sanitizer.
 * Wraps file extracted text in explicit untrusted delimiters
 * and flags adversarial injection attempts.
 */

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior)\s+instructions/i,
  /you\s+are\s+now\s+(an?\s+)?unrestricted/i,
  /system\s*prompt\s*override/i,
  /drop\s+table/i,
  /delete\s+from\s+[a-z_]+/i,
  /<script[\s\S]*?>[\s\S]*?<\/script>/i,
  /eval\s*\(/i,
  /rm\s+-rf/i,
];

export function sanitizeExtractedText(
  rawText: string,
  filename: string,
  mimeType: string
): { sanitizedContent: string; securityWarnings: string[] } {
  // Strip null bytes and non-printable control characters (except newline, tab, cr)
  const cleanedText = rawText
    .replace(/\0/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  const securityWarnings: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleanedText)) {
      securityWarnings.push(
        `Güvenlik Uyarısı: Dosya içeriğinde şüpheli yönlendirici veya komut benzeri ifade tespit edildi (${pattern.source}). Bu içerik pasifize edildi.`
      );
    }
  }

  // Wrap in untrusted content boundary
  const safeFilename = filename.replace(/[<>"']/g, '_');
  const safeMime = mimeType.replace(/[<>"']/g, '_');

  const sanitizedContent = [
    `<untrusted_content filename="${safeFilename}" mime_type="${safeMime}">`,
    cleanedText.trim(),
    `</untrusted_content>`,
  ].join('\n');

  return {
    sanitizedContent,
    securityWarnings,
  };
}

/** Modele gönderilen tek dosya içeriği üst sınırı (karakter). */
export const MAX_PROMPT_FILE_CHARS = 12_000;

function escapeAttribute(value: string): string {
  return value.replace(/[<>"'&\r\n]/g, "_").slice(0, 200);
}

/**
 * İçerikteki sınır etiketlerini etkisizleştirir: dosya, </untrusted_content> yazarak
 * güvensiz bölgeden çıkıp talimat enjekte edemez.
 */
export function neutralizeBoundaryTags(content: string): string {
  return content.replace(/<\s*(\/?)\s*untrusted_content/gi, (_m, slash) => `[${slash}untrusted-content`);
}

export interface UntrustedFileBlockInput {
  originalName: string;
  mimeType: string;
  content: string;
  maxChars?: number;
}

/** Dosya içeriğini kaçışlanmış, boyutu sınırlanmış bir <untrusted_content> bloğuna sarar. */
export function buildUntrustedFileBlock(input: UntrustedFileBlockInput): string {
  const maxChars = input.maxChars ?? MAX_PROMPT_FILE_CHARS;
  const cleaned = neutralizeBoundaryTags(
    input.content.replace(/\0/g, "").replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
  );
  const truncated =
    cleaned.length > maxChars
      ? `${cleaned.slice(0, maxChars)}\n[... içerik ${cleaned.length - maxChars} karakter kısaltıldı ...]`
      : cleaned;

  return [
    `<untrusted_content filename="${escapeAttribute(input.originalName)}" mime_type="${escapeAttribute(input.mimeType)}">`,
    truncated,
    `</untrusted_content>`,
  ].join("\n");
}

/** Ayrıştırıcı çıktısından modele verilecek en anlamlı metni seçer (PDF/DOCX metni, tablo JSON'u...). */
export function artifactPromptText(structuredData: string): string {
  try {
    const data = JSON.parse(structuredData);
    if (data && typeof data.text === "string") return data.text;
    if (Array.isArray(data?.paragraphs)) return data.paragraphs.join("\n");
    if (Array.isArray(data?.lines)) return data.lines.join("\n");
    return JSON.stringify(data);
  } catch {
    return structuredData;
  }
}

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

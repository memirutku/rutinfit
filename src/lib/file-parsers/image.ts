import { sanitizeExtractedText } from './sanitizer';
import { ParseFileInput, ParsedFileResult } from './types';

export function parseImageFile(input: ParseFileInput): ParsedFileResult {
  const { originalName, mimeType, aiModelName = 'Yerel Model', hasVisionSupport = false } = input;

  let rawText = '';
  const uncertainties: string[] = [];

  if (!hasVisionSupport) {
    rawText = `[Görsel Ayrıştırma Bildirimi]: Mevcut yapay zeka modeliniz (${aiModelName}) doğrudan görsel işleme (vision) yeteneğine sahip değildir. Görseldeki diyet/antrenman verilerini işleyebilmemiz için lütfen içeriği metin, PDF veya Excel (.xlsx/.csv) olarak yükleyin veya sohbete yazarak paylaşın.`;
    uncertainties.push(
      `Model Vision Desteği Yok: ${aiModelName} modeli ile doğrudan görsel içerik okunamadı. Kullanıcı doğrulaması veya alternatif format gerekiyor.`
    );
  } else {
    rawText = `[Görsel Analizi]: ${originalName} görseli incelenmek üzere hazırlandı.`;
  }

  const { sanitizedContent, securityWarnings } = sanitizeExtractedText(
    rawText,
    originalName,
    mimeType
  );

  return {
    rawText,
    sanitizedContent,
    normalizedType: 'unstructured',
    structuredData: {
      isImage: true,
      hasVisionSupport,
      modelName: aiModelName,
      imageName: originalName,
    },
    confidence: 'low',
    uncertainties: [...uncertainties, ...securityWarnings],
    sourceSummary: `Görsel Dosyası (${originalName} - ${mimeType})`,
    metadata: {
      format: 'image',
    },
  };
}

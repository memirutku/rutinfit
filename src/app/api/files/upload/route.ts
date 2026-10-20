import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { getStoragePaths } from '@/lib/storage-paths';
import {
  parseFile,
  MAX_FILE_SIZE_BYTES,
  computeFileHash,
} from '@/lib/file-parsers';

/** multipart sınırları ve alan başlıkları için pay. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

function tooLarge(sizeBytes: number) {
  return NextResponse.json(
    {
      error: `Dosya boyutu (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB) izin verilen ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB sınırını aşıyor.`,
    },
    { status: 413 }
  );
}

export async function POST(req: Request) {
  // Gövde belleğe alınmadan önce bildirilen boyut kontrol edilir.
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > MAX_FILE_SIZE_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return tooLarge(declared);
  }

  let file: File | null;
  try {
    const formData = await req.formData();
    const entry = formData.get('file');
    file = entry instanceof File ? entry : null;
  } catch {
    return NextResponse.json({ error: 'Geçersiz form verisi.' }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json(
      { error: 'Dosya seçilmedi. Lütfen geçerli bir dosya yükleyin.' },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return tooLarge(file.size);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const sizeBytes = buffer.length;

    const hash = computeFileHash(buffer);

    // AI model settings to check vision support
    const aiSettings = await prisma.aISettings.findFirst();
    const modelName = aiSettings?.modelName || 'llama3.2';
    // By default, common local models like llama3.2/mistral/qwen (non-vl) do not have vision
    const hasVisionSupport =
      modelName.toLowerCase().includes('vision') ||
      modelName.toLowerCase().includes('vl') ||
      modelName.toLowerCase().includes('llava');

    // Parse the file
    const parseResult = await parseFile({
      buffer,
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      aiModelName: modelName,
      hasVisionSupport,
    });

    // Uygulama veri klasörü (paketli uygulamada çalışma dizini salt-okunur olabilir).
    const uploadsDir = getStoragePaths().uploadsDir;
    await fs.mkdir(uploadsDir, { recursive: true });

    const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'dosya';
    const storagePath = path.join(uploadsDir, `${hash.slice(0, 12)}_${safeName}`);
    await fs.writeFile(storagePath, buffer);

    // Upsert or retrieve UploadedFile in database
    let uploadedFile = await prisma.uploadedFile.findUnique({
      where: { hash },
      include: { artifacts: true },
    });

    const status =
      parseResult.uncertainties.length > 0 && parseResult.confidence === 'low'
        ? 'needs_review'
        : 'ready_to_apply';

    if (!uploadedFile) {
      uploadedFile = await prisma.uploadedFile.create({
        data: {
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes,
          hash,
          storagePath,
          status,
          parseErrors:
            parseResult.uncertainties.length > 0
              ? JSON.stringify(parseResult.uncertainties)
              : null,
          artifacts: {
            create: {
              normalizedType: parseResult.normalizedType,
              structuredData: JSON.stringify(parseResult.structuredData),
              confidence: parseResult.confidence,
              uncertainties: JSON.stringify(parseResult.uncertainties),
              sourceSummary: parseResult.sourceSummary,
            },
          },
        },
        include: { artifacts: true },
      });

      // Audit event
      await prisma.auditEvent.create({
        data: {
          actionType: 'FILE_UPLOAD',
          entityType: 'UploadedFile',
          entityId: uploadedFile.id,
          status: 'SUCCESS',
          details: JSON.stringify({
            filename: file.name,
            hash,
            sizeBytes,
            normalizedType: parseResult.normalizedType,
            confidence: parseResult.confidence,
          }),
        },
      });
    }

    const artifact = uploadedFile.artifacts[0];

    return NextResponse.json({
      success: true,
      file: {
        id: uploadedFile.id,
        originalName: uploadedFile.originalName,
        mimeType: uploadedFile.mimeType,
        sizeBytes: uploadedFile.sizeBytes,
        hash: uploadedFile.hash,
        status: uploadedFile.status,
        createdAt: uploadedFile.createdAt,
      },
      artifact: {
        id: artifact?.id,
        normalizedType: parseResult.normalizedType,
        confidence: parseResult.confidence,
        uncertainties: parseResult.uncertainties,
        sourceSummary: parseResult.sourceSummary,
        structuredData: parseResult.structuredData,
      },
      sanitizedContent: parseResult.sanitizedContent,
    });
  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Dosya işlenemedi. Dosyanın bozuk olmadığından ve desteklenen bir türde olduğundan emin olun.' },
      { status: 422 }
    );
  }
}

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import {
  parseFile,
  MAX_FILE_SIZE_BYTES,
  computeFileHash,
} from '@/lib/file-parsers';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Dosya seçilmedi. Lütfen geçerli bir dosya yükleyin.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sizeBytes = buffer.length;

    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `Dosya boyutu (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB) izin verilen 20 MB sınırını aşıyor.`,
        },
        { status: 400 }
      );
    }

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

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
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
      { error: `Dosya yükleme ve işleme hatası: ${error?.message || 'Bilinmeyen hata'}` },
      { status: 500 }
    );
  }
}

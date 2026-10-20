import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  DraftActionError,
  reissueApprovalToken,
  rejectActionDraft,
  verifyAndApplyActionDraft,
} from '@/lib/ai-tools/action-tools';

const ActionRequestSchema = z.object({
  draftId: z.string().min(1, 'draftId parametresi zorunludur.'),
  action: z.enum(['approve', 'reject', 'reissue']).default('approve'),
  approvalToken: z.string().optional(),
  editedChanges: z.record(z.any()).optional(),
  reason: z.string().max(500).optional(),
});

function errorResponse(error: unknown) {
  if (error instanceof DraftActionError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Taslak değişiklikleri geçersiz.', issues: error.issues },
      { status: 400 }
    );
  }
  console.error('Action execution error:', error);
  return NextResponse.json({ error: 'Eylem yürütülürken beklenmeyen bir hata oluştu.' }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const draftId = searchParams.get('draftId');

    if (!draftId) {
      return NextResponse.json({ error: 'draftId parametresi zorunludur.' }, { status: 400 });
    }

    const draft = await prisma.actionDraft.findUnique({ where: { id: draftId } });
    if (!draft) {
      return NextResponse.json({ error: 'Taslak bulunamadı.' }, { status: 404 });
    }

    return NextResponse.json({
      id: draft.id,
      draftType: draft.draftType,
      proposedChanges: JSON.parse(draft.proposedChanges || '{}'),
      impactSummary: draft.impactSummary,
      status: draft.status,
      expiresAt: draft.expiresAt,
      isExpired: new Date() > draft.expiresAt,
      createdAt: draft.createdAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON gövdesi.' }, { status: 400 });
  }

  const parsed = ActionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek.' }, { status: 400 });
  }
  const { draftId, action, approvalToken, editedChanges, reason } = parsed.data;

  try {
    if (action === 'reject') {
      return NextResponse.json(await rejectActionDraft(draftId, reason));
    }
    if (action === 'reissue') {
      return NextResponse.json(await reissueApprovalToken(draftId));
    }
    if (!approvalToken) {
      return NextResponse.json(
        { error: 'Onaylama işlemi için geçerli bir approvalToken gereklidir.' },
        { status: 403 }
      );
    }
    return NextResponse.json(await verifyAndApplyActionDraft(draftId, approvalToken, editedChanges));
  } catch (error) {
    return errorResponse(error);
  }
}

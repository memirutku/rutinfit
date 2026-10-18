import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  verifyAndApplyActionDraft,
  rejectActionDraft,
} from '@/lib/ai-tools/action-tools';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const draftId = searchParams.get('draftId');

    if (!draftId) {
      return NextResponse.json({ error: 'draftId parametresi zorunludur.' }, { status: 400 });
    }

    const draft = await prisma.actionDraft.findUnique({
      where: { id: draftId },
    });

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
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Taslak bilgisi alınamadı.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { draftId, approvalToken, action = 'approve', editedChanges, reason } = body;

    if (!draftId) {
      return NextResponse.json({ error: 'draftId parametresi zorunludur.' }, { status: 400 });
    }

    if (action === 'reject') {
      const result = await rejectActionDraft(draftId, reason);
      return NextResponse.json(result);
    }

    if (action === 'approve') {
      if (!approvalToken) {
        return NextResponse.json(
          { error: 'Onaylama işlemi için geçerli bir approvalToken gereklidir.' },
          { status: 403 }
        );
      }

      const result = await verifyAndApplyActionDraft(draftId, approvalToken, editedChanges);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Geçersiz aksiyon. "approve" veya "reject" olmalıdır.' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Action execution error:', error);
    return NextResponse.json(
      { error: error?.message || 'Eylem yürütülürken hata oluştu.' },
      { status: 400 }
    );
  }
}

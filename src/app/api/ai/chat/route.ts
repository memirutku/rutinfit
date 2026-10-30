import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createActionDraft } from '@/lib/ai-tools/action-tools';
import { calculateRecipeNutrition } from '@/lib/ai-tools/draft-tools';
import { ChatRequestSchema } from '@/lib/schemas/chat';
import { checkAIBaseUrl, shouldSendOpenAIKey, DEFAULT_AI_BASE_URL } from '@/lib/security/ai-endpoint';
import { buildSystemPrompt, extractActionProposal, loadCoachContext } from '@/lib/services/coach-context';
import { detectRedFlags, SAFETY_REFERRAL_TR } from '@/lib/safety';

// GET: Retrieve conversation list or conversation history
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (conversationId) {
      const conversation = await prisma.aIConversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            // Onay anahtarı özeti istemciye gönderilmez.
            include: {
              draft: {
                select: { id: true, draftType: true, status: true, expiresAt: true, impactSummary: true },
              },
            },
          },
        },
      });

      if (!conversation) {
        return NextResponse.json({ error: 'Konuşma bulunamadı.' }, { status: 404 });
      }

      return NextResponse.json({ conversation });
    }

    const conversations = await prisma.aIConversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({ conversations });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Konuşmalar alınamadı.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, conversationId: reqConversationId, fileIds } = ChatRequestSchema.parse(body);

    // 1. Ayarlar ve onaylı kişisel bağlam
    const aiSettings = await prisma.aISettings.findFirst();
    // F58: koç kapalıysa modele hiçbir şey gönderilmez ve sohbet kaydedilmez.
    if (aiSettings && !aiSettings.coachEnabled) {
      return NextResponse.json({
        reply: 'AI koçu kapalı. Açmak için Ayarlar sayfasındaki yapay zekâ bölümünü kullanabilirsin.',
        isError: true,
        coachDisabled: true,
      });
    }
    const coachContext = await loadCoachContext(fileIds);
    const todayStr = coachContext.today;
    // F56: son kullanıcı mesajında risk işareti varsa güvenlik bölümü eklenir ve öneri üretilmez.
    const lastUserContent = messages.filter((m) => m.role === 'user').pop()?.content;
    const redFlag = detectRedFlags(lastUserContent);
    const safety = redFlag ? { safetyNotice: SAFETY_REFERRAL_TR } : {};
    const systemPrompt = buildSystemPrompt({ ...coachContext, redFlag, tone: aiSettings?.tone });

    // Persist or find conversation
    let convId = reqConversationId;
    if (!convId) {
      const latestUserMsg = messages.filter((m) => m.role === 'user').pop()?.content || 'Yeni Sohbet';
      const title = latestUserMsg.slice(0, 30);
      const newConv = await prisma.aIConversation.create({
        data: { title },
      });
      convId = newConv.id;
    }

    // Save user's latest message to DB
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg && lastUserMsg.role === 'user') {
      await prisma.aIMessage.create({
        data: {
          conversationId: convId,
          role: 'user',
          content: lastUserMsg.content,
          fileIds: fileIds && fileIds.length > 0 ? JSON.stringify(fileIds) : null,
        },
      });
    }

    const baseUrl = aiSettings?.baseUrl || DEFAULT_AI_BASE_URL;
    const model = aiSettings?.modelName || 'llama3.2';
    const providerType = aiSettings?.providerType || 'ollama';

    // Kişisel bağlam yalnız izin verilen (yerel veya resmi OpenAI) adrese gider.
    const endpointCheck = checkAIBaseUrl(baseUrl);
    if (!endpointCheck.ok) {
      return NextResponse.json({
        reply: `⚠️ Kayıtlı yapay zekâ adresi güvenli değil (${endpointCheck.reason}) Lütfen Ayarlar sekmesinden yeniden yapılandırın.`,
        conversationId: convId,
        isError: true,
        ...safety,
      });
    }

    const chatEndpoint = baseUrl.endsWith('/')
      ? `${baseUrl}chat/completions`
      : `${baseUrl}/chat/completions`;

    const requestMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (shouldSendOpenAIKey(providerType, baseUrl) && process.env.OPENAI_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.OPENAI_API_KEY}`;
    }

    let rawContent = '';
    let actionProposal: any = null;
    let draftId: string | null = null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      let aiRes: Response;
      try {
        aiRes = await fetch(chatEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: requestMessages,
            temperature: 0.7,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!aiRes.ok) {
        return NextResponse.json({
          reply: `⚠️ Yerel yapay zekâ sunucusu hata verdi (${aiRes.status}). Lütfen Ayarlar sekmesinden model bağlantısını kontrol edin.`,
          conversationId: convId,
          isError: true,
        });
      }

      const aiData = await aiRes.json();
      rawContent = aiData.choices?.[0]?.message?.content || 'Modelden boş yanıt alındı.';

      // Modelin önerisi (varsa) şemaya göre doğrulanır; taslak oluşturma hatası yanıtı düşürmez.
      {
        try {
          const validatedAction = redFlag ? null : extractActionProposal(rawContent);
          if (validatedAction) {
            actionProposal = validatedAction as any;

            if (actionProposal.type === 'meal_proposal') {
              // Makrolar modelin tahmininden değil katalogdaki 100 g değerlerinden hesaplanır.
              const ingCalc = await calculateRecipeNutrition(
                actionProposal.ingredients.map((ing: any) => ({
                  name: ing.foodName,
                  grams: ing.grams,
                }))
              );
              const missingNote = ingCalc.missingIngredients.length
                ? ` Katalogda bulunmayan: ${ingCalc.missingIngredients.join(', ')} (toplama dahil değil).`
                : '';

              const draftResult = await createActionDraft({
                draftType: 'planned_meal',
                proposedChanges: {
                  date: todayStr,
                  mealType: actionProposal.mealType,
                  title: actionProposal.title,
                  rationale: actionProposal.rationale,
                  prepMinutes: actionProposal.prepMinutes,
                  ingredients: actionProposal.ingredients.map((ing: any, i: number) => ({
                    foodName: ing.foodName,
                    grams: ing.grams,
                    foodItemId: ingCalc.itemized[i]?.foodItemId ?? null,
                  })),
                },
                impactSummary: `${actionProposal.title} bugünün planına eklenecek: ${ingCalc.totalCalories} kcal, ${ingCalc.totalProteinG}g protein.${missingNote} (Gerekçe: ${actionProposal.rationale})`,
              });

              draftId = draftResult.draftId;
              actionProposal.draftId = draftResult.draftId;
              actionProposal.approvalToken = draftResult.approvalToken;
              actionProposal.deterministicMacros = ingCalc;
            } else if (actionProposal.type === 'workout_adjustment') {
              const draftResult = await createActionDraft({
                draftType: 'workout_session',
                proposedChanges: {
                  date: todayStr,
                  name: actionProposal.title,
                  durationMinutes: actionProposal.targetDurationMinutes,
                  // Her egzersiz için önerilen set sayısı kadar set; ağırlık kullanıcı tarafından girilir.
                  sets: actionProposal.exercises.flatMap((e: any) =>
                    Array.from({ length: e.sets }, (_, i) => ({
                      exerciseName: e.exerciseName,
                      setNumber: i + 1,
                      reps: e.repMin,
                      weightKg: 0,
                    }))
                  ),
                  completed: false,
                },
                impactSummary: `${actionProposal.title} (${actionProposal.targetDurationMinutes} dk) - Gerekçe: ${actionProposal.reason}`,
              });

              draftId = draftResult.draftId;
              actionProposal.draftId = draftResult.draftId;
              actionProposal.approvalToken = draftResult.approvalToken;
            }
          }
        } catch {
          // Öneri taslağa dönüştürülemezse yalnız metin yanıtı gösterilir
        }
      }

      // Persist assistant message in AIMessage
      await prisma.aIMessage.create({
        data: {
          conversationId: convId,
          role: 'assistant',
          content: rawContent,
          draftId,
          // Ham onay anahtarı kalıcı olarak saklanmaz; yalnız bu yanıtta istemciye verilir.
          actionProposal: actionProposal
            ? JSON.stringify({ ...actionProposal, approvalToken: undefined })
            : null,
        },
      });

      // Update conversation updatedAt
      await prisma.aIConversation.update({
        where: { id: convId },
        data: { updatedAt: new Date() },
      });

      return NextResponse.json({
        reply: rawContent,
        conversationId: convId,
        actionProposal,
        isError: false,
        ...safety,
      });
    } catch {
      return NextResponse.json({
        reply: `🔌 Yerel yapay zekâ modeline ulaşılamadı (${baseUrl}).
Lütfen bilgisayarınızda **Ollama** veya **LM Studio** uygulamasının açık ve modelin (${model}) yüklü olduğunu kontrol edin.
Çevrimdışı olsanız bile RutinFit'in tüm takip özellikleri normal şekilde çalışmaya devam eder.`,
        conversationId: convId,
        isError: true,
        ...safety,
      });
    }
  } catch (error: any) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: error?.message || 'İstek işlenemedi' },
      { status: 400 }
    );
  }
}

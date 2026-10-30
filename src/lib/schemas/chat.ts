import { z } from "zod";
import { MacrosSchema } from "./food";
import { AI_STATUS_KINDS } from "../ai-status";

/** İstemci yalnız user/assistant rolü gönderebilir; "system" rolü enjekte edilemez. */
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000, "Mesaj en fazla 4000 karakter olabilir."),
});

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).max(30, "En fazla 30 mesaj geçmişi gönderilebilir."),
  conversationId: z.string().optional(),
  fileIds: z.array(z.string()).optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/** POST /api/ai/actions: iki aşamalı onay (approve / reject / reissue). */
export const ActionRequestSchema = z.object({
  draftId: z.string().min(1, "draftId parametresi zorunludur."),
  action: z.enum(["approve", "reject", "reissue"]).default("approve"),
  approvalToken: z.string().optional(),
  editedChanges: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().max(500).optional(),
});
export type ActionRequest = z.input<typeof ActionRequestSchema>;

/* ------------------------------------------------------------------ */
/* Yanıt şemaları                                                      */
/* ------------------------------------------------------------------ */

/** Katalogdan hesaplanan öneri makroları (modelin tahmini değil). */
export const DeterministicMacrosSchema = z.object({
  totalCalories: z.number(),
  totalProteinG: z.number(),
  totalCarbsG: z.number(),
  totalFatG: z.number(),
  missingIngredients: z.array(z.string()),
});

const ProposalBase = z.object({
  title: z.string(),
  draftId: z.string().optional(),
  /** Yalnız yeni üretilen öneride gelir; geçmiş sohbette yeniden alınır. */
  approvalToken: z.string().optional(),
});

export const MealProposalViewSchema = ProposalBase.extend({
  type: z.literal("meal_proposal"),
  rationale: z.string(),
  ingredients: z.array(z.object({ foodName: z.string(), grams: z.number() })).optional(),
  estimatedMacros: MacrosSchema.optional(),
  deterministicMacros: DeterministicMacrosSchema.optional(),
});

export const WorkoutAdjustmentViewSchema = ProposalBase.extend({
  type: z.literal("workout_adjustment"),
  reason: z.string(),
  targetDurationMinutes: z.number(),
  exercises: z
    .array(z.object({ exerciseName: z.string(), sets: z.number(), repMin: z.number(), repMax: z.number() }))
    .optional(),
});

/** Sohbet kartında gösterilen eylem önerisi. */
export const ActionProposalSchema = z.discriminatedUnion("type", [MealProposalViewSchema, WorkoutAdjustmentViewSchema]);
export type ActionProposal = z.infer<typeof ActionProposalSchema>;
export type MealProposalView = z.infer<typeof MealProposalViewSchema>;
export type WorkoutAdjustmentView = z.infer<typeof WorkoutAdjustmentViewSchema>;

/** POST /api/ai/chat yanıtı */
export const ChatResponseSchema = z.object({
  reply: z.string(),
  conversationId: z.string().optional(),
  actionProposal: ActionProposalSchema.nullable().optional(),
  isError: z.boolean().optional(),
  /** F56: yeme bozukluğu / kendine zarar işaretinde profesyonel desteğe yönlendirme. */
  safetyNotice: z.string().optional(),
  /** F58: koç ayarlardan kapatılmış. */
  coachDisabled: z.boolean().optional(),
  /** B28: modele ulaşılamadı / sunucu hata verdi / adres izinsiz (istemci durumu yeniden denetler). */
  errorKind: z.enum(["unreachable", "server_error", "invalid_url"]).optional(),
  /** F50: veritabanından hesaplanan yanıt kartı. */
  dataAnswer: z
    .object({
      type: z.string(),
      title: z.string(),
      answer: z.string(),
      rows: z.array(z.object({ label: z.string(), value: z.string() })),
      chart: z.array(z.object({ x: z.string(), y: z.number() })).optional(),
    })
    .optional(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

/** GET /api/ai/chat */
export const ConversationListSchema = z.object({
  conversations: z.array(z.object({ id: z.string(), title: z.string() })),
});
export type ConversationSummary = z.infer<typeof ConversationListSchema>["conversations"][number];

/** GET /api/ai/chat?conversationId= */
export const ConversationDetailSchema = z.object({
  conversation: z.object({
    id: z.string(),
    title: z.string(),
    messages: z.array(
      z.object({
        id: z.string(),
        role: z.string(),
        content: z.string(),
        draftId: z.string().nullable(),
        /** JSON metni; istemci ActionProposalSchema ile ayrıştırır. */
        actionProposal: z.string().nullable(),
        draft: z.object({ id: z.string(), status: z.string() }).nullable(),
      })
    ),
  }),
});
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;

/** POST /api/files/upload yanıtı */
export const UploadResponseSchema = z.object({
  file: z.object({
    id: z.string(),
    originalName: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number(),
    status: z.string(),
  }),
  artifact: z
    .object({
      confidence: z.enum(["high", "medium", "low"]).optional(),
      sourceSummary: z.string().optional(),
      uncertainties: z.array(z.string()).optional(),
    })
    .optional(),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

/** POST /api/ai/actions action=reissue yanıtı */
export const ReissueResponseSchema = z.object({ approvalToken: z.string() });

/** B28: GET /api/ai/status — kayıtlı model sunucusunun gerçek durumu. */
export const AIStatusSchema = z.object({
  status: z.enum(AI_STATUS_KINDS),
  providerType: z.string(),
  baseUrl: z.string(),
  modelName: z.string(),
  /** Sunucunun bildirdiği modeller (ulaşılamazsa boş). */
  models: z.array(z.string()),
  /** Düz metin açıklama. */
  message: z.string(),
});
export type AIStatus = z.infer<typeof AIStatusSchema>;

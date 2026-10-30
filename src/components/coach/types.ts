import { z } from "zod";
import {
  ActionProposalSchema,
  DeterministicMacrosSchema,
  MealProposalViewSchema,
  WorkoutAdjustmentViewSchema,
  type UploadResponse,
} from "@/lib/schemas/chat";

/* ------------------------------------------------------------------ */
/* Öneri kartı tipleri: paylaşılan şemadan türetilir, eski kayıtlara    */
/* karşı hoşgörülüdür (bozuk alan kartı düşürmez, yalnız boş kalır).    */
/* ------------------------------------------------------------------ */

const optionalString = z.string().optional().catch(undefined);

const LooseMealSchema = MealProposalViewSchema.extend({
  title: z.string().catch(""),
  draftId: optionalString,
  approvalToken: optionalString,
  rationale: z.string().catch(""),
  ingredients: MealProposalViewSchema.shape.ingredients.catch(undefined),
  estimatedMacros: MealProposalViewSchema.shape.estimatedMacros.catch(undefined),
  deterministicMacros: DeterministicMacrosSchema.extend({
    missingIngredients: z.array(z.string()).catch([]),
  })
    .optional()
    .catch(undefined),
});

const LooseWorkoutSchema = WorkoutAdjustmentViewSchema.extend({
  title: z.string().catch(""),
  draftId: optionalString,
  approvalToken: optionalString,
  reason: z.string().catch(""),
  targetDurationMinutes: z.number().optional().catch(undefined),
  exercises: WorkoutAdjustmentViewSchema.shape.exercises.catch(undefined),
});

const LooseProposalSchema = z.discriminatedUnion("type", [LooseMealSchema, LooseWorkoutSchema]);

/** Bilinmeyen türdeki öneri: yalnız başlık ve onay düğmeleriyle gösterilir (eski davranış). */
export interface OtherProposal {
  type: "other";
  title: string;
  draftId?: string;
  approvalToken?: string;
}

export type CardProposal = z.infer<typeof LooseProposalSchema> | OtherProposal;
export type MealCardProposal = z.infer<typeof LooseMealSchema>;
export type WorkoutCardProposal = z.infer<typeof LooseWorkoutSchema>;

/**
 * Sunucudan (yeni yanıt veya kayıtlı JSON) gelen öneriyi karta çevirir. Önce sıkı şema,
 * olmazsa hoşgörülü şema denenir; nesne olmayan değer kart üretmez.
 */
export function parseProposal(value: unknown): CardProposal | undefined {
  if (!value || typeof value !== "object") return undefined;
  const strict = ActionProposalSchema.safeParse(value);
  if (strict.success) return strict.data;
  const loose = LooseProposalSchema.safeParse(value);
  if (loose.success) return loose.data;
  const raw = value as Record<string, unknown>;
  return {
    type: "other",
    title: typeof raw.title === "string" ? raw.title : "",
    draftId: typeof raw.draftId === "string" ? raw.draftId : undefined,
    approvalToken: typeof raw.approvalToken === "string" ? raw.approvalToken : undefined,
  };
}

/** Veritabanında JSON metni olarak saklanan öneriyi ayrıştırır; bozuk JSON kart üretmez. */
export function parseStoredProposal(json: string | null): CardProposal | undefined {
  if (!json) return undefined;
  try {
    return parseProposal(JSON.parse(json));
  } catch {
    return undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Sohbet durumu                                                       */
/* ------------------------------------------------------------------ */

export interface CoachMessage {
  /** Kararlı React anahtarı: kayıtlı mesajda veritabanı kimliği, yenide istemci kimliği. */
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal?: CardProposal;
  isError?: boolean;
  fileIds?: string[];
  /** F56: profesyonel desteğe yönlendirme notu. */
  safetyNotice?: string;
  /** F58: metin bir dil modelinden geldi (etiketlenir). */
  aiGenerated?: boolean;
  /** F50: kayıtlardan hesaplanan yanıt kartı. */
  dataAnswer?: { title: string; answer: string; rows: Array<{ label: string; value: string }> };
}

export interface AttachedFile {
  id: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  status: string;
  confidence: "high" | "medium" | "low";
  sourceSummary: string;
  uncertainties: string[];
}

export function toAttachedFile(data: UploadResponse): AttachedFile {
  return {
    id: data.file.id,
    originalName: data.file.originalName,
    sizeBytes: data.file.sizeBytes,
    mimeType: data.file.mimeType,
    status: data.file.status,
    confidence: data.artifact?.confidence || "medium",
    sourceSummary: data.artifact?.sourceSummary || "Belge",
    uncertainties: data.artifact?.uncertainties || [],
  };
}

export const WELCOME_MESSAGE =
  "Merhaba! Ben RutinFit yapay zekâ koçunuzum. Hedeflerinize (2.080 kcal hedefi, 2.100 kcal sakin tavanı), bugünkü kalan makrolarınıza ve antrenman durumunuza göre beslenme veya antrenman uyarlamaları önerebilirim. Ayrıca PDF, Excel, Word veya metin formatında beslenme/antrenman programı yükleyebilirsiniz.";

export const NEW_CHAT_MESSAGE =
  "Yeni bir sohbet başlattık. Size nasıl yardımcı olabilirim? Öğün önerisi, antrenman ayarlaması veya program dosyanızı yükleyebilirsiniz.";

export const SEND_ERROR_MESSAGE =
  "⚠️ İstek gönderilirken bir hata oluştu. Lütfen yerel modelinizin (Ollama / LM Studio) çalıştığından emin olun.";

import { z } from "zod";

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

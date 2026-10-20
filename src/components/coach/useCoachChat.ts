"use client";

import { useRef, useState } from "react";
import { errorMessage } from "@/lib/client/api";
import { clientId } from "@/lib/client/keys";
import { useTimedMessage } from "@/hooks/useTimedMessage";
import {
  useConversations,
  useDraftAction,
  useLoadConversation,
  useSendChat,
  useUploadFile,
} from "@/lib/client/queries/coach";
import {
  NEW_CHAT_MESSAGE,
  SEND_ERROR_MESSAGE,
  WELCOME_MESSAGE,
  parseProposal,
  parseStoredProposal,
  toAttachedFile,
  type AttachedFile,
  type CardProposal,
  type CoachMessage,
} from "./types";

const assistant = (content: string): CoachMessage => ({ id: clientId("msg"), role: "assistant", content });

/** Öneri kartının düzenleme alanı: öğün taslağında "title", antrenmanda "name". */
export const editFieldFor = (proposal: CardProposal) => (proposal.type === "meal_proposal" ? "title" : "name");

/**
 * Koç sohbetinin tüm durumu: mesajlar, ekler ve iki aşamalı onaylı eylem taslakları.
 * Taslak durumları (onaylandı / iptal / düzenleniyor) mesaj kimliğine göre tutulur.
 */
export function useCoachChat() {
  const [messages, setMessages] = useState<CoachMessage[]>(() => [assistant(WELCOME_MESSAGE)]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [rejected, setRejected] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string>>({});
  const success = useTimedMessage<string>(5000);
  const failure = useTimedMessage<string>(5000);

  // Çift tıklama / çift gönderim koruması: state yeniden çizilmeden gelen ikinci olay da durur.
  const sendingRef = useRef(false);
  const busyRef = useRef(false);

  const conversations = useConversations();
  const loadConversation = useLoadConversation();
  const sendChat = useSendChat();
  const uploadFile = useUploadFile();
  const draftAction = useDraftAction();

  async function selectConversation(id: string) {
    try {
      setLoading(true);
      const { conversation } = await loadConversation(id);
      setConversationId(id);
      const nextApplied: Record<string, boolean> = {};
      const nextRejected: Record<string, boolean> = {};
      const mapped: CoachMessage[] = (conversation.messages || []).map((m) => {
        // Taslağın gerçek durumu veritabanından gelir; onay anahtarı gerekirse yeniden alınır.
        if (m.draft?.status === "applied") nextApplied[m.id] = true;
        if (m.draft?.status === "rejected") nextRejected[m.id] = true;
        return {
          id: m.id,
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
          proposal: parseStoredProposal(m.actionProposal),
        };
      });
      setApplied(nextApplied);
      setRejected(nextRejected);
      setEditingId(null);
      if (mapped.length > 0) setMessages(mapped);
    } catch (e) {
      console.error("Konuşma yükleme hatası:", e);
    } finally {
      setLoading(false);
    }
  }

  function startNewConversation() {
    setConversationId(null);
    setAttachedFiles([]);
    setApplied({});
    setRejected({});
    setEditingId(null);
    setMessages([assistant(NEW_CHAT_MESSAGE)]);
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of files) {
        const data = await uploadFile.mutateAsync(file);
        setAttachedFiles((prev) => [...prev, toAttachedFile(data)]);
      }
    } catch (err) {
      setUploadError(errorMessage(err, "Yükleme sırasında hata oluştu."));
    } finally {
      setUploading(false);
    }
  }

  function removeAttachedFile(id: string) {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function sendMessage(textToSend?: string) {
    const text = textToSend || input;
    if ((!text.trim() && attachedFiles.length === 0) || loading || sendingRef.current) return;
    sendingRef.current = true;

    const fileIds = attachedFiles.map((f) => f.id);
    const next: CoachMessage[] = [...messages, { id: clientId("msg"), role: "user", content: text, fileIds }];
    setMessages(next);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      const data = await sendChat.mutateAsync({
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        conversationId: conversationId || undefined,
        fileIds,
      });
      if (data.conversationId && !conversationId) setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        { ...assistant(data.reply), proposal: parseProposal(data.actionProposal), isError: data.isError },
      ]);
      setAttachedFiles([]);
    } catch {
      setMessages((prev) => [...prev, { ...assistant(SEND_ERROR_MESSAGE), isError: true }]);
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  }

  /** İki aşamalı onay: gerekirse yeni onay anahtarı alınır, sonra taslak uygulanır. */
  async function approve(proposal: CardProposal, messageId: string, editedChanges?: Record<string, string>) {
    if (busyRef.current) return;
    if (!proposal.draftId) {
      failure.show("Taslak kimliği bulunamadı.", null);
      return;
    }
    busyRef.current = true;
    setBusyId(messageId);
    try {
      let approvalToken = proposal.approvalToken;
      if (!approvalToken) {
        // Geçmiş sohbetten açılan öneri: ham anahtar saklanmadığı için yenisi istenir.
        approvalToken = (await draftAction.mutateAsync({ draftId: proposal.draftId, action: "reissue" })).approvalToken;
      }
      await draftAction.mutateAsync({ draftId: proposal.draftId, approvalToken, action: "approve", editedChanges });
      setApplied((prev) => ({ ...prev, [messageId]: true }));
      setEditingId(null);
      success.show(`"${proposal.title || "Taslak"}" başarıyla onaylandı ve plana eklendi! ✓`);
    } catch (err) {
      failure.show(errorMessage(err, "Onaylama sırasında bir hata oluştu."));
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }

  async function reject(proposal: CardProposal, messageId: string) {
    if (!proposal.draftId) {
      setRejected((prev) => ({ ...prev, [messageId]: true }));
      return;
    }
    try {
      await draftAction.mutateAsync({ draftId: proposal.draftId, action: "reject", reason: "Kullanıcı vazgeçti" });
      setRejected((prev) => ({ ...prev, [messageId]: true }));
      setEditingId(null);
    } catch (err) {
      failure.show(errorMessage(err, "Vazgeçme sırasında bir hata oluştu."));
    }
  }

  function toggleEdit(proposal: CardProposal, messageId: string) {
    if (editingId === messageId) {
      setEditingId(null);
    } else {
      setEditingId(messageId);
      setEditFormData({ [editFieldFor(proposal)]: proposal.title });
    }
  }

  function editTitle(proposal: CardProposal, value: string) {
    setEditFormData((prev) => ({ ...prev, [editFieldFor(proposal)]: value }));
  }

  return {
    messages,
    input,
    setInput,
    loading,
    conversationId,
    conversations: conversations.data ?? [],
    attachedFiles,
    uploading,
    uploadError,
    clearUploadError: () => setUploadError(null),
    successMessage: success.message,
    errorMessage: failure.message,
    actionState: (messageId: string) => ({
      isApplied: !!applied[messageId],
      isRejected: !!rejected[messageId],
      isEditing: editingId === messageId,
      isBusy: busyId === messageId,
    }),
    editFormData,
    selectConversation,
    startNewConversation,
    uploadFiles,
    removeAttachedFile,
    sendMessage,
    approve,
    reject,
    toggleEdit,
    editTitle,
  };
}

export type CoachChat = ReturnType<typeof useCoachChat>;

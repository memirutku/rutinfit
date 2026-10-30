"use client";

import { AlertCircle, Check } from "lucide-react";
import { CoachHeader } from "@/components/coach/CoachHeader";
import { QuickPrompts } from "@/components/coach/QuickPrompts";
import { MessageList } from "@/components/coach/MessageList";
import { AttachmentBar, UploadStatus } from "@/components/coach/AttachmentBar";
import { ChatComposer } from "@/components/coach/ChatComposer";
import { useCoachChat } from "@/components/coach/useCoachChat";
import Link from "next/link";
import { useAISettings } from "@/lib/client/queries/system";

export default function CoachPage() {
  const chat = useCoachChat();
  // F58: ayar okunamazsa koç açık sayılır (sunucu yine de kapalı koçu reddeder).
  const settings = useAISettings();
  const coachDisabled = settings.data?.coachEnabled === false;

  return (
    <div className="space-y-6 min-w-0">
      {/* Üst Başlık & Oturum Çubuğu */}
      <CoachHeader
        conversations={chat.conversations}
        conversationId={chat.conversationId}
        onSelect={chat.selectConversation}
        onNew={chat.startNewConversation}
      />

      {/* Bildirim Mesajları */}
      {chat.successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{chat.successMessage}</span>
        </div>
      )}

      {chat.errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{chat.errorMessage}</span>
        </div>
      )}

      {coachDisabled && (
        <div role="status" className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-sm">
          Koç kapalı. Açmak için{" "}
          <Link href="/settings" className="font-semibold text-brand-700 underline">
            Ayarlar
          </Link>{" "}
          sayfasındaki yapay zekâ bölümünü kullanabilirsin. Takip özelliklerinin hepsi çalışmaya devam eder.
        </div>
      )}

      {/* Hızlı Komut Butonları */}
      <QuickPrompts disabled={coachDisabled || chat.loading} onSend={chat.sendMessage} />

      {/* Sohbet Alanı */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[70vh]">
        <MessageList
          messages={chat.messages}
          loading={chat.loading}
          stateFor={chat.actionState}
          onApprove={(proposal, id) => chat.approve(proposal, id, chat.actionState(id).isEditing ? chat.editFormData : undefined)}
          onReject={chat.reject}
          onToggleEdit={chat.toggleEdit}
          onEditTitle={chat.editTitle}
        />

        {/* Dosya Yükleme Ekleri Önizleme Çubuğu */}
        <AttachmentBar files={chat.attachedFiles} onRemove={chat.removeAttachedFile} />

        {/* Yükleme veya Hata Bildirimi */}
        <UploadStatus uploading={chat.uploading} error={chat.uploadError} onDismissError={chat.clearUploadError} />

        {/* Mesaj ve Dosya Giriş Alanı */}
        <ChatComposer
          input={chat.input}
          onInputChange={chat.setInput}
          onSubmit={() => chat.sendMessage()}
          onFilesSelected={chat.uploadFiles}
          loading={chat.loading}
          uploading={chat.uploading}
          hasAttachments={chat.attachedFiles.length > 0}
          disabled={coachDisabled}
        />
      </div>
    </div>
  );
}

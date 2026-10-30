"use client";

import { useRef } from "react";
import { Paperclip, Send } from "lucide-react";

const ACCEPTED_FILES = ".pdf,.xlsx,.xls,.csv,.docx,.txt,.md,.json,.png,.jpg,.jpeg,.webp";

interface ChatComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  /** Seçilen dosyalar yüklendikten sonra seçici sıfırlanır (aynı dosya tekrar seçilebilir). */
  onFilesSelected: (files: File[]) => Promise<void>;
  loading: boolean;
  uploading: boolean;
  hasAttachments: boolean;
  /** F58: koç kapalıyken yazma ve gönderme kapalı. */
  disabled?: boolean;
}

/** Mesaj yazma alanı, dosya ekleme düğmesi (gizli seçici) ve gönder düğmesi. */
export function ChatComposer({
  input,
  onInputChange,
  onSubmit,
  onFilesSelected,
  loading,
  uploading,
  hasAttachments,
  disabled = false,
}: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picker = e.target;
    const files = picker.files;
    if (!files || files.length === 0) return;
    try {
      await onFilesSelected(Array.from(files));
    } finally {
      picker.value = "";
    }
  }

  return (
    <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex items-center gap-2"
      >
        {/* Gizli Dosya Seçici */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILES}
          onChange={handleFiles}
          className="hidden"
        />

        <button
          type="button"
          disabled={disabled || loading || uploading}
          onClick={() => fileInputRef.current?.click()}
          title="Dosya Yükle (PDF, Excel, Word, TXT, JSON, Görsel)"
          aria-label="Dosya ekle"
          className="p-2.5 bg-white border border-slate-200 hover:border-brand-500 text-slate-500 hover:text-brand-600 rounded-xl transition-colors shadow-2xs disabled:opacity-50"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          type="text"
          placeholder="Sorunuzu yazın veya dosya yükleyip 'bunu analiz et' deyin..."
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          disabled={disabled || loading}
          className="flex-1 min-w-0 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
        />

        {/* B33: dar ekranda metin gizlenir; erişilebilir ad ve ipucu her genişlikte "Gönder". */}
        <button
          type="submit"
          aria-label="Gönder"
          title="Gönder"
          disabled={disabled || loading || (!input.trim() && !hasAttachments)}
          className="px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-1.5 font-bold text-sm shadow-xs"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline" aria-hidden="true">
            Gönder
          </span>
        </button>
      </form>
    </div>
  );
}

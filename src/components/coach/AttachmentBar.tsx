"use client";

import { FileSpreadsheet, FileText, UploadCloud, X } from "lucide-react";
import type { AttachedFile } from "./types";

const CONFIDENCE_LABELS: Record<AttachedFile["confidence"], string> = {
  high: "Yüksek güven",
  medium: "Orta güven",
  low: "Düşük güven",
};

interface AttachmentBarProps {
  files: AttachedFile[];
  onRemove: (id: string) => void;
}

/** Bir sonraki mesajla gönderilecek ekler (ayrıştırma güveniyle). */
export function AttachmentBar({ files, onRemove }: AttachmentBarProps) {
  if (files.length === 0) return null;
  return (
    <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 shadow-2xs"
        >
          {file.originalName.endsWith(".xlsx") || file.originalName.endsWith(".csv") ? (
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <FileText className="w-3.5 h-3.5 text-brand-600" />
          )}
          <span className="font-medium truncate max-w-[150px]">{file.originalName}</span>
          <span className="text-[10px] text-slate-400">({(file.sizeBytes / 1024).toFixed(0)} KB)</span>
          <span
            className={`text-[9px] px-1 py-0.2 rounded font-bold ${
              file.confidence === "high"
                ? "bg-emerald-100 text-emerald-800"
                : file.confidence === "medium"
                ? "bg-amber-100 text-amber-800"
                : "bg-rose-100 text-rose-800"
            }`}
          >
            {CONFIDENCE_LABELS[file.confidence] ?? file.confidence}
          </span>
          <button
            onClick={() => onRemove(file.id)}
            aria-label={`${file.originalName} dosyasını kaldır`}
            className="text-slate-400 hover:text-rose-600 ml-1"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

interface UploadStatusProps {
  uploading: boolean;
  error: string | null;
  onDismissError: () => void;
}

/** Dosya ayrıştırılırken bilgi şeridi; hata olursa kapatılabilir hata şeridi. */
export function UploadStatus({ uploading, error, onDismissError }: UploadStatusProps) {
  return (
    <>
      {uploading && (
        <div className="px-4 py-1.5 bg-blue-50 text-blue-700 text-xs flex items-center gap-2 border-t border-blue-100">
          <UploadCloud className="w-3.5 h-3.5 animate-bounce" />
          <span>Dosya ayrıştırılıyor ve güvenlik filtresinden geçiriliyor...</span>
        </div>
      )}
      {error && (
        <div className="px-4 py-1.5 bg-rose-50 text-rose-700 text-xs flex items-center justify-between border-t border-rose-100">
          <span>{error}</span>
          <button onClick={onDismissError} aria-label="Hata mesajını kapat">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </>
  );
}

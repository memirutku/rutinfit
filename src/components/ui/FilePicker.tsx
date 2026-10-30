"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";

interface FilePickerProps {
  id: string;
  /** Görünen etiket; gerçek dosya girdisinin erişilebilir adıdır. */
  label: string;
  accept?: string;
  disabled?: boolean;
  /** Düğme metni (varsayılan "Dosya seç"). */
  buttonText?: string;
  /** Verilirse gösterilen ad dışarıdan yönetilir (null: "Dosya seçilmedi"). */
  fileName?: string | null;
  /** Etiket görünmesin (yalnız ekran okuyucu için). */
  hideLabel?: boolean;
  onFile: (file: File | undefined) => void;
}

/**
 * B35: Türkçe dosya seçici. Tarayıcının kendi "Choose File / No file chosen" metni yerine Türkçe
 * düğme ve seçilen dosyanın adı görünür. Gerçek girdi görsel olarak gizlidir ama klavyeyle
 * odaklanır (odak halkası görünen düğmede çizilir); her seçimden sonra girdi sıfırlanır, böylece
 * aynı dosya yeniden seçilebilir.
 */
export function FilePicker({ id, label, accept, disabled, buttonText = "Dosya seç", fileName, hideLabel, onFile }: FilePickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const shown = fileName === undefined ? chosen : fileName;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "block text-xs font-semibold text-slate-600 mb-1"}>
        {label}
      </label>
      <div className="flex items-center gap-2 min-w-0">
        <input
          ref={input}
          id={id}
          type="file"
          accept={accept}
          disabled={disabled}
          className="sr-only peer"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setChosen(file?.name ?? null);
            onFile(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          onClick={() => input.current?.click()}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500"
        >
          <Upload className="w-4 h-4" aria-hidden />
          {buttonText}
        </button>
        <span className="min-w-0 truncate text-xs text-slate-500" title={shown ?? undefined}>
          {shown ?? "Dosya seçilmedi"}
        </span>
      </div>
    </div>
  );
}

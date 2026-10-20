"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Modal } from "./Modal";

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

/**
 * Uygulama içi onay penceresi. Tarayıcının window.confirm() diyaloğu masaüstü görünümünde
 * (Tauri / WKWebView) gösterilmez ve sessizce false döner; bu yüzden onaylar burada yapılır.
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title: "Sil", message: "Emin misiniz?" }))) return;
 *   ...
 *   return <>{dialog}...</>;
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    resolver.current?.(false); // önceki açık onay varsa iptal sayılır
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const dialog = (
    <Modal open={!!options} onClose={() => settle(false)} title={options?.title ?? ""}>
      <div className="text-sm text-slate-600 mb-5">{options?.message}</div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => settle(false)}
          className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          {options?.cancelLabel ?? "Vazgeç"}
        </button>
        <button
          type="button"
          onClick={() => settle(true)}
          className={`px-4 py-2 rounded-xl text-sm font-semibold text-white ${
            options?.tone === "danger" ? "bg-rose-600 hover:bg-rose-700" : "bg-brand-600 hover:bg-brand-700"
          }`}
        >
          {options?.confirmLabel ?? "Onayla"}
        </button>
      </div>
    </Modal>
  );

  return { confirm, dialog };
}

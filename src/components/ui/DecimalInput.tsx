"use client";

import { useState, type InputHTMLAttributes } from "react";
import { parseDecimalTr } from "@/lib/format";

type DecimalInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "inputMode"> & {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
  /** Boş alanın sayı karşılığı (varsayılan 0). */
  emptyValue?: number;
};

const display = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? "" : String(v).replace(".", ",");

/**
 * F80: Virgüllü ya da noktalı ondalık girişi kabul eden sayı alanı. `type="number"` tarayıcı
 * diline göre virgülü reddedebildiği için metin alanıdır; ondalık klavye ister.
 * Yarım yazılmış giriş ("62,") ekranda korunur.
 */
export function DecimalInput({ value, onValueChange, emptyValue = 0, ...rest }: DecimalInputProps) {
  const [text, setText] = useState(() => display(value));
  const [prevValue, setPrevValue] = useState(value);

  // Değer dışarıdan değiştiyse (form sıfırlama, ± düğmesi) metni eşitle.
  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== (parseDecimalTr(text) ?? emptyValue)) setText(display(value));
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        const parsed = parseDecimalTr(next);
        if (parsed !== null) onValueChange(parsed);
        else if (next.trim() === "") onValueChange(emptyValue);
      }}
    />
  );
}

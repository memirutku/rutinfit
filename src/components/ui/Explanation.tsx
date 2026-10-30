import type { ReactNode } from "react";

interface ExplanationProps {
  title?: string;
  /** Kullanılan girdiler ve sayılar. */
  items: Array<{ label: string; value: string }>;
  /** Hesabın kendisi (ör. "2.000 + 0,5 × 7.700 / 7 = 2.550"). */
  formula?: string;
  /** İsteğe bağlı küçük grafik. */
  children?: ReactNode;
}

/**
 * F57: Açıklanabilirlik. Her önerinin yanında hangi girdilerin ve sayıların kullanıldığını
 * gösterir; kullanıcı öneriye körü körüne güvenmek zorunda kalmaz.
 */
export function Explanation({ title = "Bu sonuç neye dayanıyor?", items, formula, children }: ExplanationProps) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-50/60 text-xs">
      <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-slate-700">{title}</summary>
      <div className="px-3 pb-3 space-y-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {items.map((i) => (
            <div key={i.label} className="contents">
              <dt className="text-slate-500">{i.label}</dt>
              <dd className="font-semibold text-slate-800">{i.value}</dd>
            </div>
          ))}
        </dl>
        {formula && <p className="font-mono text-[11px] text-slate-600">{formula}</p>}
        {children}
      </div>
    </details>
  );
}

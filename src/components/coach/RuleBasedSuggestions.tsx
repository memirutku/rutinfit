"use client";

import Link from "next/link";
import { ListChecks } from "lucide-react";
import { formatNumberTr } from "@/lib/format";
import type { MealSuggestions } from "@/lib/schemas/chat";

const SOURCE_LABEL = { saved_meal: "Kayıtlı öğün", recipe: "Tarif" } as const;

const macros = (m: { calories: number; proteinG: number; carbsG: number; fatG: number }) =>
  `${formatNumberTr(m.calories)} kcal · P ${formatNumberTr(m.proteinG)} g · K ${formatNumberTr(m.carbsG)} g · Y ${formatNumberTr(m.fatG)} g`;
const pct = (share: number) => `%${formatNumberTr(Math.round(share * 100))}`;

function EmptyText({ data, hideNumbers }: { data: MealSuggestions; hideNumbers: boolean }) {
  if (data.reason === "no_remaining") return <>Bugünkü kalori hedefine ulaştın; ek öğün önerisi yok.</>;
  if (data.reason === "none_fit")
    return (
      <>
        Kayıtlı öğün ve tariflerinden hiçbiri bugün kalan {hideNumbers ? "kaloriye" : `${formatNumberTr(data.remaining.calories)} kcal'e`} sığmıyor.
      </>
    );
  return (
    <>
      Henüz kayıtlı öğün ya da tarif yok. Bir öğünü kaydedince ya da{" "}
      <Link href="/foods" className="font-semibold text-brand-700 underline">
        Besin & Tarif
      </Link>{" "}
      sayfasından tarif ekleyince burada önerilir.
    </>
  );
}

/**
 * B42: yerel model yokken yapay zekâsız öneri. Kayıtlı öğünler ve tarifler, bugün kalan kalori ve
 * makroya göre kurallarla sıralanır (src/lib/meal-suggestions.ts); yapay zekâ olmadığı açıkça yazılır.
 */
export function RuleBasedSuggestions({
  data,
  failed,
  hideNumbers,
}: {
  data: MealSuggestions | undefined;
  failed: boolean;
  hideNumbers: boolean;
}) {
  return (
    <section aria-labelledby="rule-suggestions-title" className="p-4 bg-white border border-slate-200 rounded-xl text-sm space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <ListChecks className="w-4 h-4 text-slate-500" />
        <h3 id="rule-suggestions-title" className="font-bold text-slate-900">
          Model olmadan öneri
        </h3>
        <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Yapay zekâ değil</span>
      </div>
      <p className="text-xs text-slate-500">
        Kayıtlı öğün ve tariflerin, bugün kalan kalori ve makrolarına göre kurallarla sıralandı.
        {data && !hideNumbers && ` Bugün kalan: ${macros(data.remaining)}.`}
      </p>
      {failed && <p className="text-xs text-rose-700">Öneriler hazırlanamadı.</p>}
      {data && data.suggestions.length === 0 && (
        <p className="text-xs text-slate-600">
          <EmptyText data={data} hideNumbers={hideNumbers} />
        </p>
      )}
      {data && data.suggestions.length > 0 && (
        <ol className="space-y-1.5">
          {data.suggestions.map((s) => (
            <li key={`${s.source}:${s.id}`} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{s.name}</span>
                <span className="text-[10px] font-semibold text-slate-500">{SOURCE_LABEL[s.source]}</span>
              </div>
              <p className="text-xs text-slate-600">
                {hideNumbers
                  ? "Bugün kalan hedefine uyuyor."
                  : `${macros(s)} — Kalan kalori payı ${pct(s.kcalShare)} · kalan protein payı ${pct(s.proteinShare)}`}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

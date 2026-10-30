"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { queryKeys } from "@/lib/client/queries/keys";

const KEY = ["catalog", "turkish"] as const;

/** F74: Türk ev yemekleri paketi kurulu değilse tek tıkla eklenir. */
export function TurkishCatalogBanner() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: KEY, queryFn: () => apiFetch<{ dishes: number; installed: number }>("/api/catalog/turkish") });
  const [done, setDone] = useState<string | null>(null);
  const install = useMutation({
    mutationFn: () => apiFetch<{ foodsCreated: number; recipesCreated: number }>("/api/catalog/turkish", { method: "POST" }),
    onSuccess: (r) => {
      setDone(`${r.recipesCreated} tarif eklendi${r.foodsCreated ? `, ${r.foodsCreated} malzeme kataloğa girdi` : ""}.`);
      return Promise.all([
        qc.invalidateQueries({ queryKey: KEY }),
        qc.invalidateQueries({ queryKey: queryKeys.recipes }),
        qc.invalidateQueries({ queryKey: queryKeys.foods.all }),
      ]);
    },
  });
  const s = status.data;

  return (
    <>
      {done && (
        <p role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          {done}
        </p>
      )}
      {s && s.installed < s.dishes && (
        <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-amber-900">
            <span className="font-bold">Türk ev yemekleri:</span> mercimek çorbası, bulgur pilavı, kuru fasulye, karnıyarık, lahmacun,
            ayran ve diğerleri. Değerler tarif malzemelerinden hesaplanır; kendi tarifine göre düzenleyebilirsin.
          </p>
          <button
            type="button"
            disabled={install.isPending}
            onClick={() => install.mutate()}
            className="shrink-0 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
          >
            Türk ev yemeklerini ekle ({s.dishes - s.installed} tarif)
          </button>
        </div>
      )}
      {install.isError && (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(install.error, "Eklenemedi.")}
        </p>
      )}
    </>
  );
}

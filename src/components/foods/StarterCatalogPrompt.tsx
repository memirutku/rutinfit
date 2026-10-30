"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { errorMessage } from "@/lib/client/api";
import { useInstallStarterCatalog } from "@/lib/client/queries/catalog";
import { formatNumberTr } from "@/lib/format";

/** Yeni besin formunu açan adres (Besin & Tarif sayfası `?yeni=1` ile formu açar). */
export const NEW_FOOD_HREF = "/foods?yeni=1";

interface StarterCatalogPromptProps {
  /** Verilirse "Yeni besin ekle" bu işlevi çağırır; yoksa Besin & Tarif sayfasına gider. */
  onNewFood?: () => void;
  /** Kurulum bitince çağrılır (ör. yazarak eklemede metin yeniden çözümlenir). */
  onInstalled?: () => void;
}

/**
 * B01: Katalog boşken hızlı eklemede, yazarak eklemede ve katalog sekmesinde çıkar: tek tıkla
 * başlangıç kataloğu (temel besinler, Türk ev yemekleri, simit ve ekmek) ya da kendi besinin.
 */
export function StarterCatalogPrompt({ onNewFood, onInstalled }: StarterCatalogPromptProps) {
  const install = useInstallStarterCatalog();
  const done = install.data;

  return (
    <div role="region" aria-label="Katalog boş" className="p-4 rounded-2xl border border-amber-200 bg-amber-50 space-y-3">
      <div className="flex items-start gap-2">
        <BookOpen className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" />
        <p className="text-xs text-amber-900">
          <span className="font-bold">Besin kataloğun boş.</span> Başlangıç kataloğunda temel besinler, Türk ev yemekleri (mercimek
          çorbası, kuru fasulye, pilav…) ve simit, ekmek gibi hızlı kalemler var. Değerleri sonra düzenleyebilirsin.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={install.isPending}
          onClick={() => install.mutate(undefined, { onSuccess: () => onInstalled?.() })}
          className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
        >
          {install.isPending ? "Yükleniyor…" : "Başlangıç kataloğunu yükle"}
        </button>
        {onNewFood ? (
          <button type="button" onClick={onNewFood} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700">
            Yeni besin ekle
          </button>
        ) : (
          <Link href={NEW_FOOD_HREF} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700">
            Yeni besin ekle
          </Link>
        )}
      </div>
      {done && (
        <p role="status" className="text-xs font-semibold text-emerald-800">
          {formatNumberTr(done.foodsCreated)} besin ve {formatNumberTr(done.recipesCreated)} tarif eklendi.
        </p>
      )}
      {install.isError && (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(install.error, "Katalog yüklenemedi.")}
        </p>
      )}
    </div>
  );
}

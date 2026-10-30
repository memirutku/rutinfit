"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { useCreateRecipe } from "@/lib/client/queries/nutrition";
import type { RecipePreview } from "@/lib/services/recipe-import";

const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";

/**
 * F33: Tarif adresinden içe aktarma. Sunucu sayfadaki schema.org tarifini okur ve malzemeleri
 * katalogla eşler; kullanıcı önizlemede düzeltip onaylar.
 */
export function RecipeImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<RecipePreview | null>(null);
  const [name, setName] = useState("");
  const [grams, setGrams] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateRecipe();
  const usable = (preview?.ingredients ?? [])
    .map((i, idx) => ({ i, idx, grams: grams[idx] ?? i.grams ?? 0 }))
    .filter((x) => x.i.match && x.grams > 0);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const p = await apiFetch<RecipePreview>("/api/recipes/import-url", { method: "POST", json: { url } });
      setPreview(p);
      setName(p.name);
      setGrams({});
    } catch (e) {
      setError(errorMessage(e, "Tarif getirilemedi."));
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setUrl("");
    setPreview(null);
    setError(null);
    onClose();
  }

  function save() {
    if (!preview) return;
    create.mutate(
      {
        name: name.trim() || preview.name,
        servings: preview.servings,
        prepMinutes: preview.prepMinutes,
        instructions: [preview.instructions, `Kaynak: ${preview.sourceUrl}`].filter(Boolean).join("\n\n"),
        tags: ["İçe aktarıldı"],
        ingredients: usable.map((x) => ({ foodItemId: x.i.match!.id, grams: x.grams })),
      },
      { onSuccess: close, onError: (e) => setError(errorMessage(e, "Tarif kaydedilemedi.")) }
    );
  }

  return (
    <Modal open={open} onClose={close} title="Adresten tarif ekle" description="Tarif sitesinin adresini yapıştır. Sayfa yalnız bu istek için açılır." widthClass="max-w-2xl">
      <div className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="recipe-url" className="block text-xs font-semibold text-slate-600 mb-1">
              Tarif adresi
            </label>
            <input id="recipe-url" type="url" value={url} placeholder="https://..." onChange={(e) => setUrl(e.target.value)} className={INPUT} />
          </div>
          <button type="button" disabled={!url.trim() || loading} onClick={load} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-50">
            {loading ? "Getiriliyor..." : "Getir"}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-rose-700">
            {error}
          </p>
        )}
        {preview && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label htmlFor="recipe-import-name" className="block text-xs font-semibold text-slate-600 mb-1">
                  Tarif adı
                </label>
                <input id="recipe-import-name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
              </div>
              <p className="text-xs text-slate-500 self-end pb-2">
                {preview.servings} porsiyon · {preview.prepMinutes} dk
              </p>
            </div>
            <ul aria-label="Malzemeler" className="space-y-1.5 text-xs">
              {preview.ingredients.map((i, idx) => (
                <li key={`${idx}:${i.raw}`} className={`p-2 rounded-lg border ${i.match ? "border-slate-200" : "border-amber-200 bg-amber-50"}`}>
                  <span className="font-mono text-slate-500">{i.raw}</span>
                  {i.match && (
                    <span className="mt-1 flex items-center gap-2">
                      <span className="flex-1 font-semibold text-slate-800">→ {i.match.name}</span>
                      <DecimalInput
                        aria-label={`${i.raw} gramı`}
                        value={grams[idx] ?? i.grams}
                        onValueChange={(v) => setGrams((g) => ({ ...g, [idx]: v }))}
                        className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <span className="text-slate-500">g</span>
                    </span>
                  )}
                  {i.note && <span className="block mt-1 text-amber-800">{i.note}</span>}
                </li>
              ))}
            </ul>
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button type="button" disabled={!usable.length || create.isPending} onClick={save} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50">
                Tarifi kaydet ({usable.length} malzeme)
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

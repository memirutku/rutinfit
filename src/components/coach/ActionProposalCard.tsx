"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Calculator, Check, Clock, Dumbbell, Edit3, ShieldCheck, Utensils } from "lucide-react";
import { keyedBy } from "@/lib/client/keys";
import type { CardProposal, MealCardProposal, WorkoutCardProposal } from "./types";
import { formatNumberTr } from "@/lib/format";

export interface ProposalActionState {
  isApplied: boolean;
  isEditing: boolean;
  isBusy: boolean;
}

interface ActionProposalCardProps extends ProposalActionState {
  proposal: CardProposal;
  onApprove: () => void;
  onReject: () => void;
  onToggleEdit: () => void;
  onEditTitle: (value: string) => void;
}

/**
 * B29: katalogla eşleşme durumu. "all": hiçbir malzeme katalogda yok (kalori hesaplanamaz);
 * "some": toplam eksikler hariç; "none": hepsi hesaplandı.
 */
export function missingState(proposal: CardProposal): "none" | "some" | "all" {
  if (proposal.type !== "meal_proposal" || !proposal.deterministicMacros) return "none";
  const missing = proposal.deterministicMacros.missingIngredients.length;
  if (missing === 0) return "none";
  const total = proposal.ingredients?.length ?? missing;
  return missing >= total ? "all" : "some";
}

function MealProposalBody({ proposal }: { proposal: MealCardProposal }) {
  // Plana yazılacak değer katalogdan hesaplanandır; model tahmini yalnız yedek.
  const det = proposal.deterministicMacros;
  const missing = missingState(proposal);
  const macros = det
    ? { calories: det.totalCalories, proteinG: det.totalProteinG, carbsG: det.totalCarbsG, fatG: det.totalFatG }
    : proposal.estimatedMacros;
  return (
    <>
      <p className="text-slate-600 italic">&quot;{proposal.rationale}&quot;</p>

      {missing === "all" ? (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded">Kalori hesaplanamadı</span>
          {proposal.estimatedMacros && (
            <span className="text-[10px] text-slate-500">(model tahmini: {formatNumberTr(proposal.estimatedMacros.calories)} kcal)</span>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="px-2 py-0.5 bg-orange-50 text-orange-700 font-bold rounded">{formatNumberTr(macros?.calories ?? 0)} kcal</span>
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded">P: {formatNumberTr(macros?.proteinG ?? 0)}g</span>
          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-medium rounded">K: {formatNumberTr(macros?.carbsG ?? 0)}g</span>
          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-medium rounded">Y: {formatNumberTr(macros?.fatG ?? 0)}g</span>
          {!det && <span className="text-[10px] text-slate-400">(model tahmini)</span>}
          {missing === "some" && <span className="text-[10px] text-amber-700">(eksik malzemeler hariç)</span>}
        </div>
      )}
      {det && missing !== "none" && (
        <div role="note" className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 space-y-1">
          <p>Katalogda bulunamadı: {det.missingIngredients.join(", ")}.</p>
          <p>
            {missing === "all"
              ? "Onaylarsan öğün plana yalnız adıyla eklenir; kalori ve alışveriş listesi boş kalır."
              : "Onaylarsan tarif katalogdaki malzemelerle kurulur; eksikler kaloriye ve alışveriş listesine girmez."}{" "}
            İstersen önce eksikleri kataloğa ekle.
          </p>
          <Link href="/foods" className="inline-block font-semibold text-brand-700 underline">
            Eksikleri kataloğa ekle
          </Link>
        </div>
      )}

      {proposal.ingredients && (
        <div className="bg-slate-50 p-2.5 rounded-lg text-slate-600 space-y-1">
          <div className="font-semibold text-slate-700">Malzemeler & Porsiyon:</div>
          {keyedBy(proposal.ingredients, (ing) => `${ing.foodName}:${ing.grams}`).map(({ key, item: ing }) => (
            <div key={key} className="flex justify-between text-slate-600">
              <span>• {ing.foodName}</span>
              <span className="font-bold">{formatNumberTr(ing.grams)}g</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function WorkoutAdjustmentBody({ proposal }: { proposal: WorkoutCardProposal }) {
  return (
    <>
      <p className="text-slate-600 italic">&quot;{proposal.reason}&quot;</p>
      <div className="text-slate-500 flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" />
        <span>Hedef Süre: {proposal.targetDurationMinutes} dakika</span>
      </div>
      {proposal.exercises && (
        <div className="bg-slate-50 p-2.5 rounded-lg text-slate-600 space-y-1">
          <div className="font-semibold text-slate-700">Egzersizler:</div>
          {keyedBy(proposal.exercises, (ex) => ex.exerciseName).map(({ key, item: ex }) => (
            <div key={key} className="flex justify-between">
              <span>• {ex.exerciseName}</span>
              <span className="font-bold">
                {ex.sets} set × {ex.repMin}-{ex.repMax} tekrar
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Modelin önerdiği eylem taslağı: içerik, düzenleme alanı ve iki aşamalı onay düğmeleri. */
export function ActionProposalCard({
  proposal,
  isApplied,
  isEditing,
  isBusy,
  onApprove,
  onReject,
  onToggleEdit,
  onEditTitle,
}: ActionProposalCardProps) {
  const missing = missingState(proposal);
  const approveLabel =
    missing === "all" ? "Yalnız adıyla plana ekle" : missing === "some" ? "Katalogdakilerle plana ekle" : "Onayla ve Plana Ekle";
  return (
    <div className="p-4 bg-white rounded-xl border border-brand-200 shadow-sm space-y-3 text-xs">
      {/* Kart Başlığı ve Veri Doğrulama Rozetleri */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
          {proposal.type === "meal_proposal" ? (
            <Utensils className="w-4 h-4 text-brand-600" />
          ) : (
            <Dumbbell className="w-4 h-4 text-indigo-600" />
          )}
          <span>{proposal.title}</span>
        </div>
        <div className="flex items-center gap-1">
          {isApplied ? (
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-700" />
              Onaylandı
            </span>
          ) : (
            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Onay Bekliyor
            </span>
          )}
          {proposal.type === "meal_proposal" && proposal.deterministicMacros && missing === "none" && (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
              <Calculator className="w-3 h-3 text-emerald-600" />
              Hesaplandı
            </span>
          )}
          {missing !== "none" && (
            <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              Eksik malzeme
            </span>
          )}
        </div>
      </div>

      {proposal.type === "meal_proposal" && <MealProposalBody proposal={proposal} />}
      {proposal.type === "workout_adjustment" && <WorkoutAdjustmentBody proposal={proposal} />}

      {/* Düzenleme Alanı */}
      {isEditing && (
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
          <div className="font-bold text-amber-900 text-xs">Taslağı Düzenle:</div>
          <input
            type="text"
            placeholder="Başlık / İsim"
            defaultValue={proposal.title}
            onChange={(e) => onEditTitle(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded"
          />
        </div>
      )}

      {/* Eylem Butonları Grubu */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <div>
          {!isApplied && (
            <button onClick={onReject} className="text-xs text-slate-400 hover:text-slate-600 font-medium underline">
              Vazgeç
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isApplied && (
            <button
              onClick={onToggleEdit}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
            >
              <Edit3 className="w-3 h-3" />
              <span>{isEditing ? "Kapat" : "Düzenle"}</span>
            </button>
          )}

          <button
            disabled={isApplied || isBusy}
            onClick={onApprove}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              isApplied
                ? "bg-emerald-100 text-emerald-800 cursor-default"
                : "bg-slate-900 text-white hover:bg-slate-800 shadow-xs"
            }`}
          >
            {isApplied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Plana Eklendi ✓</span>
              </>
            ) : (
              <>
                <ArrowRight className="w-3.5 h-3.5" />
                <span>{approveLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { ArrowRight, Calculator, Check, Clock, Dumbbell, Edit3, ShieldCheck, Utensils } from "lucide-react";
import { keyedBy } from "@/lib/client/keys";
import type { CardProposal, MealCardProposal, WorkoutCardProposal } from "./types";

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

function MealProposalBody({ proposal }: { proposal: MealCardProposal }) {
  // Plana yazılacak değer katalogdan hesaplanandır; model tahmini yalnız yedek.
  const det = proposal.deterministicMacros;
  const macros = det
    ? { calories: det.totalCalories, proteinG: det.totalProteinG, carbsG: det.totalCarbsG, fatG: det.totalFatG }
    : proposal.estimatedMacros;
  return (
    <>
      <p className="text-slate-600 italic">&quot;{proposal.rationale}&quot;</p>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="px-2 py-0.5 bg-orange-50 text-orange-700 font-bold rounded">{macros?.calories} kcal</span>
        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded">P: {macros?.proteinG}g</span>
        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-medium rounded">K: {macros?.carbsG}g</span>
        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-medium rounded">Y: {macros?.fatG}g</span>
        {!det && <span className="text-[10px] text-slate-400">(model tahmini)</span>}
      </div>
      {det && det.missingIngredients.length > 0 && (
        <p role="note" className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Katalogda bulunamadı, toplama dahil değil: {det.missingIngredients.join(", ")}
        </p>
      )}

      {proposal.ingredients && (
        <div className="bg-slate-50 p-2.5 rounded-lg text-slate-600 space-y-1">
          <div className="font-semibold text-slate-700">Malzemeler & Porsiyon:</div>
          {keyedBy(proposal.ingredients, (ing) => `${ing.foodName}:${ing.grams}`).map(({ key, item: ing }) => (
            <div key={key} className="flex justify-between text-slate-600">
              <span>• {ing.foodName}</span>
              <span className="font-bold">{ing.grams}g</span>
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
  return (
    <div className="p-4 bg-white rounded-xl border border-brand-200 shadow-sm space-y-3 text-xs">
      {/* Kart Başlığı ve Veri Doğrulama Rozetleri */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
          {proposal.type === "meal_proposal" ? (
            <Utensils className="w-4 h-4 text-brand-600" />
          ) : (
            <Dumbbell className="w-4 h-4 text-indigo-600" />
          )}
          <span>{proposal.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Onay Bekliyor
          </span>
          {proposal.type === "meal_proposal" && proposal.deterministicMacros && (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
              <Calculator className="w-3 h-3 text-emerald-600" />
              Hesaplandı
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
                <span>Onayla ve Plana Ekle</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

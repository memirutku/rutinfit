"use client";

import { useState } from "react";
import { Calendar, CalendarDays, ShoppingCart, Utensils } from "lucide-react";
import { getLocalDateString } from "@/lib/date-utils";
import { useTimedMessage } from "@/hooks/useTimedMessage";
import { useShoppingList } from "@/lib/client/queries/shopping";
import { useProfile } from "@/lib/client/queries/system";
import { targetSummary } from "@/components/nutrition/target-summary";
import { MealPlanTab } from "@/components/nutrition/MealPlanTab";
import { ShoppingListTab } from "@/components/nutrition/ShoppingListTab";
import { MealPrepGuide } from "@/components/nutrition/MealPrepGuide";
import { WeekPlanEditor } from "@/components/nutrition/WeekPlanEditor";

type NutritionTab = "plan" | "week" | "shopping" | "prep";

const TABS: { id: NutritionTab; label: string; Icon: typeof Utensils }[] = [
  { id: "plan", label: "Yemek Planı", Icon: Utensils },
  { id: "week", label: "Hafta", Icon: CalendarDays },
  { id: "shopping", label: "Alışveriş Listesi", Icon: ShoppingCart },
  { id: "prep", label: "Meal-Prep Rehberi", Icon: Calendar },
];

export default function NutritionPage() {
  const [activeTab, setActiveTab] = useState<NutritionTab>("plan");
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [portionMultipliers, setPortionMultipliers] = useState<Record<string, number>>({});
  const notice = useTimedMessage<string>(4000);
  const profile = useProfile();
  const summary = targetSummary(profile.data);

  // Haftanın listesi sayfa açılınca (gerekirse plandan kurularak) bir kez yüklenir.
  const shopping = useShoppingList(selectedDate);

  const showMessage = (text: string, ms?: number) => notice.show(text, ms);

  return (
    <div className="space-y-6">
      {/* Üst Başlık ve Sekmeler */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Beslenme & Yemek Planı 🥗</h2>
          {summary && <p className="text-sm text-slate-500 mt-0.5">{summary}</p>}
        </div>

        {/* Sekme Butonları */}
        <div className="flex p-1 bg-slate-100 rounded-xl">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {notice.message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium">
          {notice.message}
        </div>
      )}

      {/* F30: HAFTALIK PLAN EDİTÖRÜ */}
      {activeTab === "week" && <WeekPlanEditor selectedDate={selectedDate} />}

      {/* 1. SEKME: YEMEK PLANI */}
      {activeTab === "plan" && (
        <MealPlanTab
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          multipliers={portionMultipliers}
          onMultiplierChange={(mealId, m) => setPortionMultipliers((prev) => ({ ...prev, [mealId]: m }))}
          onMessage={showMessage}
          onOpenWeek={() => setActiveTab("week")}
          ramadan={profile.data?.ramadanMode ?? false}
          hideNumbers={profile.data?.hideNumbers ?? false}
        />
      )}

      {/* 2. SEKME: HAFTALIK ALIŞVERİŞ LİSTESİ */}
      {activeTab === "shopping" && (
        <ShoppingListTab
          weekDate={selectedDate}
          list={shopping.data}
          isLoading={shopping.isPending}
          onMessage={showMessage}
        />
      )}

      {/* 3. SEKME: PAZAR GÜNÜ MEAL-PREP REHBERİ */}
      {activeTab === "prep" && <MealPrepGuide />}
    </div>
  );
}

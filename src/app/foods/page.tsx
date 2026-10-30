"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/client/api";
import { useCreateFoodLog, useFoods, useRecipes, useSavePackagedProduct } from "@/lib/client/queries/nutrition";
import { useTimedMessage } from "@/hooks/useTimedMessage";
import { useToday } from "@/hooks/useToday";
import type { PackagedProduct } from "@/lib/schemas/food";
import { ActionNotice } from "@/components/foods/ActionNotice";
import { FoodCatalogTab } from "@/components/foods/FoodCatalogTab";
import { FoodsHeader } from "@/components/foods/FoodsHeader";
import { NewFoodModal } from "@/components/foods/NewFoodModal";
import { NewRecipeModal } from "@/components/foods/NewRecipeModal";
import { PackagedFoodTab } from "@/components/foods/PackagedFoodTab";
import { RecipesTab } from "@/components/foods/RecipesTab";
import { usePackagedSearch } from "@/components/foods/usePackagedSearch";
import type { FoodsNotice, FoodsTab } from "@/components/foods/constants";
import { formatNumberTr } from "@/lib/format";
import { isBarcode } from "@/components/foods/constants";

export default function FoodsPage() {
  const [activeTab, setActiveTab] = useState<FoodsTab>("foods");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [packagedInput, setPackagedInput] = useState("");
  const [newFood, setNewFood] = useState<{ open: boolean; prefillName?: string; prefillBarcode?: string }>({ open: false });
  const [isNewRecipeOpen, setIsNewRecipeOpen] = useState(false);

  const foodsQuery = useFoods(200);
  const recipesQuery = useRecipes();
  const foods = foodsQuery.data ?? [];
  const recipes = recipesQuery.data ?? [];
  const loadFailure = foodsQuery.error ?? recipesQuery.error;

  const packaged = usePackagedSearch();
  const saveProduct = useSavePackagedProduct();
  const createFoodLog = useCreateFoodLog();
  const notice = useTimedMessage<FoodsNotice>(4000);
  const today = useToday();

  /** Paketli gıda aramasından manuel ekleme: barkodsa etiketten giriş (F03), değilse aranan adla. */
  const openManualAdd = () => {
    const digits = packagedInput.trim();
    setNewFood(isBarcode(digits) ? { open: true, prefillBarcode: digits } : { open: true, prefillName: packagedInput });
  };

  async function handleImportToCatalog(product: PackagedProduct) {
    try {
      await saveProduct.mutateAsync({
        barcode: product.barcode,
        name: product.name,
        brand: product.brand,
        basisGrams: product.basisGrams || 100,
        calories: product.calories,
        proteinG: product.proteinG,
        carbsG: product.carbsG,
        fatG: product.fatG,
        category: product.categories?.[0] || "Paketli Gıda",
        confidence: product.confidence || "Yüksek",
      });
      notice.show({ type: "success", text: `"${product.name}" başarıyla yerel kataloğunuza kaydedildi.` });
    } catch (err) {
      notice.show({ type: "error", text: errorMessage(err, "Hata oluştu.") });
    }
  }

  /** Ürünü katalog dışı (anlık değerlerle) bugünkü günlüğe ekler. */
  async function handleLogProductAsMeal(product: PackagedProduct, grams = 100) {
    const factor = grams / (product.basisGrams || 100);
    try {
      await createFoodLog.mutateAsync({
        date: today,
        time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        mealType: "extra",
        name: product.brand ? `${product.brand} - ${product.name}` : product.name,
        grams,
        caloriesSnapshot: Math.round(product.calories * factor),
        proteinSnapshot: Math.round(product.proteinG * factor * 10) / 10,
        carbsSnapshot: Math.round(product.carbsG * factor * 10) / 10,
        fatSnapshot: Math.round(product.fatG * factor * 10) / 10,
      });
      notice.show({ type: "success", text: `"${product.name}" (${formatNumberTr(grams)}g) bugünkü günlüğe eklendi!` });
    } catch (err) {
      notice.show({ type: "error", text: errorMessage(err, "Öğün kaydedilemedi.") });
    }
  }

  return (
    <div className="space-y-6">
      <FoodsHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        foodsCount={foods.length}
        recipesCount={recipes.length}
        onNewFood={() => setNewFood({ open: true })}
        onNewRecipe={() => setIsNewRecipeOpen(true)}
        onManualAdd={openManualAdd}
      />

      <ActionNotice notice={notice.message} />

      {activeTab === "packaged" && (
        <PackagedFoodTab
          input={packagedInput}
          onInputChange={setPackagedInput}
          onSearch={packaged.search}
          loading={packaged.loading}
          error={packaged.error}
          results={packaged.results}
          onManualAdd={openManualAdd}
          onLogMeal={handleLogProductAsMeal}
          onImport={handleImportToCatalog}
        />
      )}

      {activeTab === "foods" && (
        <FoodCatalogTab
          foods={foods}
          loading={foodsQuery.isPending || recipesQuery.isPending}
          loadError={loadFailure ? errorMessage(loadFailure, "Besin kataloğu yüklenemedi.") : null}
          search={search}
          onSearchChange={setSearch}
          category={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      )}

      {activeTab === "recipes" && <RecipesTab recipes={recipes} />}

      <NewFoodModal
        open={newFood.open}
        prefillName={newFood.prefillName}
        prefillBarcode={newFood.prefillBarcode}
        onCreated={(food) => {
          notice.show({ type: "success", text: `"${food.name}" yerel kataloğa eklendi.` });
          // F03: barkodlu ürün kaydedilince arama yenilenir; ürün artık yerel katalogdan gelir.
          if (food.barcode) packaged.search(food.barcode);
        }}
        onClose={() => setNewFood({ open: false })}
      />
      <NewRecipeModal open={isNewRecipeOpen} onClose={() => setIsNewRecipeOpen(false)} foods={foods} />
    </div>
  );
}

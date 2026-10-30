import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickAddModal } from "@/components/dashboard/QuickAddModal";
import { NaturalLogModal } from "@/components/dashboard/NaturalLogModal";
import { FoodCatalogTab } from "@/components/foods/FoodCatalogTab";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const lentilFood = { id: "f1", name: "Kırmızı Mercimek (çiğ)", calories: 340, basisGrams: 100, confidence: "Yüksek" };
const soup = {
  id: "r1",
  name: "Mercimek Çorbası",
  instructions: null,
  prepMinutes: 40,
  servings: 8,
  ingredients: [
    { id: "i1", foodItemId: "f1", grams: 250, foodItem: { ...lentilFood, category: "Bakliyatlar", brand: null, barcode: null, proteinG: 24, carbsG: 57, fatG: 1.2, source: "T", confidence: "Yüksek" } },
    { id: "i2", foodItemId: "w", grams: 1750, foodItem: { id: "w", name: "İçme Suyu", category: "Diğer", brand: null, barcode: null, basisGrams: 100, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, source: "T", confidence: "Yüksek" } },
  ],
  calculatedMacros: { calories: 850, proteinG: 60, carbsG: 142.5, fatG: 3 },
};

describe("B01: boş katalog", () => {
  it("hızlı eklemede katalog boşsa başlangıç kataloğu önerilir ve tek tıkla yüklenir", async () => {
    const s = stubFetch([
      ["/api/recipes", () => jsonResponse([])],
      ["/api/catalog/starter", () => jsonResponse({ foodsCreated: 46, recipesCreated: 16 }, 201)],
    ]);
    restore = s.restore;
    renderWithQuery(<QuickAddModal open onClose={vi.fn()} foods={[]} isLoadingFoods={false} recentFoods={[]} onSubmit={vi.fn()} />);
    const region = await screen.findByRole("region", { name: "Katalog boş" });
    expect(region.textContent).toContain("Besin kataloğun boş");
    expect(screen.getByRole("link", { name: "Yeni besin ekle" }).getAttribute("href")).toBe("/foods?yeni=1");
    fireEvent.click(screen.getByRole("button", { name: "Başlangıç kataloğunu yükle" }));
    expect(await screen.findByText("46 besin ve 16 tarif eklendi.")).toBeTruthy();
    expect(s.calls.some((c) => c.url.includes("/api/catalog/starter") && c.init?.method === "POST")).toBe(true);
  });

  it("katalog sekmesi boşken yükleme ve yeni besin seçeneği gösterir; aramada boş sonuç ayrı mesajdır", () => {
    const onNewFood = vi.fn();
    const props = { loading: false, loadError: null, search: "", onSearchChange: vi.fn(), category: "all", onCategoryChange: vi.fn(), onNewFood };
    const { rerender } = renderWithQuery(<FoodCatalogTab foods={[]} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Yeni besin ekle" }));
    expect(onNewFood).toHaveBeenCalled();
    rerender(<FoodCatalogTab foods={[{ ...lentilFood, category: "Bakliyatlar", brand: null, barcode: null, proteinG: 24, carbsG: 57, fatG: 1.2, source: "T" }]} {...props} search="ejder" />);
    expect(screen.queryByRole("region", { name: "Katalog boş" })).toBeNull();
    expect(screen.getByText("Aramanıza uyan besin bulunamadı.")).toBeTruthy();
  });

  it("yazarak eklemede katalog boşsa öneri çıkar; yükleyince metin yeniden çözümlenir", async () => {
    let installed = false;
    const s = stubFetch([
      ["/api/profile", () => jsonResponse({ ramadanMode: false })],
      ["/api/catalog/starter", () => ((installed = true), jsonResponse({ foodsCreated: 46, recipesCreated: 16 }, 201))],
      [
        "/api/food-logs/parse",
        () =>
          jsonResponse(
            installed
              ? { items: [{ raw: "1 kase mercimek çorbası", quantity: 1, unit: "kase", match: { type: "recipe", id: "r1", name: "Mercimek Çorbası" }, alternatives: [], grams: 250, macros: { calories: 106, proteinG: 7.5, carbsG: 17.8, fatG: 0.4 } }], catalogEmpty: false }
              : { items: [{ raw: "1 kase mercimek çorbası", quantity: 1, unit: "kase", match: null, alternatives: [], grams: null, macros: null, note: "bulunamadı" }], catalogEmpty: true },
          ),
      ],
    ]);
    restore = s.restore;
    renderWithQuery(<NaturalLogModal open date="2026-10-30" defaultMealType="lunch" onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Ne yedin?"), { target: { value: "1 kase mercimek çorbası" } });
    fireEvent.click(screen.getByRole("button", { name: "Çözümle" }));
    await screen.findByRole("region", { name: "Katalog boş" });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Başlangıç kataloğunu yükle" })));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Katalog boş" })).toBeNull());
    expect(screen.getByRole("button", { name: "1 kalemi kaydet" })).toBeTruthy();
  });

  it("hızlı eklemede tarif aranır ve porsiyonla kaydedilir (çiğ mercimekten önce gelir)", async () => {
    restore = stubFetch([["/api/recipes", () => jsonResponse([soup])]]).restore;
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithQuery(<QuickAddModal open onClose={vi.fn()} foods={[lentilFood]} isLoadingFoods={false} recentFoods={[]} initialMealType="lunch" onSubmit={onSubmit} />);
    await screen.findByRole("option", { name: /Mercimek Çorbası/ });
    fireEvent.change(screen.getByLabelText("Besin ara"), { target: { value: "mercimek" } });
    expect(screen.getByLabelText<HTMLSelectElement>("Besin Seçin").value).toBe("recipe:r1");
    expect(screen.getByLabelText<HTMLSelectElement>("Birim").value).toBe("porsiyon");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ekle" })));
    expect(onSubmit).toHaveBeenCalledWith({ foodItemId: "", recipeId: "r1", name: "Mercimek Çorbası", grams: 250, mealType: "lunch" });
  });
});

describe("B01: hızlı eklemede varsayılan seçim", () => {
  it("tarifler besinlerden önce yüklense de aramasız açılışta ilk besin seçilir", async () => {
    restore = stubFetch([["/api/recipes", () => jsonResponse([soup])]]).restore;
    const props = { open: true, onClose: vi.fn(), recentFoods: [], onSubmit: vi.fn() };
    const { rerender } = renderWithQuery(<QuickAddModal {...props} foods={[]} isLoadingFoods />);
    await screen.findByRole("option", { name: /Mercimek Çorbası/ });
    expect(screen.getByLabelText<HTMLSelectElement>("Besin Seçin").value).toBe("");
    rerender(<QuickAddModal {...props} foods={[lentilFood]} isLoadingFoods={false} />);
    expect(screen.getByLabelText<HTMLSelectElement>("Besin Seçin").value).toBe("f1");
    expect(screen.getByLabelText("Miktar (Gram)")).toBeTruthy();
  });
});

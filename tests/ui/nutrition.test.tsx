import { useState } from "react";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShoppingListTab } from "@/components/nutrition/ShoppingListTab";
import { useShoppingList } from "@/lib/client/queries/shopping";
import { MealPlanTab } from "@/components/nutrition/MealPlanTab";
import { DEFAULT_MEAL_TEMPLATES, PlannedMealCard } from "@/components/nutrition/PlannedMealCard";
import { MealPrepGuide } from "@/components/nutrition/MealPrepGuide";
import NutritionPage from "@/app/nutrition/page";
import type { ShoppingList } from "@/lib/schemas/shopping";
import type { MealPlan } from "@/lib/schemas/meal-plan";
import { jsonResponse, stubFetch } from "../helpers/fetch";
import { renderWithQuery } from "../helpers/query";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const WEEK = "2026-10-19";
const shoppingList = (over: Partial<ShoppingList> = {}): ShoppingList => {
  const items = [
    { id: "s1", weekStart: WEEK, category: "Kuru Gıda", name: "Yulaf", amount: 300, unit: "g", checked: false },
    { id: "s2", weekStart: WEEK, category: "Manav", name: "Muz", amount: 1500, unit: "g", checked: true },
  ];
  return {
    weekStart: WEEK,
    items,
    grouped: { "Kuru Gıda": [items[0]], Manav: [items[1]] },
    generated: true,
    ...over,
  };
};

const bulgurPlan: MealPlan = {
  id: "p1",
  date: "2026-10-20",
  notes: null,
  meals: [
    {
      id: "m1",
      mealType: "breakfast",
      recipeId: "r1",
      customName: null,
      servings: 1,
      isCompleted: false,
      recipe: {
        id: "r1",
        name: "Bulgur Kasesi",
        instructions: null,
        prepMinutes: 15,
        servings: 1,
        ingredients: [
          {
            id: "i1",
            foodItemId: "f1",
            grams: 200,
            foodItem: {
              id: "f1", name: "Bulgur", category: "Kuru Gıda", brand: null, barcode: null, basisGrams: 100,
              calories: 200, proteinG: 10, carbsG: 30, fatG: 5, source: "Katalog", confidence: "Yüksek",
            },
          },
        ],
      },
      calculatedMacros: { calories: 400, proteinG: 20, carbsG: 60, fatG: 10 },
    },
  ],
};

/** Sayfadaki gibi: liste sorgusu dışarıda, sekme sonucu prop olarak alır. */
function ShoppingHarness({ onMessage }: { onMessage: (text: string, ms?: number) => void }) {
  const shopping = useShoppingList("2026-10-20");
  return <ShoppingListTab weekDate="2026-10-20" list={shopping.data} isLoading={shopping.isPending} onMessage={onMessage} />;
}

describe("ShoppingListTab", () => {
  it("işaret anında değişir; sunucu 500 dönerse geri alınır ve hata bildirilir", async () => {
    const put = deferred<Response>();
    const s = stubFetch([
      [/\/api\/shopping\?weekStart=/, () => jsonResponse(shoppingList())],
      ["/api/shopping", () => put.promise],
    ]);
    restore = s.restore;
    const onMessage = vi.fn();
    renderWithQuery(<ShoppingHarness onMessage={onMessage} />);

    const row = await screen.findByRole("checkbox", { name: /Yulaf/ });
    expect(row.textContent).toContain("300 g");
    expect(row.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(row);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /Yulaf/ }).getAttribute("aria-checked")).toBe("true"));
    const putCall = s.calls.find((c) => c.init?.method === "PUT");
    expect(JSON.parse(String(putCall?.init?.body))).toEqual({ id: "s1", checked: true });

    await act(async () => put.resolve(jsonResponse({ error: "Sunucu hatası" }, 500)));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /Yulaf/ }).getAttribute("aria-checked")).toBe("false"));
    expect(onMessage).toHaveBeenCalledWith(expect.stringContaining("Sunucu hatası"), 4000);
  });

  it("klavyeyle (Boşluk) de işaretlenir", async () => {
    const s = stubFetch([
      [/\/api\/shopping\?weekStart=/, () => jsonResponse(shoppingList())],
      ["/api/shopping", (_u, init) => jsonResponse({ ...shoppingList().items[1], ...JSON.parse(String(init?.body)) })],
    ]);
    restore = s.restore;
    renderWithQuery(<ShoppingHarness onMessage={vi.fn()} />);
    const row = await screen.findByRole("checkbox", { name: /Muz/ });
    expect(row.textContent).toContain("1,5 kg");
    fireEvent.keyDown(row, { key: " " });
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /Muz/ }).getAttribute("aria-checked")).toBe("false"));
  });

  it("bu hafta liste yoksa plandan kiler düşülerek kurar ve kiler özetini gösterir", async () => {
    const s = stubFetch([
      [/\/api\/shopping\?weekStart=/, () => jsonResponse({ weekStart: WEEK, items: [], grouped: {}, generated: false })],
      ["/api/shopping", () => jsonResponse({ ...shoppingList({ generated: undefined }), pantrySummary: "1 kalem kilerden düşüldü." })],
    ]);
    restore = s.restore;
    renderWithQuery(<ShoppingHarness onMessage={vi.fn()} />);
    expect(await screen.findByText("1 kalem kilerden düşüldü.")).toBeTruthy();
    const post = s.calls.find((c) => c.init?.method === "POST");
    expect(JSON.parse(String(post?.init?.body))).toEqual({ weekStart: "2026-10-20", deductPantry: true });
  });

  it("'Kileri Düşerek Yenile' beklerken yükleniyor gösterir, bitince bildirir", async () => {
    const post = deferred<Response>();
    restore = stubFetch([
      [/\/api\/shopping\?weekStart=/, () => jsonResponse(shoppingList())],
      ["/api/shopping", () => post.promise],
    ]).restore;
    const onMessage = vi.fn();
    renderWithQuery(<ShoppingHarness onMessage={onMessage} />);
    await screen.findByRole("checkbox", { name: /Yulaf/ });

    fireEvent.click(screen.getByRole("button", { name: /Kileri Düşerek Yenile/ }));
    expect(await screen.findByText("Yükleniyor...")).toBeTruthy();
    await act(async () => post.resolve(jsonResponse({ ...shoppingList(), pantrySummary: "Kiler düşüldü." })));
    expect(await screen.findByText("Kiler düşüldü.")).toBeTruthy();
    expect(onMessage).toHaveBeenCalledWith("Alışveriş listesi kiler stokları düşülerek güncellendi! ✓", 3000);
  });
});

function MealPlanHarness({ onMessage }: { onMessage: (text: string, ms?: number) => void }) {
  const [multipliers, setMultipliers] = useState<Record<string, number>>({});
  return (
    <MealPlanTab
      selectedDate="2026-10-20"
      onDateChange={vi.fn()}
      multipliers={multipliers}
      onMultiplierChange={(type, m) => setMultipliers((p) => ({ ...p, [type]: m }))}
      onMessage={onMessage}
    />
  );
}

describe("MealPlanTab", () => {
  it("1.5x porsiyon gösterilen kaloriyle aynı porsiyonu (servings × 1.5) kaydeder", async () => {
    const s = stubFetch([
      ["/api/meal-plans", () => jsonResponse([bulgurPlan])],
      ["/api/food-logs", () => jsonResponse({ id: "log1" }, 201)],
    ]);
    restore = s.restore;
    const onMessage = vi.fn();
    renderWithQuery(<MealPlanHarness onMessage={onMessage} />);

    const heading = await screen.findByRole("heading", { name: "Bulgur Kasesi" });
    const card = heading.parentElement as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "1.5x" }));
    expect(card.textContent).toContain("600 kcal");
    expect(card.textContent).toContain("Malzemeler (1.5 porsiyon)");
    expect(card.textContent).toContain("300 g");

    fireEvent.click(within(card).getByRole("button", { name: "1.5x Porsiyon Olarak Kaydet" }));
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith(expect.stringContaining("günlüğe kaydedildi"), 3000));
    const body = JSON.parse(String(s.calls.find((c) => c.url.includes("/api/food-logs"))?.init?.body));
    expect(body).toMatchObject({ date: "2026-10-20", mealType: "breakfast", recipeId: "r1", name: "Bulgur Kasesi", servings: 1.5 });
    expect(onMessage.mock.calls[0][0]).toContain("600 kcal");
  });

  it("tarifi olmayan öğün kaydedilmez, yönlendirme mesajı gösterilir", async () => {
    const s = stubFetch([["/api/meal-plans", () => jsonResponse([])]]);
    restore = s.restore;
    const onMessage = vi.fn();
    renderWithQuery(<MealPlanHarness onMessage={onMessage} />);
    const heading = await screen.findByRole("heading", { name: DEFAULT_MEAL_TEMPLATES[1].example });
    fireEvent.click(within(heading.parentElement as HTMLElement).getByRole("button", { name: "Yedim Olarak Kaydet" }));
    expect(onMessage).toHaveBeenCalledWith(expect.stringContaining("Bu öğüne bağlı bir tarif yok"), 4000);
    expect(s.calls.some((c) => c.url.includes("/api/food-logs"))).toBe(false);
  });

  it("kayıt hatası mesajla bildirilir", async () => {
    restore = stubFetch([
      ["/api/meal-plans", () => jsonResponse([bulgurPlan])],
      ["/api/food-logs", () => jsonResponse({ error: "Gramaj hesaplanamadı." }, 400)],
    ]).restore;
    const onMessage = vi.fn();
    renderWithQuery(<MealPlanHarness onMessage={onMessage} />);
    const heading = await screen.findByRole("heading", { name: "Bulgur Kasesi" });
    fireEvent.click(within(heading.parentElement as HTMLElement).getByRole("button", { name: "Yedim Olarak Kaydet" }));
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith("Kaydedilemedi: Gramaj hesaplanamadı.", 4000));
  });
});

describe("F78: plana uyum", () => {
  it("planlı öğünde uygulandı/kısmen/atlandı işaretlenir; aynı düğme işareti kaldırır; haftalık özet görünür", async () => {
    const s = stubFetch([
      ["/api/meal-plans/adherence", (_u, init) =>
        init?.method === "PATCH" ? jsonResponse({ id: "pm1" }) : jsonResponse({ planned: 6, marked: 4, done: 3, partial: 1, skipped: 0, percent: 88 })],
      ["/api/meal-plans", () => jsonResponse([{ ...bulgurPlan, meals: [{ ...bulgurPlan.meals[0], adherence: "done" }] }])],
    ]);
    restore = s.restore;
    renderWithQuery(<MealPlanHarness onMessage={vi.fn()} />);
    expect(await screen.findByText(/Bu hafta plana uyum: %88/)).toBeTruthy();
    const heading = await screen.findByRole("heading", { name: "Bulgur Kasesi" });
    const card = heading.parentElement as HTMLElement;
    expect(within(card).getByRole("button", { name: "Uygulandı" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(within(card).getByRole("button", { name: "Kısmen" }));
    await waitFor(() => expect(s.calls.filter((c) => c.init?.method === "PATCH")).toHaveLength(1));
    fireEvent.click(within(card).getByRole("button", { name: "Uygulandı" }));
    await waitFor(() => expect(s.calls.filter((c) => c.init?.method === "PATCH")).toHaveLength(2));
    const bodies = s.calls.filter((c) => c.init?.method === "PATCH").map((c) => JSON.parse(String(c.init?.body)));
    expect(bodies).toEqual([
      { plannedMealId: bulgurPlan.meals[0].id, adherence: "partial" },
      { plannedMealId: bulgurPlan.meals[0].id, adherence: null },
    ]);
  });
});

describe("F31: serbest porsiyon çarpanı", () => {
  it("hazır düğmeler dışında istenen çarpan yazılabilir", () => {
    const onMultiplierChange = vi.fn();
    renderWithQuery(
      <PlannedMealCard template={DEFAULT_MEAL_TEMPLATES[0]} planned={undefined} multiplier={1} onMultiplierChange={onMultiplierChange} onLogEaten={vi.fn()} />
    );
    fireEvent.change(screen.getByLabelText("Porsiyon çarpanı"), { target: { value: "2,5" } });
    expect(onMultiplierChange).toHaveBeenLastCalledWith(2.5);
  });
});

describe("PlannedMealCard", () => {
  it("plan yokken rehber örneğini ve hedefleri gösterir; çarpan düğmeleri bildirir", () => {
    const onMultiplierChange = vi.fn();
    const onLogEaten = vi.fn();
    const template = DEFAULT_MEAL_TEMPLATES[0];
    renderWithQuery(
      <PlannedMealCard template={template} planned={undefined} multiplier={0.5} onMultiplierChange={onMultiplierChange} onLogEaten={onLogEaten} />
    );
    expect(screen.getByRole("heading", { name: template.example })).toBeTruthy();
    expect(screen.getByText(`${Math.round(template.targetKcal * 0.5)} kcal`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "1.5x" }));
    expect(onMultiplierChange).toHaveBeenCalledWith(1.5);
    fireEvent.click(screen.getByRole("button", { name: "0.5x Porsiyon Olarak Kaydet" }));
    expect(onLogEaten).toHaveBeenCalled();
  });
});

describe("MealPrepGuide ve sayfa", () => {
  it("rehber dört hazırlık kartını gösterir", () => {
    renderWithQuery(<MealPrepGuide />);
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(4);
  });

  it("sayfa açılınca alışveriş listesi yüklenir; sekmeler içeriği değiştirir", async () => {
    const s = stubFetch([
      ["/api/meal-plans", () => jsonResponse([])],
      [/\/api\/shopping\?weekStart=/, () => jsonResponse(shoppingList())],
    ]);
    restore = s.restore;
    renderWithQuery(<NutritionPage />);
    await waitFor(() => expect(s.calls.some((c) => c.url.includes("/api/shopping"))).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: /Alışveriş Listesi/ }));
    expect(await screen.findByRole("checkbox", { name: /Yulaf/ })).toBeTruthy();
    expect(s.calls.filter((c) => c.url.includes("/api/shopping")).length).toBe(1); // sekme yeniden çekmez

    fireEvent.click(screen.getByRole("button", { name: /Meal-Prep Rehberi/ }));
    expect(screen.getByText(/Tavuk Göğsü Toplu Pişirme/)).toBeTruthy();
  });
});

import { useState } from "react";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShoppingListTab } from "@/components/nutrition/ShoppingListTab";
import { useShoppingList } from "@/lib/client/queries/shopping";
import { MealPlanTab } from "@/components/nutrition/MealPlanTab";
import { PlannedMealCard } from "@/components/nutrition/PlannedMealCard";
import { MealPrepGuide } from "@/components/nutrition/MealPrepGuide";
import { TodayMealsList } from "@/components/dashboard/TodayMealsList";
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

describe("B09: alışveriş listesi boşluğun nedenini söyler ve elle kalem eklenir", () => {
  it("tarifsiz planlı öğünleri nedeniyle birlikte gösterir", async () => {
    restore = stubFetch([
      [/\/api\/shopping\?weekStart=/, () => jsonResponse({ weekStart: WEEK, items: [], grouped: {}, generated: false, plannedMeals: 2, unlinkedMeals: ["2 yumurta, 1 dilim ekmek", "Taze fasulye"] })],
      ["/api/shopping", () => jsonResponse({ weekStart: WEEK, items: [], grouped: {}, pantrySummary: "Kiler kontrolü yapılmadı.", plannedMeals: 2, unlinkedMeals: ["2 yumurta, 1 dilim ekmek", "Taze fasulye"] })],
    ]).restore;
    renderWithQuery(<ShoppingHarness onMessage={vi.fn()} />);
    const note = await screen.findByRole("note", { name: "Listeye girmeyen öğünler" });
    expect(note.textContent).toMatch(/2 öğün tarife bağlı değil/);
    expect(note.textContent).toContain("2 yumurta, 1 dilim ekmek");
    expect(note.textContent).toContain("Taze fasulye");
  });

  it("haftada plan yoksa bunu söyler", async () => {
    restore = stubFetch([
      [/\/api\/shopping\?weekStart=/, () => jsonResponse({ weekStart: WEEK, items: [], grouped: {}, generated: false, plannedMeals: 0, unlinkedMeals: [] })],
      ["/api/shopping", () => jsonResponse({ weekStart: WEEK, items: [], grouped: {}, plannedMeals: 0, unlinkedMeals: [] })],
    ]).restore;
    renderWithQuery(<ShoppingHarness onMessage={vi.fn()} />);
    expect(await screen.findByText(/Bu hafta planlı öğün yok/)).toBeTruthy();
  });

  it("elle kalem eklenir ve silinir; liste yeniden çekilmez", async () => {
    const s = stubFetch([
      [/\/api\/shopping\?weekStart=/, () => jsonResponse(shoppingList())],
      ["/api/shopping/items", (_u, init) =>
        init?.method === "DELETE"
          ? jsonResponse({ success: true })
          : jsonResponse({ id: "s9", weekStart: WEEK, category: "Süt Ürünleri & Yumurta", name: "Laktozsuz yoğurt", amount: 2, unit: "adet", checked: false, manual: true }, 201)],
    ]);
    restore = s.restore;
    const onMessage = vi.fn();
    renderWithQuery(<ShoppingHarness onMessage={onMessage} />);
    await screen.findByRole("checkbox", { name: /Yulaf/ });

    fireEvent.change(screen.getByLabelText("Kalem adı"), { target: { value: "Laktozsuz yoğurt" } });
    fireEvent.change(screen.getByLabelText("Miktar"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Kalemi ekle" }));
    const row = await screen.findByRole("checkbox", { name: /Laktozsuz yoğurt/ });
    expect(row.textContent).toContain("2 adet");
    expect(JSON.parse(String(s.calls.find((c) => c.url.includes("/api/shopping/items"))?.init?.body))).toEqual({ weekStart: "2026-10-20", name: "Laktozsuz yoğurt", amount: 2, unit: "adet" });
    expect((screen.getByLabelText("Kalem adı") as HTMLInputElement).value).toBe("");
    // Plandan gelen kalemde silme düğmesi yoktur.
    expect(screen.queryByRole("button", { name: "Yulaf sil" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Laktozsuz yoğurt sil" }));
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: /Laktozsuz yoğurt/ })).toBeNull());
    expect(s.calls.some((c) => c.init?.method === "DELETE" && c.url.includes("id=s9"))).toBe(true);
    expect(s.calls.filter((c) => /\/api\/shopping\?weekStart=/.test(c.url))).toHaveLength(1);
  });

  it("ekleme hatası bildirilir", async () => {
    restore = stubFetch([
      [/\/api\/shopping\?weekStart=/, () => jsonResponse(shoppingList())],
      ["/api/shopping/items", () => jsonResponse({ error: "\"Yulaf\" bu haftanın listesinde zaten var." }, 409)],
    ]).restore;
    const onMessage = vi.fn();
    renderWithQuery(<ShoppingHarness onMessage={onMessage} />);
    await screen.findByRole("checkbox", { name: /Yulaf/ });
    fireEvent.change(screen.getByLabelText("Kalem adı"), { target: { value: "Yulaf" } });
    fireEvent.click(screen.getByRole("button", { name: "Kalemi ekle" }));
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith(expect.stringContaining("zaten var"), 4000));
  });
});

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

const freeTextPlan: MealPlan = {
  id: "p2",
  date: "2026-10-20",
  notes: null,
  meals: [
    {
      id: "m2",
      mealType: "breakfast",
      recipeId: null,
      customName: "2 yumurta, 1 dilim tam buğday ekmeği, 5 zeytin, domates",
      servings: 1,
      isCompleted: false,
      adherence: null,
      recipe: null,
      calculatedMacros: null,
    },
    { ...bulgurPlan.meals[0], id: "m3", mealType: "lunch" },
  ],
};

function MealPlanHarness({ onMessage, onOpenWeek = vi.fn() }: { onMessage: (text: string, ms?: number) => void; onOpenWeek?: () => void }) {
  const [multipliers, setMultipliers] = useState<Record<string, number>>({});
  return (
    <MealPlanTab
      selectedDate="2026-10-20"
      onDateChange={vi.fn()}
      multipliers={multipliers}
      onMultiplierChange={(id, m) => setMultipliers((p) => ({ ...p, [id]: m }))}
      onMessage={onMessage}
      onOpenWeek={onOpenWeek}
    />
  );
}

const SAMPLE_MEALS = /Yulaflı Lorlu|Izgara Tavuklu Bulgur Pilavı|Muzlu Yoğurt|Fırın Tavuk Göğsü/;

describe("MealPlanTab", () => {
  it("1.5x porsiyon gösterilen kaloriyle aynı porsiyonu (servings × 1.5) kaydeder", async () => {
    const s = stubFetch([
      ["/api/meal-plans", () => jsonResponse([bulgurPlan])],
      ["/api/food-logs", () => jsonResponse({ id: "log1" }, 201)],
    ]);
    restore = s.restore;
    const onMessage = vi.fn();
    renderWithQuery(<MealPlanHarness onMessage={onMessage} />);

    const card = await screen.findByRole("article", { name: "Bulgur Kasesi" });
    fireEvent.click(within(card).getByRole("button", { name: "1.5x" }));
    expect(card.textContent).toContain("600 kcal");
    expect(card.textContent).toContain("Malzemeler (1,5 porsiyon)");
    expect(card.textContent).toContain("300 g");

    fireEvent.click(within(card).getByRole("button", { name: "1.5x Porsiyon Olarak Kaydet" }));
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith(expect.stringContaining("günlüğe kaydedildi"), 3000));
    const body = JSON.parse(String(s.calls.find((c) => c.url.includes("/api/food-logs"))?.init?.body));
    expect(body).toMatchObject({ date: "2026-10-20", mealType: "breakfast", recipeId: "r1", name: "Bulgur Kasesi", servings: 1.5 });
    expect(onMessage.mock.calls[0][0]).toContain("600 kcal");
  });

  it("B08: haftalık editörde girilen öğünleri adıyla gösterir; sabit örnek öğün yoktur", async () => {
    restore = stubFetch([["/api/meal-plans", () => jsonResponse([freeTextPlan])]]).restore;
    renderWithQuery(<MealPlanHarness onMessage={vi.fn()} />);

    const breakfast = await screen.findByRole("article", { name: /2 yumurta, 1 dilim tam buğday ekmeği/ });
    expect(within(breakfast).getByText("Kahvaltı")).toBeTruthy();
    // Tarife bağlı olmayan öğünde uydurma makro yerine açıklama görünür.
    expect(breakfast.textContent).not.toMatch(/kcal/);
    expect(breakfast.textContent).toMatch(/Tarife bağlı değil/);

    const lunch = screen.getByRole("article", { name: "Bulgur Kasesi" });
    expect(within(lunch).getByText("Öğle Yemeği")).toBeTruthy();
    expect(lunch.textContent).toContain("400 kcal");

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(SAMPLE_MEALS);
  });

  it("B08: plan yoksa boş durum ve Hafta'dan ekle bağlantısı gösterir", async () => {
    restore = stubFetch([["/api/meal-plans", () => jsonResponse([])]]).restore;
    const onOpenWeek = vi.fn();
    renderWithQuery(<MealPlanHarness onMessage={vi.fn()} onOpenWeek={onOpenWeek} />);

    expect(await screen.findByText(/Bu gün için planlı öğün yok/)).toBeTruthy();
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("button", { name: /Yedim/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(SAMPLE_MEALS);
    fireEvent.click(screen.getByRole("link", { name: "Hafta'dan ekle" }));
    expect(onOpenWeek).toHaveBeenCalled();
  });

  it("kayıt hatası mesajla bildirilir", async () => {
    restore = stubFetch([
      ["/api/meal-plans", () => jsonResponse([bulgurPlan])],
      ["/api/food-logs", () => jsonResponse({ error: "Gramaj hesaplanamadı." }, 400)],
    ]).restore;
    const onMessage = vi.fn();
    renderWithQuery(<MealPlanHarness onMessage={onMessage} />);
    const card = await screen.findByRole("article", { name: "Bulgur Kasesi" });
    fireEvent.click(within(card).getByRole("button", { name: "Yedim Olarak Kaydet" }));
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith("Kaydedilemedi: Gramaj hesaplanamadı.", 4000));
  });
});

describe("B09: tarifsiz plan öğünü kaydedilir", () => {
  const plan = { ...freeTextPlan, meals: [freeTextPlan.meals[0]] };
  const menu = freeTextPlan.meals[0].customName!;

  it("kalori (ve isteğe bağlı makro) girilerek kaydedilir; öğün plana uygulandı sayılır", async () => {
    const s = stubFetch([
      ["/api/meal-plans/adherence", (_u, init) => (init?.method === "PATCH" ? jsonResponse({ id: "m2" }) : jsonResponse({ planned: 1, marked: 0, done: 0, partial: 0, skipped: 0, percent: null }))],
      ["/api/meal-plans", () => jsonResponse([plan])],
      ["/api/food-logs", () => jsonResponse({ id: "log1" }, 201)],
    ]);
    restore = s.restore;
    const onMessage = vi.fn();
    renderWithQuery(<MealPlanHarness onMessage={onMessage} />);

    const card = await screen.findByRole("article", { name: menu });
    fireEvent.click(within(card).getByRole("button", { name: "Yedim Olarak Kaydet" }));
    const dialog = screen.getByRole("dialog", { name: "Planlı öğünü kaydet" });
    expect(within(dialog).getByText(menu)).toBeTruthy();
    const save = within(dialog).getByRole("button", { name: "Kaydet" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText("Kalori (kcal)"), { target: { value: "350" } });
    fireEvent.change(within(dialog).getByLabelText("Protein (g)"), { target: { value: "20,5" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => expect(onMessage).toHaveBeenCalledWith(expect.stringContaining("günlüğe kaydedildi"), 3000));
    const body = JSON.parse(String(s.calls.find((c) => c.url.includes("/api/food-logs"))?.init?.body));
    expect(body).toMatchObject({ date: "2026-10-20", mealType: "breakfast", name: menu, caloriesSnapshot: 350, proteinSnapshot: 20.5 });
    expect(body).not.toHaveProperty("grams");
    expect(body).not.toHaveProperty("carbsSnapshot");
    await waitFor(() => expect(s.calls.some((c) => c.init?.method === "PATCH")).toBe(true));
    expect(JSON.parse(String(s.calls.find((c) => c.init?.method === "PATCH")?.init?.body))).toEqual({ plannedMealId: "m2", adherence: "done" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("katalogla eşleştirilir: eşleşen kalemler gramıyla kaydedilir, eşleşmeyen açıkça gösterilir", async () => {
    const s = stubFetch([
      ["/api/meal-plans/adherence", (_u, init) => (init?.method === "PATCH" ? jsonResponse({ id: "m2" }) : jsonResponse({ planned: 1, marked: 0, done: 0, partial: 0, skipped: 0, percent: null }))],
      ["/api/meal-plans", () => jsonResponse([plan])],
      ["/api/food-logs/parse", () =>
        jsonResponse({
          items: [
            { raw: "2 yumurta", quantity: 2, unit: null, match: { type: "food", id: "f-egg", name: "Yumurta" }, alternatives: [], grams: 100, macros: { calories: 155, proteinG: 13, carbsG: 1, fatG: 11 } },
            { raw: "5 zeytin", quantity: 5, unit: null, match: null, alternatives: [], grams: null, macros: null, note: "Katalogda bulunamadı." },
          ],
        })],
      ["/api/food-logs", () => jsonResponse({ id: "log1" }, 201)],
    ]);
    restore = s.restore;
    const onMessage = vi.fn();
    renderWithQuery(<MealPlanHarness onMessage={onMessage} />);

    fireEvent.click(within(await screen.findByRole("article", { name: menu })).getByRole("button", { name: "Yedim Olarak Kaydet" }));
    const dialog = screen.getByRole("dialog", { name: "Planlı öğünü kaydet" });
    fireEvent.click(within(dialog).getByRole("tab", { name: "Katalogla eşleştir" }));
    expect(await within(dialog).findByText("155 kcal")).toBeTruthy();
    expect(within(dialog).getByText("Katalogda bulunamadı.")).toBeTruthy();
    const parseBody = JSON.parse(String(s.calls.find((c) => c.url.includes("/parse"))?.init?.body));
    expect(parseBody).toEqual({ text: menu });

    fireEvent.change(within(dialog).getByLabelText("2 yumurta gramı"), { target: { value: "120" } });
    expect(within(dialog).getByText("186 kcal")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "1 kalemi kaydet" }));
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith(expect.stringContaining("günlüğe kaydedildi"), 3000));
    const logs = s.calls.filter((c) => c.url.endsWith("/api/food-logs")).map((c) => JSON.parse(String(c.init?.body)));
    expect(logs).toEqual([expect.objectContaining({ foodItemId: "f-egg", name: "Yumurta", grams: 120, mealType: "breakfast", date: "2026-10-20" })]);
  });

  it("kayıt hatası pencerede gösterilir ve pencere açık kalır", async () => {
    restore = stubFetch([
      ["/api/meal-plans/adherence", () => jsonResponse({ planned: 1, marked: 0, done: 0, partial: 0, skipped: 0, percent: null })],
      ["/api/meal-plans", () => jsonResponse([plan])],
      ["/api/food-logs", () => jsonResponse({ error: "Sunucu hatası" }, 500)],
    ]).restore;
    renderWithQuery(<MealPlanHarness onMessage={vi.fn()} />);
    fireEvent.click(within(await screen.findByRole("article", { name: menu })).getByRole("button", { name: "Yedim Olarak Kaydet" }));
    const dialog = screen.getByRole("dialog", { name: "Planlı öğünü kaydet" });
    fireEvent.change(within(dialog).getByLabelText("Kalori (kcal)"), { target: { value: "300" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }));
    expect(await within(dialog).findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Planlı öğünü kaydet" })).toBeTruthy();
  });
});

describe("B09: kaloriyle girilen kayıt panoda", () => {
  it("gramı bilinmeyen (0) kayıtta '0g' yazmaz", () => {
    const log = {
      id: "l1", date: "2026-10-20", time: "08:10", mealType: "breakfast", foodItemId: null, recipeId: null, name: "Diyetisyen kahvaltısı",
      grams: 0, caloriesSnapshot: 350, proteinSnapshot: 20, carbsSnapshot: 0, fatSnapshot: 0, createdAt: "2026-10-20T05:10:00.000Z",
    };
    const { container } = renderWithQuery(<TodayMealsList logs={[log] as never} onAdd={vi.fn()} onDelete={vi.fn()} />);
    expect(container.textContent).toContain("350 kcal");
    expect(container.textContent).not.toContain("0g · 350 kcal");
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
    const card = await screen.findByRole("article", { name: "Bulgur Kasesi" });
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

describe("PlannedMealCard", () => {
  const meal = bulgurPlan.meals[0];

  it("serbest çarpan yazılabilir; hazır düğmeler ve kaydet düğmesi bildirir (F31)", () => {
    const onMultiplierChange = vi.fn();
    const onLogEaten = vi.fn();
    renderWithQuery(<PlannedMealCard meal={meal} label="Kahvaltı" multiplier={0.5} onMultiplierChange={onMultiplierChange} onLogEaten={onLogEaten} />);
    expect(screen.getByText("200 kcal")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Porsiyon çarpanı"), { target: { value: "2,5" } });
    expect(onMultiplierChange).toHaveBeenLastCalledWith(2.5);
    fireEvent.click(screen.getByRole("button", { name: "1.5x" }));
    expect(onMultiplierChange).toHaveBeenCalledWith(1.5);
    fireEvent.click(screen.getByRole("button", { name: "0.5x Porsiyon Olarak Kaydet" }));
    expect(onLogEaten).toHaveBeenCalled();
  });

  it("planlanan saat varsa gösterir", () => {
    renderWithQuery(<PlannedMealCard meal={{ ...meal, plannedTime: "08:15" } as typeof meal} label="Kahvaltı" multiplier={1} onMultiplierChange={vi.fn()} onLogEaten={vi.fn()} />);
    expect(screen.getByText("08:15")).toBeTruthy();
  });
});

const profile = (over: Record<string, unknown> = {}) => ({
  id: "default-user", heightCm: 160, age: 41, sex: "female", currentWeightKg: 78, calorieTarget: 1500, calorieCeiling: 1600,
  proteinTargetG: 122, fatTargetG: 42, carbTargetG: 131, wakeTime: "06:00", workdayHomeTime: "18:00", isOnboarded: true,
  hideNumbers: false, ...over,
});

describe("B03: Yemek Planı başlığı profildeki hedefi gösterir", () => {
  function setupPage(p: ReturnType<typeof profile>, plans: MealPlan[] = []) {
    restore = stubFetch([
      ["/api/profile", () => jsonResponse(p)],
      ["/api/meal-plans", () => jsonResponse(plans)],
      [/\/api\/shopping\?weekStart=/, () => jsonResponse(shoppingList())],
    ]).restore;
    renderWithQuery(<NutritionPage />);
  }

  it("hedef kalori ve makrolar profilden gelir (Türkçe biçimle); sabit 2.080 yazmaz", async () => {
    setupPage(profile());
    expect(await screen.findByText("Hedef: 1.500 kcal · 122 g protein · 131 g karbonhidrat · 42 g yağ")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/2\.080|165 ?g/);
  });

  it("sihirbaz tamamlanmadıysa hedef tahmini diye işaretlenir", async () => {
    setupPage(profile({ isOnboarded: false, calorieTarget: 2000, proteinTargetG: 100, carbTargetG: 250, fatTargetG: 65 }));
    expect(await screen.findByText("Tahmini hedef: 2.000 kcal · 100 g protein · 250 g karbonhidrat · 65 g yağ")).toBeTruthy();
  });

  it("'sayıları gizle' açıkken başlıkta ve öğün kartında sayı görünmez", async () => {
    setupPage(profile({ hideNumbers: true }), [bulgurPlan]);
    expect(await screen.findByText(/Sayılar gizli/)).toBeTruthy();
    const card = await screen.findByRole("article", { name: "Bulgur Kasesi" });
    await waitFor(() => expect(card.textContent).not.toMatch(/kcal/));
    expect(document.body.textContent).not.toMatch(/1\.500|122 g/);
  });

  it("Ramazan modunda kahvaltı Sahur diye yazılır", async () => {
    setupPage(profile({ ramadanMode: true }), [bulgurPlan]);
    const card = await screen.findByRole("article", { name: "Bulgur Kasesi" });
    await waitFor(() => expect(within(card).getByText("Sahur")).toBeTruthy());
  });
});

describe("MealPrepGuide ve sayfa", () => {
  it("rehber dört hazırlık kartını gösterir; kişisel saat ya da iş düzeni varsaymaz", () => {
    renderWithQuery(<MealPrepGuide />);
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(4);
    expect(document.body.textContent).not.toMatch(/\d{1,2}:\d{2}/);
    expect(document.body.textContent).not.toMatch(/iş çıkışı|eve varış/i);
  });

  it("B08: boş günde 'Hafta'dan ekle' haftalık editörü açar", async () => {
    restore = stubFetch([
      ["/api/profile", () => jsonResponse(profile())],
      ["/api/meal-plans", () => jsonResponse([])],
      [/\/api\/shopping\?weekStart=/, () => jsonResponse(shoppingList())],
    ]).restore;
    renderWithQuery(<NutritionPage />);
    fireEvent.click(await screen.findByRole("link", { name: "Hafta'dan ekle" }));
    expect(await screen.findByRole("region", { name: /^Pazartesi/ })).toBeTruthy();
  });

  it("sayfa açılınca alışveriş listesi yüklenir; sekmeler içeriği değiştirir", async () => {
    const s = stubFetch([
      ["/api/profile", () => jsonResponse(profile())],
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

import { act, configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FoodsPage from "@/app/foods/page";
import { NewFoodModal } from "@/components/foods/NewFoodModal";
import { NewRecipeModal } from "@/components/foods/NewRecipeModal";
import { filterFoods } from "@/components/foods/FoodCatalogTab";
import { recipeTotals } from "@/components/foods/RecipesTab";
import type { FoodItem, PackagedProduct, Recipe } from "@/lib/schemas/food";
import { jsonResponse, stubFetch } from "../helpers/fetch";
import { renderWithQuery } from "../helpers/query";

const food = (over: Partial<FoodItem>): FoodItem => ({
  id: "f1",
  name: "Tavuk Göğsü",
  category: "Kasap & Balık",
  brand: null,
  barcode: null,
  basisGrams: 100,
  calories: 165,
  proteinG: 31,
  carbsG: 0,
  fatG: 3.6,
  source: "Katalog",
  confidence: "Yüksek",
  ...over,
});

const FOODS: FoodItem[] = [
  food({ id: "f1" }),
  food({ id: "f2", name: "İnek Sütü", category: "Süt Ürünleri & Yumurta", calories: 60, proteinG: 3, carbsG: 5, fatG: 3 }),
  food({ id: "f3", name: "Bulgur", category: "Kuru Gıda & Tahıllar", calories: 350, proteinG: 12, carbsG: 76, fatG: 1.5 }),
];

const RECIPE: Recipe = {
  id: "r1",
  name: "Tavuklu Bulgur",
  instructions: "Haşla ve karıştır",
  prepMinutes: 20,
  servings: 2,
  ingredients: [
    { id: "i1", foodItemId: "f1", grams: 200, foodItem: FOODS[0] },
    { id: "i2", foodItemId: "f3", grams: 150, foodItem: FOODS[2] },
  ],
};

const GRANOLA: PackagedProduct = {
  barcode: "8690000000017",
  name: "Test Granola",
  brand: "Marka",
  basisGrams: 100,
  calories: 450,
  proteinG: 10,
  carbsG: 60,
  fatG: 18,
  confidence: "Yüksek",
  uncertainties: [],
  categories: ["Kahvaltılık"],
};

type Call = { url: string; init?: RequestInit };
const bodyOf = (call: Call) => JSON.parse(String(call.init?.body));
const posts = (calls: Call[], path: string) =>
  calls.filter((c) => c.init?.method === "POST" && new URL(c.url, "http://x").pathname === path);

// İlk çizim modül yüklemesiyle yavaş olabilir (paralel test süreçleri); 1 sn varsayılanı dar kalıyor.
configure({ asyncUtilTimeout: 5000 });

let restore: (() => void) | undefined;
afterEach(() => restore?.());

/** Sayfa için sahte API; `overrides` ilgili yolu (yöntemden bağımsız) değiştirir. */
function setup(overrides: Array<[string | RegExp, (url: string, init?: RequestInit) => Response]> = []) {
  const s = stubFetch([
    ...overrides,
    ["/api/foods/barcode", () => jsonResponse({ success: false, notFound: true })],
    ["/api/foods", (_u, init) => (init?.method === "POST" ? jsonResponse(food({ id: "new" }), 201) : jsonResponse(FOODS))],
    ["/api/recipes", (_u, init) => (init?.method === "POST" ? jsonResponse(RECIPE, 201) : jsonResponse([RECIPE]))],
    ["/api/food-logs", () => jsonResponse({ id: "log1" }, 201)],
  ]);
  restore = s.restore;
  renderWithQuery(<FoodsPage />);
  return s;
}

async function openPackagedTab() {
  await screen.findByText("Tavuk Göğsü");
  fireEvent.click(screen.getByRole("button", { name: /Paketli Gıda & Barkod/ }));
}

describe("Besin kataloğu sekmesi", () => {
  it("Türkçe büyük/küçük harf duyarsız arar ve sayaçları gösterir", async () => {
    setup();
    expect(await screen.findByRole("button", { name: "Besin Kataloğu (3)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tarifler (1)" })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/Besin ara/), { target: { value: "inek sütü" } });
    expect(screen.getByText("İnek Sütü")).toBeTruthy();
    expect(screen.queryByText("Tavuk Göğsü")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/Besin ara/), { target: { value: "yok böyle" } });
    expect(screen.getByText("Aramanıza uyan besin bulunamadı.")).toBeTruthy();
  });

  it("kategori düğmesi listeyi süzer, Tümü geri getirir", async () => {
    setup();
    await screen.findByText("Bulgur");
    fireEvent.click(screen.getByRole("button", { name: "Kuru Gıda & Tahıllar" }));
    expect(screen.getByText("Bulgur")).toBeTruthy();
    expect(screen.queryByText("İnek Sütü")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tümü" }));
    expect(screen.getByText("İnek Sütü")).toBeTruthy();
  });

  it("katalog yüklenemezse sunucunun hata mesajı gösterilir", async () => {
    setup([["/api/foods?limit", () => jsonResponse({ error: "Veritabanı kilitli" }, 500)]]);
    expect((await screen.findByRole("alert")).textContent).toContain("Veritabanı kilitli");
  });

  it("filterFoods marka adında da arar", () => {
    const list = [food({ id: "a", name: "Granola", brand: "Şölen" }), food({ id: "b", name: "Yulaf" })];
    expect(filterFoods(list, "şölen", "all").map((f) => f.id)).toEqual(["a"]);
    expect(filterFoods(list, "", "Süt Ürünleri & Yumurta")).toEqual([]);
  });
});

describe("Tarifler sekmesi", () => {
  // 50 g bazlı besin: 200 g = 4 × değerler. Eski formül (gram / 100) yarısını gösteriyordu.
  const halfBasis = food({ id: "f9", name: "Fıstık Ezmesi", basisGrams: 50, calories: 300, proteinG: 12.5, carbsG: 10, fatG: 25 });
  const PB_RECIPE: Recipe = {
    ...RECIPE,
    id: "r2",
    name: "Fıstık Ezmeli Tost",
    ingredients: [{ id: "i9", foodItemId: "f9", grams: 200, foodItem: halfBasis }],
  };

  it("sunucunun calculatedMacros değerini kullanır", () => {
    const server = { calories: 1234, proteinG: 56, carbsG: 78, fatG: 9 };
    expect(recipeTotals({ ...RECIPE, calculatedMacros: server })).toEqual(server);
  });

  it("calculatedMacros yoksa besinin basisGrams değeriyle hesaplar", () => {
    expect(recipeTotals(PB_RECIPE)).toEqual({ calories: 1200, proteinG: 50, carbsG: 40, fatG: 100 });
    expect(recipeTotals(RECIPE)).toEqual({ calories: 855, proteinG: 80, carbsG: 114, fatG: 9.5 });
  });

  it("kart sunucunun hesapladığı toplamı gösterir", async () => {
    setup([
      [
        "/api/recipes",
        () => jsonResponse([{ ...PB_RECIPE, calculatedMacros: { calories: 1200, proteinG: 50, carbsG: 40, fatG: 100 } }]),
      ],
    ]);
    fireEvent.click(await screen.findByRole("button", { name: "Tarifler (1)" }));
    expect(screen.getByText("1200 kcal")).toBeTruthy();
    expect(screen.queryByText("600 kcal")).toBeNull(); // gram / 100 hesabı
    expect(screen.getByText("50g")).toBeTruthy();
    expect(screen.getByText("Hazırlama: 20 dk • 2 porsiyon")).toBeTruthy();
    expect(screen.getByText("Haşla ve karıştır")).toBeTruthy();
  });
});

describe("Paketli gıda sekmesi", () => {
  it("barkodla bulunan ürünü kartta gösterir ve kataloğa kaydedince bildirim çıkar", async () => {
    const s = setup([
      [
        "/api/foods/barcode",
        (_u, init) =>
          init?.method === "POST"
            ? jsonResponse({ success: true, foodItem: food({ id: "g" }), message: "ok" })
            : jsonResponse({ success: true, product: GRANOLA }),
      ],
    ]);
    await openPackagedTab();
    fireEvent.change(screen.getByPlaceholderText(/Barkod numarası/), { target: { value: "8690000000017" } });
    fireEvent.click(screen.getByRole("button", { name: /Ürün Ara/ }));
    expect(await screen.findByText("Test Granola")).toBeTruthy();
    expect(s.calls.some((c) => c.url.includes("barcode=8690000000017"))).toBe(true);

    const foodsFetchesBefore = s.calls.filter((c) => c.url.includes("/api/foods?limit")).length;
    fireEvent.click(screen.getByRole("button", { name: /Kataloğa Kaydet/ }));
    expect(await screen.findByText('"Test Granola" başarıyla yerel kataloğunuza kaydedildi.')).toBeTruthy();
    expect(bodyOf(posts(s.calls, "/api/foods/barcode")[0])).toMatchObject({
      barcode: "8690000000017",
      name: "Test Granola",
      category: "Kahvaltılık",
      basisGrams: 100,
    });
    // Katalog sorgusu geçersiz kılınır ve yeniden çekilir.
    await waitFor(() =>
      expect(s.calls.filter((c) => c.url.includes("/api/foods?limit")).length).toBeGreaterThan(foodsFetchesBefore)
    );
  });

  it("ad aramasında hızlı etiket aramayı başlatır; bulunamazsa açıklayıcı mesaj ve manuel ekleme", async () => {
    const s = setup();
    await openPackagedTab();
    fireEvent.click(screen.getByRole("button", { name: "Kefir" }));
    expect(await screen.findByText('"Kefir" için ürün bulunamadı. Lütfen manuel ekleyin.')).toBeTruthy();
    expect(s.calls.some((c) => c.url.includes("query=Kefir"))).toBe(true);
    expect((screen.getByPlaceholderText(/Barkod numarası/) as HTMLInputElement).value).toBe("Kefir");

    fireEvent.click(screen.getByRole("button", { name: "Bu Ürünü Özel Olarak Kataloğa Ekle" }));
    const dialog = screen.getByRole("dialog", { name: "Yeni Besin Ekle" });
    expect((within(dialog).getByLabelText("Besin Adı") as HTMLInputElement).value).toBe("Kefir");
  });

  it("sunucu hatasında mesaj gösterilir; +100g ürünü katalog dışı anlık değerlerle günlüğe ekler", async () => {
    const s = setup([
      ["query=Hata", () => jsonResponse({ error: "Ürün arama hatası" }, 500)],
      ["/api/foods/barcode?query", () => jsonResponse({ success: true, products: [GRANOLA, { ...GRANOLA, barcode: null }] })],
    ]);
    await openPackagedTab();
    const input = screen.getByPlaceholderText(/Barkod numarası/);
    fireEvent.change(input, { target: { value: "Hata" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText("Ürün arama hatası")).toBeTruthy();

    fireEvent.change(input, { target: { value: "granola" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findAllByText("Test Granola")).toHaveLength(2);
    expect(screen.queryByText("Ürün arama hatası")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "+100g Öğün Ekle" })[0]);
    expect(await screen.findByText('"Test Granola" (100g) bugünkü günlüğe eklendi!')).toBeTruthy();
    const body = bodyOf(posts(s.calls, "/api/food-logs")[0]);
    expect(body).toMatchObject({
      mealType: "extra",
      name: "Marka - Test Granola",
      grams: 100,
      caloriesSnapshot: 450,
      proteinSnapshot: 10,
      carbsSnapshot: 60,
      fatSnapshot: 18,
    });
    expect(body.foodItemId).toBeUndefined();
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("Yeni besin penceresi", () => {
  it("sunucu reddederse hata pencerede gösterilir ve pencere açık kalır; başarıda kapanır", async () => {
    let fail = true;
    const s = setup([
      [
        "/api/foods",
        (u, init) =>
          init?.method === "POST"
            ? fail
              ? jsonResponse({ error: "Geçersiz veri — calories" }, 400)
              : jsonResponse(food({ id: "n" }), 201)
            : jsonResponse(u.includes("barcode") ? {} : FOODS),
      ],
    ]);
    fireEvent.click(await screen.findByRole("button", { name: "Yeni Besin" }));
    const dialog = screen.getByRole("dialog", { name: "Yeni Besin Ekle" });
    fireEvent.change(within(dialog).getByLabelText("Besin Adı"), { target: { value: "Hindi" } });
    fireEvent.change(within(dialog).getByLabelText("Kalori (kcal/100g)"), { target: { value: "135" } });
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Kaydet" })));

    expect((await within(dialog).findByRole("alert")).textContent).toContain("Geçersiz veri — calories");
    expect(screen.getByRole("dialog", { name: "Yeni Besin Ekle" })).toBeTruthy();
    expect(bodyOf(posts(s.calls, "/api/foods")[0])).toMatchObject({ name: "Hindi", calories: 135, basisGrams: 100 });

    fail = false;
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Kaydet" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("Yeni tarif penceresi", () => {
  it("malzeme satırları eklenir ve bağımsız düzenlenir; anahtar sunucuya gönderilmez", async () => {
    const s = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Tarifler (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Yeni Tarif" }));
    const dialog = screen.getByRole("dialog", { name: "Yeni Tarif Oluştur" });

    fireEvent.change(within(dialog).getByLabelText("Tarif Adı"), { target: { value: "Sütlü Bulgur" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Malzeme Ekle/ }));
    fireEvent.change(within(dialog).getByLabelText("Malzeme 1"), { target: { value: "f3" } });
    fireEvent.change(within(dialog).getByLabelText("Malzeme 2"), { target: { value: "f2" } });
    fireEvent.change(within(dialog).getByLabelText("Malzeme 2 gramajı"), { target: { value: "250" } });
    expect((within(dialog).getByLabelText("Malzeme 1 gramajı") as HTMLInputElement).value).toBe("100");

    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Tarifi Kaydet" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(bodyOf(posts(s.calls, "/api/recipes")[0])).toEqual({
      name: "Sütlü Bulgur",
      instructions: "",
      prepMinutes: 15,
      servings: 1,
      ingredients: [
        { foodItemId: "f3", grams: 100 },
        { foodItemId: "f2", grams: 250 },
      ],
    });
  });

  it("kayıt başarısız olursa hata gösterilir ve pencere açık kalır", async () => {
    setup([
      ["/api/recipes", (_u, init) => (init?.method === "POST" ? jsonResponse({ error: "Malzeme bulunamadı" }, 400) : jsonResponse([RECIPE]))],
    ]);
    fireEvent.click(await screen.findByRole("button", { name: "Tarifler (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Yeni Tarif" }));
    const dialog = screen.getByRole("dialog", { name: "Yeni Tarif Oluştur" });
    fireEvent.change(within(dialog).getByLabelText("Tarif Adı"), { target: { value: "X" } });
    fireEvent.change(within(dialog).getByLabelText("Malzeme 1"), { target: { value: "f1" } });
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Tarifi Kaydet" })));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("Malzeme bulunamadı");
    expect(screen.getByRole("dialog", { name: "Yeni Tarif Oluştur" })).toBeTruthy();
  });
});

describe("pencereler yeniden açılınca", () => {
  function stubFailingPost(path: string, message: string) {
    const s = stubFetch([[path, (_u, init) => (init?.method === "POST" ? jsonResponse({ error: message }, 400) : jsonResponse([]))]]);
    restore = s.restore;
  }

  it("yeni besin: açık gelen pencereye ön ad yazılır; yeniden açılınca hata silinir, yeni ön ad yazılır", async () => {
    stubFailingPost("/api/foods", "Geçersiz veri");
    const name = () => (screen.getByLabelText("Besin Adı") as HTMLInputElement).value;
    const { rerender } = renderWithQuery(<NewFoodModal open onClose={() => {}} prefillName="Kefir" />);
    expect(name()).toBe("Kefir");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Kaydet" })));
    expect((await screen.findByRole("alert")).textContent).toContain("Geçersiz veri");

    rerender(<NewFoodModal open={false} onClose={() => {}} prefillName="Kefir" />);
    rerender(<NewFoodModal open onClose={() => {}} prefillName="Ayran" />);
    expect(name()).toBe("Ayran");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("yeni besin: ön ad verilmezse kapatıp açınca yazılanlar korunur", () => {
    const name = () => (screen.getByLabelText("Besin Adı") as HTMLInputElement).value;
    const { rerender } = renderWithQuery(<NewFoodModal open onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Besin Adı"), { target: { value: "Hindi" } });
    rerender(<NewFoodModal open={false} onClose={() => {}} />);
    rerender(<NewFoodModal open onClose={() => {}} />);
    expect(name()).toBe("Hindi");
  });

  it("yeni tarif: yeniden açılınca önceki hata silinir, form korunur", async () => {
    stubFailingPost("/api/recipes", "Malzeme bulunamadı");
    const { rerender } = renderWithQuery(<NewRecipeModal open onClose={() => {}} foods={FOODS} />);
    fireEvent.change(screen.getByLabelText("Tarif Adı"), { target: { value: "Bulgur Pilavı" } });
    fireEvent.change(screen.getByLabelText("Malzeme 1"), { target: { value: "f3" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Tarifi Kaydet" })));
    expect((await screen.findByRole("alert")).textContent).toContain("Malzeme bulunamadı");

    rerender(<NewRecipeModal open={false} onClose={() => {}} foods={FOODS} />);
    rerender(<NewRecipeModal open onClose={() => {}} foods={FOODS} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByLabelText("Tarif Adı") as HTMLInputElement).value).toBe("Bulgur Pilavı");
  });
});

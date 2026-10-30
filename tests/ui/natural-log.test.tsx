import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NaturalLogModal } from "@/components/dashboard/NaturalLogModal";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const ITEMS = [
  {
    raw: "1 kase mercimek çorbası",
    quantity: 1,
    unit: "kase",
    match: { type: "recipe", id: "r1", name: "Mercimek Çorbası" },
    alternatives: [{ type: "recipe", id: "r2", name: "Yayla Çorbası" }],
    grams: 250,
    macros: { calories: 151, proteinG: 9, carbsG: 22, fatG: 3 },
  },
  { raw: "ejder meyvesi", quantity: 1, unit: null, match: null, alternatives: [], grams: null, macros: null, note: '"ejder meyvesi" katalogda bulunamadı.' },
];

describe("F06: yazarak öğün ekleme", () => {
  it("metni çözümler, önizler; gram düzeltilir, eşleşme değiştirilir ve onaylanınca kaydedilir", async () => {
    const s = stubFetch([
      ["/api/profile", () => jsonResponse({ ramadanMode: false })],
      ["/api/food-logs/parse", () => jsonResponse({ items: ITEMS })],
      ["/api/food-logs", () => jsonResponse({ id: "l1" }, 201)],
    ]);
    restore = s.restore;
    const onClose = vi.fn();
    renderWithQuery(<NaturalLogModal open date="2026-10-30" defaultMealType="lunch" onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Ne yedin?"), { target: { value: "1 kase mercimek çorbası, ejder meyvesi" } });
    fireEvent.click(screen.getByRole("button", { name: "Çözümle" }));

    expect(await screen.findByText(/151 kcal/)).toBeTruthy();
    expect(screen.getByText(/katalogda bulunamadı/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("1 kase mercimek çorbası gramı"), { target: { value: "300" } });
    expect(screen.getByText(/181 kcal/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("1 kase mercimek çorbası eşleşmesi"), { target: { value: "recipe:r2" } });

    fireEvent.click(screen.getByRole("button", { name: "1 kalemi kaydet" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const posts = s.calls.filter((c) => c.url.endsWith("/api/food-logs") && c.init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0].init?.body))).toMatchObject({ date: "2026-10-30", mealType: "lunch", recipeId: "r2", name: "Yayla Çorbası", grams: 300 });
  });
});

describe("B10: bulunamayan satır çıkmaz değil", () => {
  const unmatched = { raw: "1 dilim güllaç", food: "güllaç", quantity: 1, unit: "dilim", match: null, alternatives: [], grams: null, macros: null, note: '"güllaç" katalogda bulunamadı.' };

  it("'yaklaşık kalori gir' ile serbest kayıt olarak kaydedilir", async () => {
    const s = stubFetch([
      ["/api/profile", () => jsonResponse({ ramadanMode: false })],
      ["/api/food-logs/parse", () => jsonResponse({ items: [unmatched], catalogEmpty: false })],
      ["/api/food-logs", () => jsonResponse({ id: "l1" }, 201)],
    ]);
    restore = s.restore;
    const onClose = vi.fn();
    renderWithQuery(<NaturalLogModal open date="2026-10-30" defaultMealType="dinner" onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Ne yedin?"), { target: { value: "1 dilim güllaç" } });
    fireEvent.click(screen.getByRole("button", { name: "Çözümle" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yaklaşık kalori gir" }));
    expect((screen.getByRole("button", { name: "0 kalemi kaydet" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("1 dilim güllaç yaklaşık kalori"), { target: { value: "280" } });
    fireEvent.click(screen.getByRole("button", { name: "1 kalemi kaydet" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const post = s.calls.find((c) => c.url.endsWith("/api/food-logs") && c.init?.method === "POST");
    const body = JSON.parse(String(post?.init?.body));
    expect(body).toMatchObject({ mealType: "dinner", name: "Güllaç (yaklaşık)", caloriesSnapshot: 280, proteinSnapshot: 0 });
    expect(body.foodItemId).toBeUndefined();
    expect(body.grams).toBeGreaterThan(0);
  });

  it("'yeni besin olarak ekle' ön dolu formla kataloğa ekler ve satırı ona bağlar", async () => {
    const s = stubFetch([
      ["/api/profile", () => jsonResponse({ ramadanMode: false })],
      ["/api/food-logs/parse", () => jsonResponse({ items: [{ ...unmatched, raw: "150 g güllaç", unit: "gram", quantity: 150 }], catalogEmpty: false })],
      ["/api/foods", () => jsonResponse({ id: "f9", name: "Güllaç", calories: 190, proteinG: 3, carbsG: 30, fatG: 6, basisGrams: 100 }, 201)],
      ["/api/food-logs", () => jsonResponse({ id: "l1" }, 201)],
    ]);
    restore = s.restore;
    renderWithQuery(<NaturalLogModal open date="2026-10-30" defaultMealType="dinner" onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Ne yedin?"), { target: { value: "150 g güllaç" } });
    fireEvent.click(screen.getByRole("button", { name: "Çözümle" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yeni besin olarak ekle" }));
    expect(screen.getByLabelText<HTMLInputElement>("Yeni besin adı").value).toBe("Güllaç");
    fireEvent.change(screen.getByLabelText("Kalori (kcal/100 g)"), { target: { value: "190" } });
    fireEvent.change(screen.getByLabelText("Protein (g/100 g)"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Besini kaydet" }));
    expect(await screen.findByText(/285 kcal/)).toBeTruthy();
    const food = s.calls.find((c) => c.url.endsWith("/api/foods") && c.init?.method === "POST");
    expect(JSON.parse(String(food?.init?.body))).toMatchObject({ name: "Güllaç", calories: 190, proteinG: 3, category: "Genel", confidence: "Kullanıcı" });
    fireEvent.click(screen.getByRole("button", { name: "1 kalemi kaydet" }));
    await waitFor(() => expect(s.calls.some((c) => c.url.endsWith("/api/food-logs") && c.init?.method === "POST")).toBe(true));
    const post = s.calls.find((c) => c.url.endsWith("/api/food-logs") && c.init?.method === "POST");
    expect(JSON.parse(String(post?.init?.body))).toMatchObject({ foodItemId: "f9", name: "Güllaç", grams: 150 });
  });

  it("Ramazan modunda öğün adları Sahur ve İftar olur", async () => {
    restore = stubFetch([["/api/profile", () => jsonResponse({ ramadanMode: true })]]).restore;
    renderWithQuery(<NaturalLogModal open date="2026-10-30" defaultMealType="dinner" onClose={vi.fn()} />);
    expect(await screen.findByRole("option", { name: "İftar" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Sahur" })).toBeTruthy();
  });
});

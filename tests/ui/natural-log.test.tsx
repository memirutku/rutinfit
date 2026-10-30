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

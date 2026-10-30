import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SavedMealsModal } from "@/components/dashboard/SavedMealsModal";
import type { FoodLog } from "@/lib/schemas/food";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

const log = (mealType: string): FoodLog =>
  ({ id: `l-${mealType}`, date: "2026-10-30", time: "08:00", mealType, foodItemId: null, recipeId: null, name: "Yulaf", grams: 50, caloriesSnapshot: 185, proteinSnapshot: 6, carbsSnapshot: 30, fatSnapshot: 3, createdAt: "" }) as unknown as FoodLog;

const SAVED = [{ id: "s1", name: "Sabah kasesi", mealType: "breakfast", itemCount: 2, totalCalories: 292, items: [{ name: "Yulaf", grams: 50 }, { name: "Muz", grams: 120 }] }];

let restore: (() => void) | undefined;
afterEach(() => restore?.());

function setup() {
  const s = stubFetch([
    ["/api/saved-meals/apply", () => jsonResponse({ created: 2 }, 201)],
    ["/api/food-logs/copy", () => jsonResponse({ copied: 3 }, 201)],
    ["/api/saved-meals", (_u, init) => (init?.method === "POST" ? jsonResponse({ id: "s2" }, 201) : init?.method === "DELETE" ? jsonResponse({ success: true }) : jsonResponse(SAVED))],
  ]);
  restore = s.restore;
  renderWithQuery(<SavedMealsModal open date="2026-10-30" todayLogs={[log("breakfast"), log("dinner")]} onClose={vi.fn()} />);
  return s;
}
const bodyOf = (s: ReturnType<typeof setup>, path: string) =>
  JSON.parse(String(s.calls.find((c) => c.url.includes(path) && c.init?.method === "POST")!.init?.body));

describe("F01: kayıtlı öğünler penceresi", () => {
  it("bugünün öğününü adıyla kaydeder (yalnız kaydı olan öğünler seçilebilir)", async () => {
    const s = setup();
    const select = screen.getByLabelText("Kaydedilecek öğün") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["breakfast", "dinner"]);
    fireEvent.change(screen.getByLabelText("Ad"), { target: { value: "Pazar kahvaltısı" } });
    fireEvent.click(screen.getByRole("button", { name: "Öğünü kaydet" }));
    await waitFor(() => expect(bodyOf(s, "/api/saved-meals")).toEqual({ name: "Pazar kahvaltısı", date: "2026-10-30", mealType: "breakfast" }));
  });

  it("kayıtlı öğünü seçilen öğün olarak bugüne ekler", async () => {
    const s = setup();
    expect(await screen.findByText("Sabah kasesi")).toBeTruthy();
    expect(screen.getByText(/2 kalem · 292 kcal/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Sabah kasesi hangi öğüne"), { target: { value: "lunch" } });
    fireEvent.click(screen.getByRole("button", { name: "Sabah kasesi bugüne ekle" }));
    await waitFor(() => expect(bodyOf(s, "/api/saved-meals/apply")).toEqual({ savedMealId: "s1", date: "2026-10-30", mealType: "lunch" }));
    expect(await screen.findByText(/2 kalem eklendi/)).toBeTruthy();
  });

  it("dünü bugüne kopyalar (tüm gün ya da tek öğün)", async () => {
    const s = setup();
    fireEvent.change(screen.getByLabelText("Kopyalanacak"), { target: { value: "dinner" } });
    fireEvent.click(screen.getByRole("button", { name: "Dünden kopyala" }));
    await waitFor(() => expect(bodyOf(s, "/api/food-logs/copy")).toEqual({ fromDate: "2026-10-29", toDate: "2026-10-30", mealType: "dinner" }));
    expect(await screen.findByText(/3 kayıt kopyalandı/)).toBeTruthy();
  });
});

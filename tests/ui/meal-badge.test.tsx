import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TodayMealsList } from "@/components/dashboard/TodayMealsList";
import type { FoodLog } from "@/lib/schemas/food";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => {
  restore?.();
  vi.useRealTimers();
});

const simit: FoodLog = {
  id: "l1", date: "2026-10-30", time: "17:10", mealType: "workSnack", foodItemId: "f1", recipeId: null, name: "Simit (1 adet)",
  grams: 110, caloriesSnapshot: 302.5, proteinSnapshot: 9.9, carbsSnapshot: 57.2, fatSnapshot: 3.9,
};

describe("B13: öğün rozetine dokunarak öğün değiştirilir", () => {
  it("rozet menüsünden seçilen öğün kayda yazılır", async () => {
    const s = stubFetch([["/api/food-logs", () => jsonResponse({ ...simit, mealType: "breakfast" })]]);
    restore = s.restore;
    renderWithQuery(<TodayMealsList logs={[simit]} onAdd={vi.fn()} onDelete={vi.fn()} />);
    const badge = screen.getByRole("button", { name: "Simit (1 adet) öğünü: İş Çıkışı. Değiştir" });
    expect(badge.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(badge);
    const menu = screen.getByRole("menu", { name: "Hangi öğün?" });
    expect(menu).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("menuitemradio", { name: "Kahvaltı" })));
    await waitFor(() => expect(s.calls.some((c) => c.init?.method === "PATCH")).toBe(true));
    const patch = s.calls.find((c) => c.init?.method === "PATCH")!;
    expect(patch.url).toContain("id=l1");
    expect(JSON.parse(String(patch.init?.body))).toEqual({ mealType: "breakfast" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Ramazan modunda menü Sahur ve İftar adlarını kullanır; Esc menüyü kapatır", () => {
    restore = stubFetch([]).restore;
    renderWithQuery(<TodayMealsList ramadan logs={[{ ...simit, mealType: "dinner" }]} onAdd={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /öğünü: İftar/ }));
    expect(screen.getByRole("menuitemradio", { name: "Sahur" })).toBeTruthy();
    expect(screen.getByRole("menuitemradio", { name: "İftar" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("B13: hızlı çipte saat öğün sınırındaysa 'Hangi öğün?' sorulur", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));

  it("sınırda iki öğün sorulur ve seçilen öğünle eklenir", () => {
    vi.setSystemTime(new Date(2026, 9, 30, 10, 50));
    const onQuickFood = vi.fn();
    renderWithQuery(<TodayMealsList logs={[]} onAdd={vi.fn()} onDelete={vi.fn()} onQuickFood={onQuickFood} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Simit" }));
    expect(onQuickFood).not.toHaveBeenCalled();
    const ask = screen.getByRole("group", { name: "Hangi öğün?" });
    expect(ask.textContent).toContain("Simit");
    fireEvent.click(screen.getByRole("button", { name: "Kahvaltı" }));
    expect(onQuickFood).toHaveBeenCalledWith("simit", 1, "breakfast");
    expect(screen.queryByRole("group", { name: "Hangi öğün?" })).toBeNull();
  });

  it("sınırdan uzaksa sormadan saatin öğünüyle eklenir; vazgeçilebilir", () => {
    vi.setSystemTime(new Date(2026, 9, 30, 8, 0));
    const onQuickFood = vi.fn();
    renderWithQuery(<TodayMealsList logs={[]} onAdd={vi.fn()} onDelete={vi.fn()} onQuickFood={onQuickFood} />);
    fireEvent.click(screen.getByRole("button", { name: "+ 2 dilim ekmek" }));
    expect(onQuickFood).toHaveBeenCalledWith("ekmek-dilimi", 2, "breakfast");

    vi.setSystemTime(new Date(2026, 9, 30, 21, 45));
    fireEvent.click(screen.getByRole("button", { name: "+ Simit" }));
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));
    expect(onQuickFood).toHaveBeenCalledTimes(1);
  });
});

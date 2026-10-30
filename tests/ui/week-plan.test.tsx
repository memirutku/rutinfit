import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WeekPlanEditor } from "@/components/nutrition/WeekPlanEditor";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const PLANS = [
  {
    id: "p1",
    date: "2026-11-02",
    notes: null,
    meals: [{ id: "m1", mealType: "lunch", recipeId: "r1", customName: null, servings: 1.5, isCompleted: false, adherence: null, recipe: { id: "r1", name: "Bulgur Pilavı", servings: 4, prepMinutes: 30, ingredients: [] }, calculatedMacros: null }],
  },
];

function setup() {
  const s = stubFetch([
    ["/api/meal-plans/meals/copy", () => jsonResponse({ id: "m3" }, 201)],
    ["/api/meal-plans/meals", (_u, init) => jsonResponse({ id: "m2" }, init?.method === "POST" ? 201 : 200)],
    ["/api/meal-plans", () => jsonResponse(PLANS)],
    ["/api/recipes", () => jsonResponse([{ id: "r1", name: "Bulgur Pilavı", servings: 4, prepMinutes: 30, ingredients: [], calculatedMacros: null }])],
  ]);
  restore = s.restore;
  renderWithQuery(<WeekPlanEditor selectedDate="2026-11-04" />);
  return s;
}
const bodyOf = (s: ReturnType<typeof setup>, url: string, method: string) =>
  JSON.parse(String(s.calls.find((c) => c.url.includes(url) && c.init?.method === method)!.init?.body));

describe("F30: haftalık plan editörü", () => {
  it("haftanın günlerini (Pazartesi'den) ve planlı öğünleri gösterir", async () => {
    setup();
    const monday = await screen.findByRole("region", { name: /Pazartesi 02\.11/ });
    expect(await within(monday).findByText(/Bulgur Pilavı/)).toBeTruthy();
    expect(within(monday).getByText(/1,5 porsiyon/)).toBeTruthy();
    expect(screen.getByRole("region", { name: /Pazar 08\.11/ })).toBeTruthy();
  });

  it("özel adlı öğün ekler", async () => {
    const s = setup();
    const tuesday = await screen.findByRole("region", { name: /Salı 03\.11/ });
    fireEvent.click(within(tuesday).getByRole("button", { name: "+ Öğün" }));
    const dialog = screen.getByRole("dialog", { name: "Öğün ekle" });
    fireEvent.change(within(dialog).getByLabelText("Öğün"), { target: { value: "dinner" } });
    fireEvent.change(within(dialog).getByLabelText("Öğün adı"), { target: { value: "Diyetisyen: Izgara köfte" } });
    fireEvent.change(within(dialog).getByLabelText("Porsiyon"), { target: { value: "2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(s.calls.some((c) => c.url.endsWith("/api/meal-plans/meals") && c.init?.method === "POST")).toBe(true));
    expect(bodyOf(s, "/api/meal-plans/meals", "POST")).toEqual({ date: "2026-11-03", mealType: "dinner", customName: "Diyetisyen: Izgara köfte", servings: 2 });
  });

  it("öğünü taşır, kopyalar ve siler", async () => {
    const s = setup();
    const monday = await screen.findByRole("region", { name: /Pazartesi 02\.11/ });
    fireEvent.click(await within(monday).findByRole("button", { name: "Bulgur Pilavı taşı" }));
    let dialog = screen.getByRole("dialog", { name: "Öğünü taşı" });
    fireEvent.change(within(dialog).getByLabelText("Gün"), { target: { value: "2026-11-05" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(s.calls.some((c) => c.init?.method === "PATCH")).toBe(true));
    expect(s.calls.find((c) => c.init?.method === "PATCH")!.url).toContain("id=m1");
    expect(bodyOf(s, "/api/meal-plans/meals", "PATCH")).toEqual({ date: "2026-11-05", mealType: "lunch" });

    fireEvent.click(within(monday).getByRole("button", { name: "Bulgur Pilavı kopyala" }));
    dialog = screen.getByRole("dialog", { name: "Öğünü kopyala" });
    fireEvent.change(within(dialog).getByLabelText("Gün"), { target: { value: "2026-11-06" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(s.calls.some((c) => c.url.includes("/copy"))).toBe(true));
    expect(bodyOf(s, "/copy", "POST")).toEqual({ id: "m1", toDate: "2026-11-06", toMealType: "lunch" });

    fireEvent.click(within(monday).getByRole("button", { name: "Bulgur Pilavı sil" }));
    await waitFor(() => expect(s.calls.some((c) => c.init?.method === "DELETE" && c.url.includes("id=m1"))).toBe(true));
  });
});

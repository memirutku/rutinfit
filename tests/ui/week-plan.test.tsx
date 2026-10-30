import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WeekPlanEditor } from "@/components/nutrition/WeekPlanEditor";
import { makeTestQueryClient, renderWithQuery } from "../helpers/query";
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

function setup(client?: ReturnType<typeof makeTestQueryClient>) {
  const s = stubFetch([
    ["/api/meal-plans/meals/copy", () => jsonResponse({ id: "m3" }, 201)],
    ["/api/meal-plans/meals", (_u, init) => jsonResponse({ id: "m2" }, init?.method === "POST" ? 201 : 200)],
    ["/api/meal-plans", () => jsonResponse(PLANS)],
    ["/api/recipes", () => jsonResponse([{ id: "r1", name: "Bulgur Pilavı", servings: 4, prepMinutes: 30, ingredients: [], calculatedMacros: null }])],
  ]);
  restore = s.restore;
  renderWithQuery(<WeekPlanEditor selectedDate="2026-11-04" />, { client });
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

  it("recheck: öğün eklenince haftanın alışveriş listesi de tazelenir (önceden sayfa açılışındaki boş liste kalıyordu)", async () => {
    const client = makeTestQueryClient();
    client.setQueryData(["shopping", "2026-11-04"], { plannedMeals: 0 });
    const s = setup(client);
    const tuesday = await screen.findByRole("region", { name: /Salı 03\.11/ });
    fireEvent.click(within(tuesday).getByRole("button", { name: "+ Öğün" }));
    const dialog = screen.getByRole("dialog", { name: "Öğün ekle" });
    fireEvent.change(within(dialog).getByLabelText("Öğün adı"), { target: { value: "Mercimek" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(s.calls.some((c) => c.init?.method === "POST")).toBe(true));
    await waitFor(() => expect(client.getQueryState(["shopping", "2026-11-04"])?.isInvalidated).toBe(true));
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

describe("B16: haftalık editör", () => {
  const LONG = "Zeytinyağlı taze fasulye 1 porsiyon, laktozsuz yoğurt 1 kase, tam buğday ekmeği 1 dilim";
  const plans = [
    {
      id: "p1",
      date: "2026-11-02",
      notes: null,
      meals: [
        { ...PLANS[0].meals[0], calculatedMacros: { calories: 600, proteinG: 20, carbsG: 90, fatG: 12 } },
        { id: "m9", mealType: "dinner", recipeId: null, customName: LONG, servings: 1, isCompleted: false, adherence: null, recipe: null, calculatedMacros: null },
      ],
    },
    {
      id: "p2",
      date: "2026-11-04",
      notes: null,
      meals: [{ ...PLANS[0].meals[0], id: "m10", calculatedMacros: { calories: 450.4, proteinG: 20, carbsG: 60, fatG: 10 } }],
    },
  ];

  function render(props: Partial<Parameters<typeof WeekPlanEditor>[0]> = {}) {
    const s = stubFetch([
      ["/api/meal-plans", (url) => jsonResponse(url.includes("weekStart=2026-11-02") ? plans : [])],
      ["/api/recipes", () => jsonResponse([])],
    ]);
    restore = s.restore;
    renderWithQuery(<WeekPlanEditor selectedDate="2026-11-04" today="2026-11-04" {...props} />);
    return s;
  }

  it("uzun öğün adı kesilmez (sarılır) ve tam adı ipucunda da durur", async () => {
    render();
    const name = await screen.findByText(LONG);
    expect(name.className).not.toMatch(/truncate/);
    expect(name.closest("[title]")?.getAttribute("title")).toBe(LONG);
  });

  it("her günün planlanan kalori toplamını yazar; tarifsiz öğün sayısını belirtir", async () => {
    render();
    const monday = await screen.findByRole("region", { name: /Pazartesi 02\.11/ });
    await waitFor(() => expect(monday.textContent).toContain("600 kcal"));
    expect(monday.textContent).toContain("1 öğün tarifsiz");
    expect((await screen.findByRole("region", { name: /Çarşamba 04\.11/ })).textContent).toContain("450 kcal");
    expect(screen.getByRole("region", { name: /Salı 03\.11/ }).textContent).not.toContain("kcal");
  });

  it("'sayıları gizle' açıkken gün toplamı yazılmaz", async () => {
    render({ hideNumbers: true });
    const monday = await screen.findByRole("region", { name: /Pazartesi 02\.11/ });
    await within(monday).findByText(LONG);
    expect(monday.textContent).not.toContain("kcal");
  });

  it("bugünün günü vurgulanır", async () => {
    render();
    const today = await screen.findByRole("region", { name: /Çarşamba 04\.11/ });
    expect(today.getAttribute("aria-current")).toBe("date");
    expect(within(today).getByText("Bugün")).toBeTruthy();
    expect(screen.getByRole("region", { name: /Salı 03\.11/ }).getAttribute("aria-current")).toBeNull();
  });

  it("hafta okları önceki ve sonraki haftaya geçer; 'Bu hafta' geri döner", async () => {
    const s = render();
    await screen.findByRole("region", { name: /Pazartesi 02\.11/ });
    expect(screen.getByText("02.11 – 08.11")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Bu hafta" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sonraki hafta" }));
    expect(await screen.findByRole("region", { name: /Pazartesi 09\.11/ })).toBeTruthy();
    expect(s.calls.some((c) => c.url.includes("weekStart=2026-11-09"))).toBe(true);
    expect(screen.queryByRole("region", { name: /Çarşamba/, current: "date" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Önceki hafta" }));
    fireEvent.click(screen.getByRole("button", { name: "Önceki hafta" }));
    expect(await screen.findByRole("region", { name: /Pazartesi 26\.10/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Bu hafta" }));
    expect(await screen.findByRole("region", { name: /Pazartesi 02\.11/ })).toBeTruthy();
  });

  it("sayfa tarihini yönetiyorsa oklar sayfaya ±7 gün bildirir", async () => {
    const onDateChange = vi.fn();
    render({ onDateChange });
    await screen.findByRole("region", { name: /Pazartesi 02\.11/ });
    fireEvent.click(screen.getByRole("button", { name: "Sonraki hafta" }));
    expect(onDateChange).toHaveBeenLastCalledWith("2026-11-11");
    fireEvent.click(screen.getByRole("button", { name: "Önceki hafta" }));
    expect(onDateChange).toHaveBeenLastCalledWith("2026-10-28");
  });
});

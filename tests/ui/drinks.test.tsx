import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DrinksCard } from "@/components/dashboard/DrinksCard";
import type { DrinksDay } from "@/lib/schemas/drinks";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

const day = (over: Partial<DrinksDay["summary"]> = {}, logs: DrinksDay["logs"] = []): DrinksDay => ({
  date: "2026-10-30",
  logs,
  summary: { hydrationMl: 200, waterTargetMl: 2500, progressPercent: 8, caffeineMg: 0, caffeineHigh: false, alcoholG: 0, standardDrinks: 0, ...over },
});

let restore: (() => void) | undefined;
afterEach(() => restore?.());

describe("F13: içecek kartı", () => {
  it("sıvı ilerlemesini gösterir; hazır içecek düğmesi kaydı gönderir", async () => {
    const s = stubFetch([["/api/drinks", (_u, init) => (init?.method === "POST" ? jsonResponse({ id: "d1" }, 201) : jsonResponse(day()))]]);
    restore = s.restore;
    renderWithQuery(<DrinksCard date="2026-10-30" />);
    expect(await screen.findByText("200 / 2.500 ml")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Türk kahvesi/ }));
    await waitFor(() => expect(s.calls.some((c) => c.init?.method === "POST")).toBe(true));
    const post = s.calls.find((c) => c.init?.method === "POST")!;
    expect(JSON.parse(String(post.init?.body))).toEqual({ date: "2026-10-30", presetId: "turk-kahvesi" });
  });

  it("F79: şeker seçimi çay ve Türk kahvesi kaydına eklenir", async () => {
    const s = stubFetch([["/api/drinks", (_u, init) => (init?.method === "POST" ? jsonResponse({ id: "d1" }, 201) : jsonResponse(day()))]]);
    restore = s.restore;
    renderWithQuery(<DrinksCard date="2026-10-30" />);
    await screen.findByText("200 / 2.500 ml");
    fireEvent.change(screen.getByLabelText("Şeker (çay ve Türk kahvesi)"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /Çay/ }));
    await waitFor(() => expect(s.calls.some((c) => c.init?.method === "POST")).toBe(true));
    const post = s.calls.find((c) => c.init?.method === "POST")!;
    expect(JSON.parse(String(post.init?.body))).toEqual({ date: "2026-10-30", presetId: "cay", sugarCubes: 2 });
  });

  it("kafein sınırı aşılınca uyarır; alkol standart içki olarak gösterilir; kayıt silinebilir", async () => {
    const logs = [{ id: "d1", date: "2026-10-30", time: "20:00", kind: "alcohol" as const, name: "Bira", ml: 330, caffeineMg: 0, alcoholG: 13, kcal: 143, foodLogId: "f1" }];
    const s = stubFetch([["/api/drinks", (_u, init) => (init?.method === "DELETE" ? jsonResponse({ success: true }) : jsonResponse(day({ caffeineMg: 450, caffeineHigh: true, alcoholG: 13, standardDrinks: 1.3 }, logs)))]]);
    restore = s.restore;
    renderWithQuery(<DrinksCard date="2026-10-30" />);
    expect(await screen.findByText(/400 mg/)).toBeTruthy();
    expect(screen.getByText(/1,3 standart içki/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Bira kaydını sil" }));
    await waitFor(() => expect(s.calls.some((c) => c.init?.method === "DELETE" && c.url.includes("id=d1"))).toBe(true));
  });
});

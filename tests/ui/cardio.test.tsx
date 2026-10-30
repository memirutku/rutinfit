import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CardioPanel } from "@/components/workouts/CardioPanel";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const LOG = { id: "c1", date: "2026-10-29", kind: "run", durationMin: 27.5, distanceKm: 5, avgHr: 150, rpe: 7, kcal: 380, kcalEstimated: true, notes: null, pace: "5:30 /km" };

describe("F27: kardiyo paneli", () => {
  it("haftalık özeti ve kayıtları (tempo, tahmini kalori) gösterir; kayıt eklenir", async () => {
    const s = stubFetch([
      ["/api/cardio", (_u, init) => (init?.method === "POST" ? jsonResponse({ ...LOG, id: "c2" }, 201) : jsonResponse({ logs: [LOG], summary: { sessions: 1, minutes: 27.5, distanceKm: 5 } }))],
    ]);
    restore = s.restore;
    renderWithQuery(<CardioPanel today="2026-10-30" />);
    expect(await screen.findByText(/Bu hafta: 1 seans · 27,5 dk · 5 km/)).toBeTruthy();
    expect(screen.getByText(/5:30 \/km/)).toBeTruthy();
    expect(screen.getByText(/~380 kcal/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Tür"), { target: { value: "walk" } });
    fireEvent.change(screen.getByLabelText("Süre (dk)"), { target: { value: "45" } });
    fireEvent.change(screen.getByLabelText("Mesafe (km)"), { target: { value: "3,8" } });
    fireEvent.click(screen.getByRole("button", { name: "Kardiyoyu kaydet" }));
    await waitFor(() => expect(s.calls.some((c) => c.init?.method === "POST")).toBe(true));
    expect(JSON.parse(String(s.calls.find((c) => c.init?.method === "POST")!.init?.body))).toEqual({
      date: "2026-10-30",
      kind: "walk",
      durationMin: 45,
      distanceKm: 3.8,
    });
  });
});

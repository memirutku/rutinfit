import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CheckinCard } from "@/components/progress/CheckinCard";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const metrics = {
  weekStart: "2026-10-19",
  weekEnd: "2026-10-25",
  loggedDays: 6,
  avgCalories: 2075,
  calorieTarget: 2200,
  daysOnTarget: 4,
  avgProtein: 144,
  proteinTarget: 160,
  proteinDaysHit: 3,
  weightAvg: 100.2,
  weightDeltaKg: -0.8,
  workouts: 3,
  plannedWorkouts: 3,
  workingSets: 42,
  cardioMinutes: 40,
  planAdherencePercent: 80,
  adaptiveTdee: 2550,
};

describe("F49: haftalık değerlendirme kartı", () => {
  it("kayıt yoksa değerlendirme oluşturmayı önerir; oluşturunca özeti ve öneriyi gösterir", async () => {
    const calls: string[] = [];
    let created = false;
    restore = stubFetch([
      ["/api/checkins", (_url, init) => {
        calls.push(init?.method ?? "GET");
        if (init?.method === "POST") {
          created = true;
          return jsonResponse(
            {
              id: "c1",
              weekStart: "2026-10-19",
              weekEnd: "2026-10-25",
              metrics,
              summary: "Güzel bir hafta geçirdin.",
              aiGenerated: true,
              suggestion: { kind: "protein", text: "Proteini artır: her öğüne bir protein kaynağı ekle." },
              draftId: null,
              draftStatus: null,
              approvalToken: null,
            },
            201,
          );
        }
        return jsonResponse({
          checkins: created
            ? [{ id: "c1", weekStart: "2026-10-19", metrics, summary: "Güzel bir hafta geçirdin.", aiGenerated: true, suggestion: { kind: "protein", text: "Proteini artır: her öğüne bir protein kaynağı ekle." }, draftId: null, draftStatus: null }]
            : [],
        });
      }],
    ]).restore;
    renderWithQuery(<CheckinCard />);
    expect(await screen.findByText(/Henüz haftalık değerlendirme yok/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Geçen haftayı değerlendir" }));
    expect(await screen.findByText("Güzel bir hafta geçirdin.")).toBeTruthy();
    expect(screen.getByText("AI özeti")).toBeTruthy();
    expect(screen.getByText(/Proteini artır/)).toBeTruthy();
    // F57: metrikler kodda hesaplanır ve gösterilir
    expect(screen.getByText("Kayıt")).toBeTruthy();
    expect(screen.getByText("6/7 gün")).toBeTruthy();
    expect(screen.getByText("−0,8 kg")).toBeTruthy();
    expect(calls).toContain("POST");
  });

  it("hedef önerisini onaylayınca taslağı yeniden imzalatıp uygular", async () => {
    const actions: Array<Record<string, unknown>> = [];
    let applied = false;
    restore = stubFetch([
      ["/api/checkins", () =>
        jsonResponse({
          checkins: [
            {
              id: "c2",
              weekStart: "2026-10-19",
              metrics,
              summary: "Kilo beklenenden yavaş iniyor.",
              aiGenerated: false,
              suggestion: { kind: "targets", text: "Günlük kalori hedefini 2.000 kcal yap (şu an 2.200).", calorieTarget: 2000 },
              draftId: "d1",
              draftStatus: applied ? "applied" : "pending",
            },
          ],
        })],
      ["/api/ai/actions", (_url, init) => {
        const body = JSON.parse(String(init?.body));
        actions.push(body);
        if (body.action === "reissue") return jsonResponse({ approvalToken: "tok-2" });
        applied = true;
        return jsonResponse({ message: "Uygulandı" });
      }],
    ]).restore;
    renderWithQuery(<CheckinCard />);
    expect(await screen.findByText("Kurallı özet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hedefi uygula" }));
    await waitFor(() => expect(actions).toHaveLength(2));
    expect(actions[0]).toMatchObject({ draftId: "d1", action: "reissue" });
    expect(actions[1]).toMatchObject({ draftId: "d1", action: "approve", approvalToken: "tok-2" });
    expect(await screen.findByText(/Hedef güncellendi/)).toBeTruthy();
  });

  it("reddedilen öneriyi tekrar sormaz", async () => {
    restore = stubFetch([
      ["/api/checkins", () =>
        jsonResponse({
          checkins: [
            {
              id: "c3",
              weekStart: "2026-10-19",
              metrics: { ...metrics, weightDeltaKg: null, planAdherencePercent: null, adaptiveTdee: null, avgCalories: null, avgProtein: null },
              summary: "Özet.",
              aiGenerated: false,
              suggestion: { kind: "targets", text: "Hedefi değiştir.", calorieTarget: 2000 },
              draftId: "d9",
              draftStatus: "rejected",
            },
          ],
        })],
    ]).restore;
    renderWithQuery(<CheckinCard />);
    expect(await screen.findByText(/Öneriyi reddettin/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Hedefi uygula" })).toBeNull();
  });
});

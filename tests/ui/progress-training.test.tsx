import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { formatAxisTick, StrengthSection, TrainingProgress } from "@/components/progress/StrengthSection";
import { VolumeSection } from "@/components/progress/VolumeSection";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const detail = (name: string) => ({
  name,
  history: [
    { date: "2026-10-01", topSet: { weightKg: 80, reps: 8 }, e1rm: 101.3, volumeKg: 1065, sets: 2 },
    { date: "2026-10-08", topSet: { weightKg: 80, reps: 10 }, e1rm: 106.7, volumeKg: 1070, sets: 1 },
  ],
  prs: {
    bestE1rm: { value: 106.7, date: "2026-10-08", weightKg: 80, reps: 10 },
    heaviest: { weightKg: 85, reps: 5, date: "2026-10-01" },
    bestVolume: { volumeKg: 1070, date: "2026-10-08" },
    mostReps: null,
  },
});

describe("F23: güç gelişimi bölümü", () => {
  it("egzersiz seçilince rekorları Türkçe biçimle gösterir", async () => {
    const s = stubFetch([
      [
        "/api/progress/strength",
        (u) =>
          u.includes("exercise=")
            ? jsonResponse(detail(decodeURIComponent(u.split("exercise=")[1])))
            : jsonResponse({ exercises: [{ name: "Bench Press", sessions: 2, lastDate: "2026-10-08", bestE1rm: 106.7 }, { name: "Squat", sessions: 1, lastDate: "2026-10-01", bestE1rm: 116.7 }] }),
      ],
    ]);
    restore = s.restore;
    const { container } = renderWithQuery(<StrengthSection />);
    expect((await screen.findAllByText("106,7 kg")).length).toBeGreaterThan(0);
    // B24: sade terimler; e1RM yalnız açıklamada parantez içinde geçer.
    expect(screen.getByText("Tahmini en iyi tek tekrar")).toBeTruthy();
    expect(screen.queryByText("En iyi e1RM")).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Tahmini 1 tekrar" })).toBeTruthy();
    expect(screen.getByText(/bir kez kaldırabileceğin en fazla ağırlık/)).toBeTruthy();
    // B24: Antrenman'daki kısayolun hedefi
    expect(container.querySelector("section#guc")).toBeTruthy();
    expect(screen.getByText(/80 kg × 10 · 08\.10\.2026/)).toBeTruthy();
    expect(screen.getByText(/85 kg × 5/)).toBeTruthy();
    expect(screen.getAllByText("1.070 kg").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Egzersiz"), { target: { value: "Squat" } });
    await waitFor(() => expect(s.calls.some((c) => c.url.includes("exercise=Squat"))).toBe(true));
  });

  it("B23: grafik ekseni ve ağırlıklar virgüllü, iki ondalığa kadar", async () => {
    expect(formatAxisTick(116.85)).toBe("116,85");
    expect(formatAxisTick(115.9)).toBe("115,9");
    expect(formatAxisTick(114)).toBe("114");
    const s = stubFetch([
      [
        "/api/progress/strength",
        (u) =>
          u.includes("exercise=")
            ? jsonResponse({
                ...detail("Bench Press"),
                prs: { ...detail("Bench Press").prs, heaviest: { weightKg: 101.25, reps: 3, date: "2026-10-01" } },
              })
            : jsonResponse({ exercises: [{ name: "Bench Press", sessions: 2, lastDate: "2026-10-08", bestE1rm: 106.7 }] }),
      ],
    ]);
    restore = s.restore;
    const { container } = renderWithQuery(<StrengthSection />);
    expect(await screen.findByText(/101,25 kg × 3/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/\d\.\d{1,2}\b(?!\.)/);
  });

  it("antrenman yoksa açıklama gösterir", async () => {
    restore = stubFetch([["/api/progress/strength", () => jsonResponse({ exercises: [] })]]).restore;
    renderWithQuery(<StrengthSection />);
    expect(await screen.findByText(/Henüz tamamlanmış antrenman yok/)).toBeTruthy();
  });
});

describe("F24: haftalık set hacmi bölümü", () => {
  it("bu haftanın durumunu hedef aralığına göre etiketler; çalışılmayan kasları ayrı listeler", async () => {
    restore = stubFetch([
      [
        "/api/progress/volume",
        () =>
          jsonResponse({
            weeks: ["2026-10-19", "2026-10-26"],
            target: { min: 10, max: 20 },
            rows: [
              { muscleId: "chest", nameTr: "Göğüs (Pektoralis)", sets: [8, 12] },
              { muscleId: "quads", nameTr: "Ön Bacak", sets: [4, 3] },
              { muscleId: "lats", nameTr: "Kanat", sets: [20, 24] },
              { muscleId: "calves_back", nameTr: "Baldır", sets: [0, 0] },
            ],
          }),
      ],
    ]).restore;
    renderWithQuery(<VolumeSection />);
    expect(await screen.findByText("Göğüs (Pektoralis)")).toBeTruthy();
    expect(screen.getByRole("row", { name: /Göğüs.*Hedefte/ })).toBeTruthy();
    expect(screen.getByRole("row", { name: /Ön Bacak.*Az/ })).toBeTruthy();
    expect(screen.getByRole("row", { name: /Kanat.*Fazla/ })).toBeTruthy();
    expect(screen.queryByRole("row", { name: /Baldır/ })).toBeNull();
    expect(screen.getByText(/Bu dönemde çalışılmayan: Baldır/)).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "26.10" })).toBeTruthy();
  });
});

describe("B24: antrenman kaydı yokken güç bölümleri", () => {
  it("kayıt yoksa güç ve set hacmi yerine tek ve sade bir boş durum gösterilir", async () => {
    const s = stubFetch([
      ["/api/progress/strength", () => jsonResponse({ exercises: [] })],
      ["/api/progress/volume", () => jsonResponse({ weeks: ["2026-10-26"], target: { min: 10, max: 20 }, rows: [] })],
    ]);
    restore = s.restore;
    const { container } = renderWithQuery(<TrainingProgress />);
    expect(await screen.findByText(/Henüz antrenman kaydın yok/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Güç gelişimi" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Haftalık set hacmi" })).toBeNull();
    expect(container.textContent).not.toMatch(/e1RM|hacim|TDEE/i);
    expect(screen.getByRole("link", { name: "Antrenman'a git" }).getAttribute("href")).toBe("/workouts");
    expect(s.calls.some((c) => c.url.includes("/api/progress/volume"))).toBe(false);
  });

  it("kayıt varsa güç gelişimi ve haftalık set hacmi birlikte görünür", async () => {
    restore = stubFetch([
      [
        "/api/progress/strength",
        (u) => (u.includes("exercise=") ? jsonResponse(detail("Bench Press")) : jsonResponse({ exercises: [{ name: "Bench Press", sessions: 2, lastDate: "2026-10-08", bestE1rm: 106.7 }] })),
      ],
      ["/api/progress/volume", () => jsonResponse({ weeks: ["2026-10-26"], target: { min: 10, max: 20 }, rows: [{ muscleId: "chest", nameTr: "Göğüs", sets: [12] }] })],
    ]).restore;
    renderWithQuery(<TrainingProgress />);
    expect(await screen.findByRole("heading", { name: "Haftalık set hacmi" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Güç gelişimi" })).toBeTruthy();
    expect(screen.queryByText(/Henüz antrenman kaydın yok/)).toBeNull();
  });
});

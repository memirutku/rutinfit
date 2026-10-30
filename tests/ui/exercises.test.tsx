import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExerciseLibraryPanel } from "@/components/workouts/ExerciseLibraryPanel";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const BENCH = {
  id: "bench-press",
  name: "Bench Press",
  nameTr: "Düz bench press",
  primary: "chest",
  secondary: ["triceps"],
  equipment: "barbell",
  cues: ["Kürek kemiklerini geriye sıkıştır."],
};

describe("F25: egzersiz kütüphanesi paneli", () => {
  it("arama ve süzgeçlerle listeler; seçilen egzersizin ipuçlarını ve benzerlerini gösterir", async () => {
    const s = stubFetch([
      ["alternativesFor=", () => jsonResponse({ exercise: BENCH, alternatives: [{ ...BENCH, id: "pushup", name: "Pushup", nameTr: "Şınav", equipment: "bodyweight" }] })],
      ["/api/exercises", () => jsonResponse([BENCH])],
    ]);
    restore = s.restore;
    renderWithQuery(<ExerciseLibraryPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /Düz bench press/ }));
    expect(screen.getByText("Kürek kemiklerini geriye sıkıştır.")).toBeTruthy();
    expect(await screen.findByText(/Şınav/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Egzersiz ara"), { target: { value: "bench" } });
    fireEvent.change(screen.getByLabelText("Kas grubu"), { target: { value: "chest" } });
    await waitFor(() => expect(s.calls.some((c) => c.url.includes("search=bench") && c.url.includes("muscle=chest"))).toBe(true));
  });

  it("özel egzersiz ekler", async () => {
    const s = stubFetch([["/api/exercises", (_u, init) => (init?.method === "POST" ? jsonResponse({ id: "c1" }, 201) : jsonResponse([]))]]);
    restore = s.restore;
    renderWithQuery(<ExerciseLibraryPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Özel egzersiz ekle" }));
    fireEvent.change(screen.getByLabelText("Ad"), { target: { value: "Landmine Press" } });
    fireEvent.change(screen.getByLabelText("Ana kas"), { target: { value: "chest" } });
    fireEvent.change(screen.getByLabelText("Ekipman"), { target: { value: "barbell" } });
    fireEvent.change(screen.getByLabelText("İpuçları (her satıra bir tane)"), { target: { value: "Göğüs hizasından it.\nKarnı sık." } });
    fireEvent.click(screen.getByRole("button", { name: "Egzersizi kaydet" }));
    await waitFor(() => expect(s.calls.some((c) => c.init?.method === "POST")).toBe(true));
    expect(JSON.parse(String(s.calls.find((c) => c.init?.method === "POST")!.init?.body))).toEqual({
      name: "Landmine Press",
      primary: "chest",
      equipment: "barbell",
      cues: ["Göğüs hizasından it.", "Karnı sık."],
    });
  });
});

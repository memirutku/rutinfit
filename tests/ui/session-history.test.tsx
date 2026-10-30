import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SessionHistory } from "@/components/workouts/SessionHistory";
import type { WorkoutSession } from "@/lib/schemas/workout";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => {
  restore?.();
  restore = undefined;
});

const set = (id: string, exerciseName: string, setNumber: number, weightKg: number, reps: number, setType = "normal") => ({
  id,
  exerciseName,
  setNumber,
  weightKg,
  reps,
  rpe: null,
  setType,
  isTargetMet: false,
});

const sessions: WorkoutSession[] = [
  {
    id: "s2",
    date: "2026-10-29",
    templateId: null,
    name: "Dünkü alt vücut",
    durationMinutes: 50,
    rpe: 8,
    notes: null,
    completed: true,
    setLogs: [set("a", "Squat", 2, 140, 5), set("b", "Squat", 3, 140, 5), set("c", "Romanian Deadlift", 1, 120, 8), set("w", "Squat", 1, 60, 5, "warmup")],
  },
  {
    id: "s1",
    date: "2026-10-27",
    templateId: "t1",
    name: "Üst Gövde A",
    durationMinutes: 60,
    rpe: 7,
    notes: null,
    completed: true,
    setLogs: [set("d", "Bench Press", 1, 102.5, 5), set("e", "Bench Press", 2, 61.25, 8)],
  },
];

function setup(list: WorkoutSession[] = sessions) {
  const s = stubFetch([
    [
      /\/api\/workouts\?id=/,
      (_u, init) => (init?.method === "DELETE" ? jsonResponse({ success: true }) : jsonResponse({ ...list[0], name: "Güncel" })),
    ],
    [/\/api\/workouts\?limit=/, () => jsonResponse({ templates: [], sessions: list })],
  ]);
  restore = s.restore;
  renderWithQuery(<SessionHistory today="2026-10-30" />);
  return s;
}

describe("B19: seans geçmişi", () => {
  it("seansları tarihleriyle, set sayısı ve hacimle listeler (ısınma hacme girmez)", async () => {
    setup();
    const list = await screen.findByRole("list", { name: "Seans geçmişi" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toMatch(/29\.10\.2026/);
    expect(rows[0].textContent).toMatch(/Dün/);
    expect(rows[0].textContent).toMatch(/Dünkü alt vücut/);
    expect(rows[0].textContent).toMatch(/4 set/);
    // 140×5×2 + 120×8 = 2.360 kg (ısınma hariç)
    expect(rows[0].textContent).toMatch(/2\.360 kg/);
    expect(rows[1].textContent).toMatch(/27\.10\.2026/);
  });

  it("Gör, setleri egzersize göre gösterir; ondalık virgülle", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Üst Gövde A · 27.10.2026 setlerini gör" }));
    // B23: iki ondalığa kadar, virgülle
    expect(screen.getByText(/Bench Press/).closest("li")?.textContent).toMatch(/102,5 kg × 5, 61,25 kg × 8/);
  });

  it("Sil önce onay ister; onaylanınca DELETE gönderilir", async () => {
    const s = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Dünkü alt vücut · 29.10.2026 seansını sil" }));
    const dialog = await screen.findByRole("dialog", { name: "Seans silinsin mi?" });
    expect(dialog.textContent).toMatch(/29\.10\.2026/);
    expect(s.calls.some((c) => c.init?.method === "DELETE")).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "Sil" }));
    await waitFor(() => expect(s.calls.find((c) => c.init?.method === "DELETE")?.url).toContain("/api/workouts?id=s2"));
  });

  it("Düzenle tarih, ad ve setleri değiştirip PUT gönderir; set silinebilir", async () => {
    const s = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Dünkü alt vücut · 29.10.2026 seansını düzenle" }));
    const dialog = await screen.findByRole("dialog", { name: "Seansı düzenle" });
    fireEvent.change(within(dialog).getByLabelText("Tarih"), { target: { value: "2026-10-28" } });
    fireEvent.change(within(dialog).getByLabelText("Seans adı"), { target: { value: "Alt A" } });
    fireEvent.change(within(dialog).getByLabelText("Squat 2. set ağırlık"), { target: { value: "142,5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Romanian Deadlift 1. seti sil" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Değişiklikleri kaydet" }));

    await waitFor(() => expect(s.calls.some((c) => c.init?.method === "PUT")).toBe(true));
    const put = s.calls.find((c) => c.init?.method === "PUT")!;
    expect(put.url).toContain("/api/workouts?id=s2");
    const body = JSON.parse(String(put.init?.body));
    expect(body).toMatchObject({ date: "2026-10-28", name: "Alt A", durationMinutes: 50 });
    expect(body.setLogs.map((x: { exerciseName: string; weightKg: number; setType: string }) => [x.exerciseName, x.weightKg, x.setType])).toEqual([
      ["Squat", 60, "warmup"],
      ["Squat", 142.5, "normal"],
      ["Squat", 140, "normal"],
    ]);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Seansı düzenle" })).toBeNull());
  });

  it("kayıt yoksa boş durum gösterir", async () => {
    setup([]);
    expect(await screen.findByText(/Henüz kaydedilmiş seans yok/)).toBeTruthy();
  });
});

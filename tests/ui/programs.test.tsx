import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProgramPicker } from "@/components/workouts/ProgramPicker";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

const LIST = [
  { id: "ev-vucut-agirligi", name: "Evde vücut ağırlığı", description: "Ekipmansız", place: "Ev", daysPerWeek: 3, days: [{ dayOfWeek: 1, name: "Ev Tam Vücut", exercises: 5 }] },
  { id: "ust-alt", name: "Üst / alt (4 gün)", description: "4 gün", place: "Salon", daysPerWeek: 4, days: [] },
  {
    id: "wendler-531",
    name: "5/3/1 (Wendler) · 4 gün",
    description: "%1RM",
    place: "Salon",
    daysPerWeek: 4,
    level: "İleri",
    oneRepMaxLifts: ["Overhead Press", "Deadlift", "Bench Press", "Squat"],
    days: [],
  },
];

let restore: (() => void) | undefined;
afterEach(() => restore?.());

function setup() {
  const s = stubFetch([
    ["/api/workouts/programs", (_u, init) => (init?.method === "POST" ? jsonResponse({ created: 3 }, 201) : jsonResponse(LIST))],
    [
      "/api/progress/strength",
      () => jsonResponse({ exercises: [{ name: "squat", sessions: 4, lastDate: "2026-10-20", bestE1rm: 163.3 }] }),
    ],
  ]);
  restore = s.restore;
  const onClose = vi.fn();
  const onBuildOwn = vi.fn();
  renderWithQuery(<ProgramPicker open onClose={onClose} onBuildOwn={onBuildOwn} />);
  return { ...s, onClose, onBuildOwn };
}
const posted = (s: ReturnType<typeof setup>) => s.calls.filter((c) => c.init?.method === "POST").map((c) => JSON.parse(String(c.init?.body)));

describe("F18: hazır program seçimi", () => {
  it("programı mevcut plana ekler", async () => {
    const s = setup();
    const card = (await screen.findByRole("heading", { name: "Evde vücut ağırlığı" })).closest("li") as HTMLElement;
    expect(within(card).getByText(/Ev · haftada 3 gün/)).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Plana ekle" }));
    await waitFor(() => expect(posted(s)).toEqual([{ programId: "ev-vucut-agirligi", mode: "add" }]));
    await waitFor(() => expect(s.onClose).toHaveBeenCalled());
  });

  it("planın yerine kullanmak ikinci onay ister", async () => {
    const s = setup();
    const card = (await screen.findByRole("heading", { name: "Üst / alt (4 gün)" })).closest("li") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Planın yerine kullan" }));
    expect(posted(s)).toEqual([]);
    fireEvent.click(within(card).getByRole("button", { name: /Mevcut şablonlar silinecek/ }));
    await waitFor(() => expect(posted(s)).toEqual([{ programId: "ust-alt", mode: "replace" }]));
  });

  it("B21: 5/3/1 ileri seviyededir; 1RM'ler sorulur, e1RM geçmişi önerilir, TM %90 gösterilir", async () => {
    const s = setup();
    const card = (await screen.findByRole("heading", { name: "5/3/1 (Wendler) · 4 gün" })).closest("li") as HTMLElement;
    expect(within(card).getByText("İleri")).toBeTruthy();
    const squat = within(card).getByLabelText("Squat 1RM (kg)") as HTMLInputElement;
    // e1RM geçmişi öneri olarak görünür; boş bırakılırsa sunucu onu kullanır.
    await waitFor(() => expect(squat.placeholder).toBe("e1RM 163,3"));
    fireEvent.change(within(card).getByLabelText("Bench Press 1RM (kg)"), { target: { value: "102,5" } });
    expect(within(card).getByText(/Bench Press: TM 90 kg/)).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Plana ekle" }));
    await waitFor(() => expect(posted(s)).toEqual([{ programId: "wendler-531", mode: "add", oneRepMaxes: { "Bench Press": 102.5 } }]));
  });

  it("B21: 'kendi programını kur' yolu öne çıkar", async () => {
    const s = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Kendi programını kur" }));
    expect(s.onBuildOwn).toHaveBeenCalled();
  });
});

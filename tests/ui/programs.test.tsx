import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProgramPicker } from "@/components/workouts/ProgramPicker";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

const LIST = [
  { id: "ev-vucut-agirligi", name: "Evde vücut ağırlığı", description: "Ekipmansız", place: "Ev", daysPerWeek: 3, days: [{ dayOfWeek: 1, name: "Ev Tam Vücut", exercises: 5 }] },
  { id: "ust-alt", name: "Üst / alt (4 gün)", description: "4 gün", place: "Salon", daysPerWeek: 4, days: [] },
];

let restore: (() => void) | undefined;
afterEach(() => restore?.());

function setup() {
  const s = stubFetch([["/api/workouts/programs", (_u, init) => (init?.method === "POST" ? jsonResponse({ created: 3 }, 201) : jsonResponse(LIST))]]);
  restore = s.restore;
  const onClose = vi.fn();
  renderWithQuery(<ProgramPicker open onClose={onClose} />);
  return { ...s, onClose };
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
});

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextWorkoutModal } from "@/components/workouts/TextWorkoutModal";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

function setup() {
  const s = stubFetch([
    ["/api/workouts/templates", () => jsonResponse({ id: "t1" }, 201)],
    ["/api/workouts", () => jsonResponse({ session: { id: "s1" }, progressionFeedbacks: {} }, 201)],
  ]);
  restore = s.restore;
  const onClose = vi.fn();
  const onSaved = vi.fn();
  renderWithQuery(<TextWorkoutModal open date="2026-10-30" onClose={onClose} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText("Antrenman metni"), { target: { value: "squat 3x8 80 kg\nzercher squat 2x5 60\nnot: güzeldi" } });
  return { ...s, onClose, onSaved };
}
const bodyOf = (s: ReturnType<typeof setup>, path: string) =>
  JSON.parse(String(s.calls.find((c) => c.url.endsWith(path) && c.init?.method === "POST")!.init?.body));

describe("F28: metinden antrenman penceresi", () => {
  it("B19: tarih seçici varsayılan olarak bugündür, gelecek gün seçilemez", () => {
    setup();
    const date = screen.getByLabelText("Tarih") as HTMLInputElement;
    expect(date.type).toBe("date");
    expect(date.value).toBe("2026-10-30");
    expect(date.max).toBe("2026-10-30");
  });

  it("B19: dünkü antrenman seçilen tarihe yazılır ve kayıt onaylanır", async () => {
    const s = setup();
    fireEvent.change(screen.getByLabelText("Tarih"), { target: { value: "2026-10-29" } });
    fireEvent.click(screen.getByRole("button", { name: "Seans olarak kaydet (5 set)" }));
    await waitFor(() => expect(s.onClose).toHaveBeenCalled());
    expect(bodyOf(s, "/api/workouts").date).toBe("2026-10-29");
    expect(s.onSaved).toHaveBeenCalledWith(expect.stringMatching(/29\.10\.2026.*5 set/));
  });

  it("B19: şablon olarak kaydederken gün, seçilen tarihten gelir", async () => {
    const s = setup();
    fireEvent.change(screen.getByLabelText("Tarih"), { target: { value: "2026-10-26" } }); // Pazartesi
    fireEvent.click(screen.getByRole("button", { name: "Şablon olarak kaydet" }));
    await waitFor(() => expect(s.onClose).toHaveBeenCalled());
    expect(bodyOf(s, "/api/workouts/templates").dayOfWeek).toBe(1);
  });

  it("B19: geçersiz ya da gelecek tarihte kaydetme kapalıdır", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Tarih"), { target: { value: "2026-11-02" } });
    expect((screen.getByRole("button", { name: "Seans olarak kaydet (5 set)" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Gelecek bir gün seçilemez/)).toBeTruthy();
  });

  it("önizlemede set sayısını, kütüphane dışı adı ve anlaşılmayan satırı gösterir", () => {
    setup();
    expect(screen.getByText(/Squat · 3 set/)).toBeTruthy();
    expect(screen.getByText(/Zercher Squat · 2 set/)).toBeTruthy();
    expect(screen.getByText(/kütüphanede yok/)).toBeTruthy();
    const preview = within(screen.getByRole("list", { name: "Önizleme" }));
    expect(preview.getByText(/not: güzeldi/).closest("li")?.textContent).toMatch(/Anlaşılamadı/);
  });

  it("onaylanınca tamamlanmış seans olarak kaydeder", async () => {
    const s = setup();
    fireEvent.click(screen.getByRole("button", { name: "Seans olarak kaydet (5 set)" }));
    await waitFor(() => expect(s.onClose).toHaveBeenCalled());
    const body = bodyOf(s, "/api/workouts");
    expect(body).toMatchObject({ date: "2026-10-30", name: "Serbest antrenman", completed: true });
    expect(body.setLogs).toHaveLength(5);
    expect(body.setLogs[0]).toMatchObject({ exerciseName: "Squat", setNumber: 1, weightKg: 80, reps: 8 });
  });

  it("şablon olarak kaydederken egzersizleri gruplar (set sayısı, tekrar aralığı, haftanın günü)", async () => {
    const s = setup();
    fireEvent.click(screen.getByRole("button", { name: "Şablon olarak kaydet" }));
    await waitFor(() => expect(s.onClose).toHaveBeenCalled());
    const body = bodyOf(s, "/api/workouts/templates");
    expect(body).toMatchObject({ name: "Serbest antrenman", type: "strength", dayOfWeek: 5 });
    expect(body.exercises).toEqual([
      expect.objectContaining({ exerciseName: "Squat", targetSets: 3, repMin: 8, repMax: 8 }),
      expect.objectContaining({ exerciseName: "Zercher Squat", targetSets: 2, repMin: 5, repMax: 5 }),
    ]);
  });
});

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TemplateEditor } from "@/components/workouts/TemplateEditor";
import { WeeklyPlanGrid } from "@/components/workouts/WeeklyPlanGrid";
import type { WorkoutTemplate } from "@/lib/schemas/workout";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

const ex = (id: string, exerciseName: string, orderIndex: number) => ({ id, exerciseName, targetSets: 3, repMin: 8, repMax: 12, restSeconds: 90, orderIndex });
const TPL: WorkoutTemplate = {
  id: "t1",
  name: "Ağırlık A",
  type: "strength",
  dayOfWeek: 1,
  targetDurationMinutes: 45,
  notes: null,
  exercises: [ex("e1", "Squat", 0), ex("e2", "Bench Press", 1), ex("e3", "Plank", 2)],
};

let restore: (() => void) | undefined;
afterEach(() => restore?.());

function setup(template: WorkoutTemplate | null, dayOfWeek = 1) {
  const s = stubFetch([
    ["/api/exercises", () => jsonResponse([])],
    ["/api/workouts/templates", (_u, init) => jsonResponse({ id: "t-new" }, init?.method === "POST" ? 201 : 200)],
  ]);
  restore = s.restore;
  const onClose = vi.fn();
  renderWithQuery(<TemplateEditor open template={template} dayOfWeek={dayOfWeek} onClose={onClose} />);
  return { ...s, onClose };
}
const req = (s: ReturnType<typeof setup>, method: string) => s.calls.find((c) => c.url.includes("/api/workouts/templates") && c.init?.method === method);

describe("F17: şablon editörü", () => {
  it("var olan şablonu düzenler: ad, sıralama, silme, ekleme; PUT ile kaydeder", async () => {
    const s = setup(TPL);
    const dialog = screen.getByRole("dialog", { name: "Şablonu düzenle" });
    fireEvent.change(within(dialog).getByLabelText("Şablon adı"), { target: { value: "Ağırlık A+" } });
    fireEvent.change(within(dialog).getByLabelText("Squat artış (kg)"), { target: { value: "5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Bench Press yukarı taşı" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Plank çıkar" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Egzersiz ekle" }));
    const names = within(dialog).getAllByLabelText(/Egzersiz \d+ adı/);
    fireEvent.change(names[names.length - 1], { target: { value: "Lateral Raise" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Şablonu kaydet" }));

    await waitFor(() => expect(req(s, "PUT")).toBeTruthy());
    expect(req(s, "PUT")!.url).toContain("id=t1");
    const body = JSON.parse(String(req(s, "PUT")!.init?.body));
    expect(body).toMatchObject({ name: "Ağırlık A+", type: "strength", dayOfWeek: 1, targetDurationMinutes: 45 });
    expect(body.exercises.map((e: any) => e.exerciseName)).toEqual(["Bench Press", "Squat", "Lateral Raise"]);
    // F21: egzersiz başına artış (varsayılan 2,5 kg) gönderilir.
    expect(body.exercises[0].incrementKg).toBe(2.5);
    expect(body.exercises[1]).toMatchObject({ exerciseName: "Squat", incrementKg: 5 });
    await waitFor(() => expect(s.onClose).toHaveBeenCalled());
  });

  it("B21: 5/3/1 hareketinin yüklemesi korunur; antrenman maksimumu düzenlenebilir", async () => {
    const s = setup({ ...TPL, exercises: [{ ...ex("e1", "Squat", 0), loadingScheme: "531", trainingMaxKg: 140, incrementKg: 5 }, ex("e2", "Bench Press", 1)] });
    const dialog = screen.getByRole("dialog", { name: "Şablonu düzenle" });
    expect(within(dialog).queryByLabelText("Bench Press antrenman maksimumu (kg)")).toBeNull();
    fireEvent.change(within(dialog).getByLabelText("Squat antrenman maksimumu (kg)"), { target: { value: "142,5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Şablonu kaydet" }));
    await waitFor(() => expect(req(s, "PUT")).toBeTruthy());
    const body = JSON.parse(String(req(s, "PUT")!.init?.body));
    expect(body.exercises[0]).toMatchObject({ exerciseName: "Squat", loadingScheme: "531", trainingMaxKg: 142.5, incrementKg: 5 });
    expect(body.exercises[1].loadingScheme ?? null).toBeNull();
  });

  it("yeni şablon seçilen günle başlar ve POST ile oluşturulur; boş adlı egzersiz gönderilmez", async () => {
    const s = setup(null, 6);
    const dialog = screen.getByRole("dialog", { name: "Yeni şablon" });
    expect((within(dialog).getByLabelText("Gün") as HTMLSelectElement).value).toBe("6");
    fireEvent.change(within(dialog).getByLabelText("Şablon adı"), { target: { value: "Ev Tam Vücut" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Egzersiz ekle" }));
    fireEvent.change(within(dialog).getByLabelText("Egzersiz 1 adı"), { target: { value: "Pushup" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Egzersiz ekle" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Şablonu kaydet" }));
    await waitFor(() => expect(req(s, "POST")).toBeTruthy());
    const body = JSON.parse(String(req(s, "POST")!.init?.body));
    expect(body).toMatchObject({ name: "Ev Tam Vücut", dayOfWeek: 6 });
    expect(body.exercises.map((e: any) => e.exerciseName)).toEqual(["Pushup"]);
  });

  it("silme iki adımlıdır", async () => {
    const s = setup(TPL);
    fireEvent.click(screen.getByRole("button", { name: "Şablonu sil" }));
    expect(req(s, "DELETE")).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Silmeyi onayla" }));
    await waitFor(() => expect(req(s, "DELETE")!.url).toContain("id=t1"));
  });
});

describe("F17: haftalık plan ızgarası", () => {
  it("şablonlu günde düzenle, boş günde şablon ekle düğmesi var", () => {
    const onEdit = vi.fn();
    render(<WeeklyPlanGrid templates={[TPL]} loading={false} onStart={vi.fn()} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: "Ağırlık A şablonunu düzenle" }));
    fireEvent.click(screen.getByRole("button", { name: "Salı için şablon ekle" }));
    expect(onEdit.mock.calls).toEqual([[TPL, 1], [null, 2]]);
  });
});

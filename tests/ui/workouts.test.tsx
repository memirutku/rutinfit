import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkoutsPage from "@/app/workouts/page";
import { ActiveSessionForm } from "@/components/workouts/ActiveSessionForm";
import { DraftResumeBanner } from "@/components/workouts/DraftResumeBanner";
import { ProgressionFeedbackPanel } from "@/components/workouts/ProgressionFeedbackPanel";
import { WeeklyPlanGrid } from "@/components/workouts/WeeklyPlanGrid";
import { useWorkoutDraft } from "@/components/workouts/useWorkoutDraft";
import {
  addSet,
  buildSessionForm,
  exerciseGroups,
  incompleteSetCount,
  removeSet,
  markAllCompleted,
  parseWorkoutDraft,
  toWorkoutPayload,
  updateSet,
  WORKOUT_DRAFT_KEY,
  type SessionForm,
} from "@/components/workouts/session-form";
import type { Countdown } from "@/hooks/useCountdown";
import type { WorkoutTemplate } from "@/lib/schemas/workout";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

const exercise = (id: string, exerciseName: string, repMin = 8, repMax = 12) => ({
  id,
  exerciseName,
  targetSets: 3,
  repMin,
  repMax,
  restSeconds: 90,
  orderIndex: 0,
});

const strength: WorkoutTemplate = {
  id: "t-a",
  name: "Ağırlık A",
  type: "strength",
  dayOfWeek: 1,
  targetDurationMinutes: 40,
  notes: "Tüm vücut",
  exercises: [
    exercise("e1", "Squat"),
    exercise("e2", "Bench Press"),
    exercise("e3", "Barbell Row"),
    exercise("e4", "Plank", 30, 45),
  ],
};

const run: WorkoutTemplate = {
  id: "t-run",
  name: "Kolay Koşu",
  type: "easy_run",
  dayOfWeek: 2,
  targetDurationMinutes: 30,
  notes: null,
  exercises: [],
};

const countdown = (over: Partial<Countdown> = {}): Countdown => ({
  secondsLeft: 0,
  totalSeconds: 0,
  isRunning: false,
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  reset: vi.fn(),
  ...over,
});

const readDraft = () => localStorage.getItem(WORKOUT_DRAFT_KEY);

describe("seans formu (saf fonksiyonlar)", () => {
  it("hafifletilmiş mod ilk 3 egzersizden 2'şer set kurar; 25 dk, RPE 5", () => {
    const form = buildSessionForm(strength, true);
    expect(form.setLogs).toHaveLength(6);
    expect(new Set(form.setLogs.map((s) => s.exerciseName))).toEqual(new Set(["Squat", "Bench Press", "Barbell Row"]));
    expect(form).toMatchObject({ name: "Ağırlık A (25 dk Hafifletilmiş)", durationMinutes: 25, rpe: 5, templateId: "t-a" });
    expect(form.notes).toMatch(/kısaltılmış/);
  });

  it("normal mod tüm egzersizlerden 3'er set kurar; her setin benzersiz anahtarı vardır", () => {
    const form = buildSessionForm(strength, false);
    expect(form.setLogs).toHaveLength(12);
    expect(form).toMatchObject({ name: "Ağırlık A", durationMinutes: 40, rpe: 7, notes: "" });
    expect(new Set(form.setLogs.map((s) => s.key)).size).toBe(12);
    expect(form.setLogs[0]).toMatchObject({ setNumber: 1, weightKg: null, reps: 12, targetRepMin: 8, targetRepMax: 12 });
  });

  it("B18: seans şablondaki set sayısıyla açılır; hafifletilmiş modda en çok 2 set", () => {
    const tpl: WorkoutTemplate = {
      ...strength,
      exercises: [
        { ...exercise("e1", "Bench Press", 6, 8), targetSets: 4 },
        { ...exercise("e2", "Tricep Pushdown", 10, 15), targetSets: 2 },
        { ...exercise("e3", "Face Pull", 12, 15), targetSets: 1 },
      ],
    };
    const count = (form: SessionForm, name: string) => form.setLogs.filter((s) => s.exerciseName === name).length;
    const normal = buildSessionForm(tpl, false);
    expect([count(normal, "Bench Press"), count(normal, "Tricep Pushdown"), count(normal, "Face Pull")]).toEqual([4, 2, 1]);
    expect(normal.setLogs.filter((s) => s.exerciseName === "Bench Press").map((s) => s.setNumber)).toEqual([1, 2, 3, 4]);
    const short = buildSessionForm(tpl, true);
    expect([count(short, "Bench Press"), count(short, "Tricep Pushdown"), count(short, "Face Pull")]).toEqual([2, 2, 1]);
    // Set sayısı olmayan (eski) şablon 3 setle açılır.
    expect(count(buildSessionForm({ ...tpl, exercises: [{ exerciseName: "Squat", repMin: 5, repMax: 5 }] }, false), "Squat")).toBe(3);
  });

  it("B18: set eklenir (son setin ağırlığı ve hedefiyle) ve silinir; numaralar yeniden sıralanır", () => {
    const base = buildSessionForm(strength, true); // Squat, Bench, Row × 2
    const withWeight = updateSet(base, base.setLogs[1].key, { weightKg: 90, completed: true, setType: "drop" });
    const added = addSet(withWeight, "Squat");
    const squat = added.setLogs.filter((s) => s.exerciseName === "Squat");
    expect(squat.map((s) => s.setNumber)).toEqual([1, 2, 3]);
    expect(squat[2]).toMatchObject({ weightKg: 90, completed: false, setType: "normal", targetRepMin: 8, targetRepMax: 12 });
    // Yeni set egzersizin hemen ardına girer; gruplar korunur.
    expect(added.setLogs.slice(0, 4).map((s) => s.exerciseName)).toEqual(["Squat", "Squat", "Squat", "Bench Press"]);
    expect(new Set(added.setLogs.map((s) => s.key)).size).toBe(added.setLogs.length);

    const removed = removeSet(added, squat[0].key);
    expect(removed.setLogs.filter((s) => s.exerciseName === "Squat").map((s) => [s.setNumber, s.weightKg])).toEqual([
      [1, 90],
      [2, 90],
    ]);
    expect(exerciseGroups(removed).map((g) => [g.exerciseName, g.sets.length])).toEqual([
      ["Squat", 2],
      ["Bench Press", 2],
      ["Barbell Row", 2],
    ]);
    expect(addSet(base, "Yok")).toBe(base);
  });

  it("B17: ağırlık alanı boş başlar; hiçbir sette sihirli 40 kg yoktur", () => {
    for (const shortened of [false, true]) {
      const form = buildSessionForm(strength, shortened);
      expect(form.setLogs.every((s) => s.weightKg === null)).toBe(true);
      expect(form.setLogs.every((s) => !s.completed)).toBe(true);
    }
  });

  it("B17: önceki seans varsa ağırlık o seansın aynı numaralı setinden (yoksa son setinden) gelir", () => {
    const form = buildSessionForm(strength, false, {
      Squat: { date: "2026-10-20", sets: [{ weightKg: 100, reps: 5 }, { weightKg: 102.5, reps: 5 }] },
    });
    const squat = form.setLogs.filter((s) => s.exerciseName === "Squat").map((s) => s.weightKg);
    expect(squat).toEqual([100, 102.5, 102.5]);
    expect(form.setLogs.find((s) => s.exerciseName === "Bench Press")?.weightKg).toBeNull();
  });

  it("B17: yalnız tamamlanan setler gönderilir; set numaraları egzersiz içinde yeniden sıralanır", () => {
    const base = buildSessionForm(strength, false);
    const done = new Set([0, 2, 4]); // Squat 1 ve 3, Bench 2
    const form = { ...base, setLogs: base.setLogs.map((s, i) => (done.has(i) ? { ...s, weightKg: 80, reps: 5, completed: true } : s)) };
    expect(incompleteSetCount(form)).toBe(9);
    const payload = toWorkoutPayload(form, "2026-10-20");
    expect(payload.setLogs?.map((s) => [s.exerciseName, s.setNumber, s.weightKg])).toEqual([
      ["Squat", 1, 80],
      ["Squat", 2, 80],
      ["Bench Press", 1, 80],
    ]);
  });

  it("B17: 'tamamlandı say' bütün setleri işaretler; boş ağırlık 0 kg (vücut ağırlığı) gider", () => {
    const form = markAllCompleted(buildSessionForm(strength, true));
    expect(incompleteSetCount(form)).toBe(0);
    const payload = toWorkoutPayload(form, "2026-10-20");
    expect(payload.setLogs).toHaveLength(6);
    expect(payload.setLogs?.every((s) => s.weightKg === 0)).toBe(true);
  });

  it("B17: hafifletilmiş seansın notu kişisel rutin içermez", () => {
    const form = buildSessionForm(strength, true);
    expect(form.notes).not.toMatch(/iş çıkışı/i);
    expect(form.notes).toMatch(/Hazır olma düşük/);
  });

  it("updateSet yalnız hedef seti değiştirir, formu yerinde değiştirmez", () => {
    const form = buildSessionForm(strength, true);
    const next = updateSet(form, form.setLogs[1].key, { weightKg: 60 });
    expect(next.setLogs[1].weightKg).toBe(60);
    expect(form.setLogs[1].weightKg).toBeNull();
    expect(next.setLogs[0]).toBe(form.setLogs[0]);
  });

  it("API gövdesi istemci anahtarını içermez; tamamlanan set tamamlandı olarak gider", () => {
    const form: SessionForm = {
      ...buildSessionForm(strength, true),
      templateId: "",
    };
    form.setLogs = form.setLogs.map((s, i) => (i < 2 ? { ...s, completed: true, weightKg: 50 } : { ...s, completed: undefined, reps: 5 }));
    const payload = toWorkoutPayload(form, "2026-10-20");
    expect(payload).toMatchObject({ date: "2026-10-20", templateId: undefined, completed: true });
    expect(payload.setLogs).toHaveLength(2);
    expect(payload.setLogs?.[0]).not.toHaveProperty("key");
    expect(payload.setLogs?.every((s) => s.completed === true)).toBe(true);
  });

  it("taslak okuma: bozuk/eksik taslak null; eski (anahtarsız) taslağa anahtar atanır", () => {
    expect(parseWorkoutDraft(null)).toBeNull();
    expect(parseWorkoutDraft("{bozuk")).toBeNull();
    expect(parseWorkoutDraft(JSON.stringify({ sessionForm: { name: "x" } }))).toBeNull();
    const legacy = {
      activeSession: strength,
      sessionForm: {
        templateId: "t-a",
        name: "Ağırlık A",
        durationMinutes: 40,
        rpe: 7,
        notes: "",
        setLogs: [
          { exerciseName: "Squat", setNumber: 1, weightKg: 40, reps: 12, targetRepMin: 8, targetRepMax: 12, completed: true },
          { exerciseName: "Squat", setNumber: 2, weightKg: 40, reps: 12, targetRepMin: 8, targetRepMax: 12 },
        ],
      },
    };
    const draft = parseWorkoutDraft(JSON.stringify(legacy));
    expect(draft?.isShortenedMode).toBe(false);
    expect(draft?.sessionForm.setLogs.every((s) => typeof s.key === "string" && s.key.length > 0)).toBe(true);
    expect(new Set(draft?.sessionForm.setLogs.map((s) => s.key)).size).toBe(2);
  });
});

describe("ActiveSessionForm", () => {
  function renderForm(over: { form?: SessionForm; timer?: Countdown; saveError?: string | null } = {}) {
    const form = over.form ?? buildSessionForm(strength, true);
    const handlers = { onChange: vi.fn(), onFinish: vi.fn(), onDiscard: vi.fn(), onClose: vi.fn() };
    const timer = over.timer ?? countdown();
    render(
      <ActiveSessionForm form={form} restTimer={timer} saving={false} saveError={over.saveError ?? null} {...handlers} />
    );
    return { form, timer, ...handlers };
  }

  it("her satırın etiketi kendi alanına bağlıdır; değişiklik yalnız o seti günceller", () => {
    const { form, onChange } = renderForm();
    const weights = screen.getAllByLabelText("Ağırlık:");
    const reps = screen.getAllByLabelText("Tekrar:");
    expect(weights).toHaveLength(6);
    expect(new Set(weights.map((el) => el.id)).size).toBe(6);

    expect(weights.every((el) => (el as HTMLInputElement).value === "")).toBe(true);
    fireEvent.change(weights[1], { target: { value: "55" } });
    const changed: SessionForm = onChange.mock.calls[0][0];
    expect(changed.setLogs[1].weightKg).toBe(55);
    expect(changed.setLogs[0].weightKg).toBeNull();
    expect(form.setLogs[1].weightKg).toBeNull();

    fireEvent.change(reps[2], { target: { value: "9" } });
    expect((onChange.mock.calls[1][0] as SessionForm).setLogs[2].reps).toBe(9);
  });

  it("set tamamlanınca dinlenme sayacı son seçilen süreyle (yoksa 90 sn) başlar", () => {
    const first = renderForm();
    fireEvent.click(screen.getAllByText("Tamamla")[0]);
    expect((first.onChange.mock.calls[0][0] as SessionForm).setLogs[0].completed).toBe(true);
    expect(first.timer.start).toHaveBeenCalledWith(90);
  });

  it("seçili süre korunur; tamamlanmış seti geri almak sayacı başlatmaz", () => {
    const base = buildSessionForm(strength, true);
    const form = { ...base, setLogs: base.setLogs.map((s, i) => (i === 0 ? { ...s, completed: true } : s)) };
    const timer = countdown({ totalSeconds: 120 });
    const { onChange } = renderForm({ form, timer });
    fireEvent.click(screen.getByText("Tamamlandı"));
    expect((onChange.mock.calls[0][0] as SessionForm).setLogs[0].completed).toBe(false);
    expect(timer.start).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByText("Tamamla")[0]);
    expect(timer.start).toHaveBeenCalledWith(120);
  });

  it("hata uyarısı ve düğmeler: Vazgeç taslağı siler, İptal Et yalnız kapatır", () => {
    const form = markAllCompleted(buildSessionForm(strength, true));
    const { onDiscard, onClose, onFinish } = renderForm({ form, saveError: "Antrenman kaydedilemedi, verileriniz korunuyor: x" });
    expect(screen.getByRole("alert").textContent).toContain("verileriniz korunuyor");
    fireEvent.click(screen.getByText("Vazgeç"));
    fireEvent.click(screen.getByText("İptal Et"));
    fireEvent.click(screen.getByText("Antrenmanı Bitir & Kaydet"));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    // Bütün setler tamamlanmışsa soru sorulmadan kaydedilir.
    expect(onFinish).toHaveBeenCalledWith(form);
  });

  it("B17: tamamlanmamış set varsa bitirirken sorar: at ya da tamamlandı say", () => {
    const base = buildSessionForm(strength, true);
    const form = { ...base, setLogs: base.setLogs.map((s, i) => (i === 0 ? { ...s, weightKg: 60, completed: true } : s)) };
    const { onFinish } = renderForm({ form });
    fireEvent.click(screen.getByText("Antrenmanı Bitir & Kaydet"));
    expect(onFinish).not.toHaveBeenCalled();
    const prompt = screen.getByRole("group", { name: /5 set tamamlanmadı/ });
    expect(prompt.textContent).toMatch(/0 kg/);

    fireEvent.click(screen.getByRole("button", { name: "Seansa dön" }));
    expect(screen.queryByRole("group", { name: /set tamamlanmadı/ })).toBeNull();

    fireEvent.click(screen.getByText("Antrenmanı Bitir & Kaydet"));
    fireEvent.click(screen.getByRole("button", { name: "At ve kaydet" }));
    expect(onFinish).toHaveBeenLastCalledWith(form);

    fireEvent.click(screen.getByText("Antrenmanı Bitir & Kaydet"));
    fireEvent.click(screen.getByRole("button", { name: "Tamamlandı say ve kaydet" }));
    const counted: SessionForm = onFinish.mock.calls.at(-1)![0];
    expect(incompleteSetCount(counted)).toBe(0);
  });

  it("B17: hiç set tamamlanmadıysa 'at' seçeneği kapalıdır", () => {
    renderForm();
    fireEvent.click(screen.getByText("Antrenmanı Bitir & Kaydet"));
    expect(screen.getByRole("group", { name: /6 set tamamlanmadı/ })).toBeTruthy();
    expect((screen.getByRole("button", { name: "At ve kaydet" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("B18: her egzersizde '+ Set' ve set silme düğmeleri vardır", () => {
    const { onChange } = renderForm();
    expect(screen.getAllByRole("button", { name: /için set ekle$/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Bench Press için set ekle" }));
    const added: SessionForm = onChange.mock.calls[0][0];
    expect(added.setLogs.filter((s) => s.exerciseName === "Bench Press")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Squat 2. seti sil" }));
    const removed: SessionForm = onChange.mock.calls[1][0];
    expect(removed.setLogs.filter((s) => s.exerciseName === "Squat")).toHaveLength(1);
    expect(screen.getAllByRole("group", { name: /^Squat|^Bench Press|^Barbell Row/ })).toHaveLength(3);
  });

  it("F20: her sette RPE seçilir; seçim API gövdesine gider, boş seçim null olur", () => {
    const { onChange } = renderForm();
    const rpes = screen.getAllByLabelText("RPE:");
    expect(rpes).toHaveLength(6);
    fireEvent.change(rpes[0], { target: { value: "8.5" } });
    const changed: SessionForm = onChange.mock.calls[0][0];
    expect(changed.setLogs[0].rpe).toBe(8.5);
    const payload = toWorkoutPayload(markAllCompleted(changed), "2026-10-20");
    expect(payload.setLogs?.[0].rpe).toBe(8.5);
    expect(payload.setLogs?.[1].rpe).toBeNull();

    fireEvent.change(rpes[0], { target: { value: "" } });
    expect((onChange.mock.calls[1][0] as SessionForm).setLogs[0].rpe).toBeNull();
  });

  it("F25: egzersiz benzeriyle değiştirilir; o egzersizin bütün setleri yeni adı alır", async () => {
    const stub = stubFetch([
      [
        "/api/exercises?alternativesFor=Squat",
        () =>
          jsonResponse({
            exercise: { id: "squat", name: "Squat", nameTr: "Halter squat" },
            alternatives: [
              { id: "leg-press", name: "Leg Press", nameTr: "Leg press", equipment: "machine" },
              { id: "goblet-squat", name: "Goblet Squat", nameTr: "Goblet squat", equipment: "dumbbell" },
            ],
          }),
      ],
    ]);
    const { onChange, form } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Squat egzersizini değiştir" }));
    fireEvent.click(await screen.findByRole("button", { name: /Leg press/ }));
    const changed: SessionForm = onChange.mock.calls.at(-1)![0];
    expect(changed.setLogs.filter((s) => s.exerciseName === "Leg Press")).toHaveLength(2);
    expect(changed.setLogs.some((s) => s.exerciseName === "Squat")).toBe(false);
    expect(changed.setLogs.filter((s) => s.exerciseName === "Bench Press")).toHaveLength(2);
    expect(form.setLogs[0].exerciseName).toBe("Squat");
    stub.restore();
  });

  it("F19: her sette tip seçilir ve API gövdesine gider", () => {
    const { onChange } = renderForm();
    const types = screen.getAllByLabelText("Tip:");
    expect(types).toHaveLength(6);
    fireEvent.change(types[0], { target: { value: "warmup" } });
    const changed: SessionForm = onChange.mock.calls[0][0];
    expect(changed.setLogs[0].setType).toBe("warmup");
    const payload = toWorkoutPayload(markAllCompleted(changed), "2026-10-20");
    expect(payload.setLogs?.[0].setType).toBe("warmup");
    expect(payload.setLogs?.[1].setType).toBe("normal");
  });

  it("RPE ve süre alanları etiketlidir", () => {
    const { onChange } = renderForm();
    fireEvent.change(screen.getByLabelText("Gerçekleşen Süre (Dakika)"), { target: { value: "33" } });
    expect((onChange.mock.calls[0][0] as SessionForm).durationMinutes).toBe(33);
    fireEvent.change(screen.getByLabelText("Algılanan Zorluk Derecesi (RPE 1 - 10)"), { target: { value: "9" } });
    expect((onChange.mock.calls[1][0] as SessionForm).rpe).toBe(9);
  });
});

describe("F21: ilerleme paneli", () => {
  it("durağanlık varsa uyarı gösterir", () => {
    render(
      <ProgressionFeedbackPanel
        feedback={{
          "Bench Press": {
            isTargetMetAllSets: false,
            currentMaxWeight: 80,
            recommendedNextWeightKg: 80,
            message: "Aynı ağırlıkla devam.",
            badge: "maintain",
            plateau: { sessions: 3, bestE1rm: 101.3, message: "Son 3 seansta yeni rekor yok. Deload dene." },
          },
        }}
      />
    );
    expect(screen.getByRole("note").textContent).toContain("Son 3 seansta yeni rekor yok");
  });
});

describe("küçük bileşenler", () => {
  it("DraftResumeBanner tamamlanan set sayısını gösterir ve düğmeleri bağlar", () => {
    const form = buildSessionForm(strength, true);
    form.setLogs[0] = { ...form.setLogs[0], completed: true };
    const onResume = vi.fn();
    const onDiscard = vi.fn();
    render(<DraftResumeBanner draft={{ activeSession: strength, sessionForm: form, isShortenedMode: true }} onResume={onResume} onDiscard={onDiscard} />);
    expect(screen.getByText(/Yarım Kalan Antrenmanınız Bulundu: Ağırlık A \(25 dk Hafifletilmiş\)/)).toBeTruthy();
    expect(screen.getByText("1 / 6 set tamamlandı.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Kaldığın Yerden Devam Et" }));
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));
    expect(onResume).toHaveBeenCalled();
    expect(onDiscard).toHaveBeenCalled();
  });

  it("WeeklyPlanGrid ağırlık, koşu ve dinlenme günlerini gösterir; başlatma düğmeleri doğru şablonu verir", () => {
    const onStart = vi.fn();
    render(<WeeklyPlanGrid templates={[strength, run]} loading={false} onStart={onStart} />);
    expect(screen.getAllByText("Dinlenme").length).toBeGreaterThan(0);
    expect(screen.getByText(/Squat \(3 set × 8-12 tk\)/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Başla (40 dk)" }));
    fireEvent.click(screen.getByRole("button", { name: "25 dk Hafiflet" }));
    fireEvent.click(screen.getByRole("button", { name: "Koşu Seansı Kaydet (25-35 dk)" }));
    expect(onStart).toHaveBeenNthCalledWith(1, strength, false);
    expect(onStart).toHaveBeenNthCalledWith(2, strength, true);
    expect(onStart.mock.calls[2][0]).toMatchObject({
      id: "t-run",
      exercises: [{ exerciseName: "Kolay Koşu (Konuşma Temposu)", repMin: 25, repMax: 35 }],
    });
    expect(onStart.mock.calls[2][1]).toBe(false);
  });

  it("B18: aynı güne eklenen bütün şablonlar görünür ve başlatılabilir", () => {
    const onStart = vi.fn();
    const second: WorkoutTemplate = { ...strength, id: "t-a2", name: "Ek Program A", targetDurationMinutes: 55 };
    render(<WeeklyPlanGrid templates={[strength, second]} loading={false} onStart={onStart} />);
    expect(screen.getByRole("heading", { name: "Ağırlık A" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ek Program A" })).toBeTruthy();
    fireEvent.click(within(screen.getByRole("article", { name: /Ek Program A/ })).getByRole("button", { name: "Başla (55 dk)" }));
    expect(onStart).toHaveBeenCalledWith(second, false);
  });

  it("WeeklyPlanGrid yüklenirken durum mesajı gösterir", () => {
    render(<WeeklyPlanGrid templates={[]} loading onStart={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain("Antrenman planı yükleniyor");
  });

  it("ProgressionFeedbackPanel egzersiz başına öneriyi gösterir", () => {
    render(
      <ProgressionFeedbackPanel
        feedback={{
          Squat: { isTargetMetAllSets: true, currentMaxWeight: 60, recommendedNextWeightKg: 62.5, message: "+2.5 kg dene", badge: "progression" },
          Row: { isTargetMetAllSets: false, currentMaxWeight: 40, recommendedNextWeightKg: 40, message: "Formu koru", badge: "maintain" },
        }}
      />
    );
    expect(screen.getByText(/Seans Tamamlandı/)).toBeTruthy();
    expect(screen.getByText("Ağırlık Artışı Önerisi")).toBeTruthy();
    expect(screen.getByText("Ağırlığı Koru")).toBeTruthy();
    expect(screen.getByText("+2.5 kg dene")).toBeTruthy();
  });
});

// Sayfa testleri ağır DOM sorguları yapar; makine yüklüyken 5 sn sınırı yetmeyebilir.
describe("Antrenman sayfası (sorgu katmanıyla)", { timeout: 20_000 }, () => {
  const pageTemplate: WorkoutTemplate = { ...strength, exercises: strength.exercises.slice(0, 2) };
  let restore: (() => void) | undefined;
  let lastSets: Record<string, unknown> = {};
  afterEach(() => {
    restore?.();
    restore = undefined;
    lastSets = {};
  });

  function stubWorkouts(post: () => Response = () => jsonResponse({ error: "beklenmedi" }, 500)) {
    const s = stubFetch([
      ["/api/workouts/last-sets", () => jsonResponse(lastSets)],
      [
        "/api/workouts",
        (_url, init) =>
          init?.method === "POST" ? post() : jsonResponse({ templates: [pageTemplate, run], sessions: [] }),
      ],
    ]);
    restore = s.restore;
    return s;
  }

  async function startStrength() {
    fireEvent.click(await screen.findByText("Başla (40 dk)"));
    await screen.findByText("Antrenmanı Bitir & Kaydet");
  }

  it("B17: önceki seansın ağırlıkları yüklendiyse alanlar onlarla dolar", async () => {
    lastSets = { Squat: { date: "2026-10-20", sets: [{ weightKg: 102.5, reps: 5 }] } };
    const s = stubWorkouts();
    const { client } = renderWithQuery(<WorkoutsPage />);
    await waitFor(() => expect(s.calls.some((c) => c.url.includes("/api/workouts/last-sets?exercise=Bench+Press&exercise=Squat"))).toBe(true));
    await waitFor(() => expect(client.isFetching()).toBe(0));
    await startStrength();
    const weights = screen.getAllByLabelText("Ağırlık:") as HTMLInputElement[];
    expect(weights.slice(0, 3).map((w) => w.value)).toEqual(["102,5", "102,5", "102,5"]);
    expect(weights[3].value).toBe("");
  });

  it("B18: şablonda 4 ve 2 set olan hareketler sayfada 4 ve 2 setle açılır", async () => {
    const tpl4: WorkoutTemplate = {
      ...pageTemplate,
      exercises: [{ ...exercise("e1", "Squat"), targetSets: 4 }, { ...exercise("e2", "Bench Press"), targetSets: 2 }],
    };
    restore = stubFetch([
      ["/api/workouts/last-sets", () => jsonResponse({})],
      ["/api/workouts", () => jsonResponse({ templates: [tpl4], sessions: [] })],
    ]).restore;
    renderWithQuery(<WorkoutsPage />);
    await startStrength();
    expect(within(screen.getByRole("group", { name: "Squat" })).getAllByLabelText("Ağırlık:")).toHaveLength(4);
    expect(within(screen.getByRole("group", { name: "Bench Press" })).getAllByLabelText("Ağırlık:")).toHaveLength(2);
  });

  it("set tamamlanınca sayaç başlar ve taslak anahtarlarıyla kaydedilir", async () => {
    stubWorkouts();
    renderWithQuery(<WorkoutsPage />);
    await startStrength();
    fireEvent.click(screen.getAllByText("Tamamla")[0]);
    expect(screen.getByText("Süre akıyor...")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sayacı duraklat" })).toBeTruthy();

    const draft = JSON.parse(readDraft() ?? "null");
    expect(draft.sessionForm.setLogs[0].completed).toBe(true);
    expect(typeof draft.sessionForm.setLogs[0].key).toBe("string");
    expect(draft.activeSession.id).toBe("t-a");
    expect(draft.isShortenedMode).toBe(false);
  });

  it("başarılı kayıtta ilerleme analizi gösterilir, seans kapanır ve taslak silinir", async () => {
    const s = stubWorkouts(() =>
      jsonResponse(
        {
          session: { id: "s1", date: "2026-10-20", templateId: "t-a", name: "Ağırlık A", durationMinutes: 40, rpe: 7, notes: "", completed: true, setLogs: [] },
          progressionFeedbacks: {
            Squat: { isTargetMetAllSets: true, currentMaxWeight: 40, recommendedNextWeightKg: 42.5, message: "Harika", badge: "progression" },
          },
        },
        201
      )
    );
    renderWithQuery(<WorkoutsPage />);
    await startStrength();
    expect(readDraft()).not.toBeNull();
    fireEvent.change(screen.getAllByLabelText("Ağırlık:")[0], { target: { value: "62,5" } });
    fireEvent.click(screen.getAllByText("Tamamla")[0]);
    fireEvent.click(screen.getByText("Antrenmanı Bitir & Kaydet"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "At ve kaydet" })));

    expect(await screen.findByText(/Seans Tamamlandı/)).toBeTruthy();
    expect(screen.queryByText("Antrenmanı Bitir & Kaydet")).toBeNull();
    expect(readDraft()).toBeNull();

    const post = s.calls.find((c) => c.init?.method === "POST");
    const body = JSON.parse(String(post?.init?.body));
    // B17: yalnız tamamlanan set gider; tamamlanmayan 5 set kaydedilmez.
    expect(body.setLogs).toHaveLength(1);
    expect(body.setLogs[0]).toMatchObject({ exerciseName: "Squat", weightKg: 62.5, completed: true });
    expect(body.setLogs[0]).not.toHaveProperty("key");
  });

  it("kayıt 400 dönerse seans ve taslak korunur, hata gösterilir", async () => {
    stubWorkouts(() => jsonResponse({ error: "Geçersiz veri — weightKg" }, 400));
    renderWithQuery(<WorkoutsPage />);
    await startStrength();
    fireEvent.click(screen.getByText("Antrenmanı Bitir & Kaydet"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Tamamlandı say ve kaydet" })));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("verileriniz korunuyor");
    expect(alert.textContent).toContain("Geçersiz veri — weightKg");
    expect(screen.getByText("Antrenmanı Bitir & Kaydet")).toBeTruthy();
    expect(readDraft()).not.toBeNull();
  });

  it("eski (anahtarsız) taslak bulunursa devam edilebilir; anahtarlar atanıp kaydedilir", async () => {
    stubWorkouts();
    localStorage.setItem(
      WORKOUT_DRAFT_KEY,
      JSON.stringify({
        activeSession: pageTemplate,
        sessionForm: {
          templateId: "t-a",
          name: "Ağırlık A",
          durationMinutes: 40,
          rpe: 7,
          notes: "",
          setLogs: [
            { exerciseName: "Squat", setNumber: 1, weightKg: 50, reps: 10, targetRepMin: 8, targetRepMax: 12, completed: true },
            { exerciseName: "Squat", setNumber: 2, weightKg: 50, reps: 10, targetRepMin: 8, targetRepMax: 12, completed: false },
          ],
        },
        isShortenedMode: false,
      })
    );
    renderWithQuery(<WorkoutsPage />);
    expect(await screen.findByText("1 / 2 set tamamlandı.")).toBeTruthy();
    fireEvent.click(screen.getByText("Kaldığın Yerden Devam Et"));

    expect(screen.getByText("Tamamlandı")).toBeTruthy();
    expect((screen.getAllByLabelText("Ağırlık:")[1] as HTMLInputElement).value).toBe("50");
    await waitFor(() => {
      const saved = JSON.parse(readDraft() ?? "null");
      expect(saved.sessionForm.setLogs.every((s: { key?: string }) => typeof s.key === "string")).toBe(true);
    });
  });

  it("taslak bildiriminde Vazgeç taslağı siler", async () => {
    stubWorkouts();
    localStorage.setItem(
      WORKOUT_DRAFT_KEY,
      JSON.stringify({ activeSession: pageTemplate, sessionForm: buildSessionForm(pageTemplate, true), isShortenedMode: true })
    );
    renderWithQuery(<WorkoutsPage />);
    fireEvent.click(await screen.findByText("Vazgeç"));
    expect(screen.queryByText(/Yarım Kalan Antrenmanınız/)).toBeNull();
    expect(readDraft()).toBeNull();
  });

  it("İptal Et taslağı korur, üstteki Vazgeç siler", async () => {
    stubWorkouts();
    renderWithQuery(<WorkoutsPage />);
    await startStrength();
    fireEvent.click(screen.getByText("İptal Et"));
    expect(screen.queryByText("Antrenmanı Bitir & Kaydet")).toBeNull();
    expect(readDraft()).not.toBeNull();

    await startStrength();
    fireEvent.click(screen.getByText("Vazgeç"));
    expect(readDraft()).toBeNull();
  });
});

describe("useWorkoutDraft", () => {
  const storeDraft = (template: WorkoutTemplate) =>
    localStorage.setItem(
      WORKOUT_DRAFT_KEY,
      JSON.stringify({ activeSession: template, sessionForm: buildSessionForm(template, false), isShortenedMode: false })
    );

  it("sunucu HTML'inde ve hydration'da bildirim yok; hydration'dan sonra görünür, uyuşmazlık olmaz", async () => {
    storeDraft(strength);
    function Banner() {
      const { savedDraft } = useWorkoutDraft(null);
      return <p>{savedDraft ? `taslak: ${savedDraft.sessionForm.name}` : "taslak yok"}</p>;
    }

    const html = renderToString(<Banner />);
    expect(html).toContain("taslak yok");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const recoverable = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, <Banner />, { onRecoverableError: recoverable });
    });
    expect(container.textContent).toBe("taslak: Ağırlık A");
    expect(recoverable).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    act(() => root?.unmount());
    container.remove();
  });

  it("açılıştaki taslak bir kez okunur: otomatik kayıt bildirimi değiştirmez; gizle kaydı korur, Vazgeç siler", async () => {
    storeDraft(strength);
    const { result, rerender } = renderHook(({ active }) => useWorkoutDraft(active), {
      initialProps: { active: null as Parameters<typeof useWorkoutDraft>[0] },
    });
    const atMount = result.current.savedDraft;
    expect(atMount?.activeSession.id).toBe("t-a");

    rerender({ active: { template: run, form: buildSessionForm(run, false), shortened: false } });
    await waitFor(() => expect(JSON.parse(readDraft() ?? "null").activeSession.id).toBe("t-run"));
    expect(result.current.savedDraft).toBe(atMount);

    act(() => result.current.dismiss());
    expect(result.current.savedDraft).toBeNull();
    expect(readDraft()).not.toBeNull();

    act(() => result.current.discard());
    expect(readDraft()).toBeNull();
  });

  it("localStorage okunamazsa bildirim gösterilmez", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const { result } = renderHook(() => useWorkoutDraft(null));
    expect(result.current.savedDraft).toBeNull();
    spy.mockRestore();
  });
});

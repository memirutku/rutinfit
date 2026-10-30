import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
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
  buildSessionForm,
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
    expect(form.setLogs[0]).toMatchObject({ setNumber: 1, weightKg: 40, reps: 12, targetRepMin: 8, targetRepMax: 12 });
  });

  it("updateSet yalnız hedef seti değiştirir, formu yerinde değiştirmez", () => {
    const form = buildSessionForm(strength, true);
    const next = updateSet(form, form.setLogs[1].key, { weightKg: 60 });
    expect(next.setLogs[1].weightKg).toBe(60);
    expect(form.setLogs[1].weightKg).toBe(40);
    expect(next.setLogs[0]).toBe(form.setLogs[0]);
  });

  it("API gövdesi istemci anahtarını içermez; isTargetMet işaretten (yoksa tekrardan) gelir", () => {
    const form: SessionForm = {
      ...buildSessionForm(strength, true),
      templateId: "",
    };
    form.setLogs = form.setLogs.map((s, i) => (i === 0 ? { ...s, completed: true } : { ...s, completed: undefined, reps: 5 }));
    const payload = toWorkoutPayload(form, "2026-10-20");
    expect(payload).toMatchObject({ date: "2026-10-20", templateId: undefined, completed: true });
    expect(payload.setLogs?.[0]).not.toHaveProperty("key");
    expect(payload.setLogs?.[0].isTargetMet).toBe(true);
    expect(payload.setLogs?.[1].isTargetMet).toBe(false); // 5 < 8
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
    const handlers = { onChange: vi.fn(), onSubmit: vi.fn((e) => e.preventDefault()), onDiscard: vi.fn(), onClose: vi.fn() };
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

    fireEvent.change(weights[1], { target: { value: "55" } });
    const changed: SessionForm = onChange.mock.calls[0][0];
    expect(changed.setLogs[1].weightKg).toBe(55);
    expect(changed.setLogs[0].weightKg).toBe(40);
    expect(form.setLogs[1].weightKg).toBe(40);

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
    const { onDiscard, onClose, onSubmit } = renderForm({ saveError: "Antrenman kaydedilemedi, verileriniz korunuyor: x" });
    expect(screen.getByRole("alert").textContent).toContain("verileriniz korunuyor");
    fireEvent.click(screen.getByText("Vazgeç"));
    fireEvent.click(screen.getByText("İptal Et"));
    fireEvent.click(screen.getByText("Antrenmanı Bitir & Kaydet"));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("F20: her sette RPE seçilir; seçim API gövdesine gider, boş seçim null olur", () => {
    const { onChange } = renderForm();
    const rpes = screen.getAllByLabelText("RPE:");
    expect(rpes).toHaveLength(6);
    fireEvent.change(rpes[0], { target: { value: "8.5" } });
    const changed: SessionForm = onChange.mock.calls[0][0];
    expect(changed.setLogs[0].rpe).toBe(8.5);
    const payload = toWorkoutPayload(changed, "2026-10-20");
    expect(payload.setLogs?.[0].rpe).toBe(8.5);
    expect(payload.setLogs?.[1].rpe).toBeNull();

    fireEvent.change(rpes[0], { target: { value: "" } });
    expect((onChange.mock.calls[1][0] as SessionForm).setLogs[0].rpe).toBeNull();
  });

  it("RPE ve süre alanları etiketlidir", () => {
    const { onChange } = renderForm();
    fireEvent.change(screen.getByLabelText("Gerçekleşen Süre (Dakika)"), { target: { value: "33" } });
    expect((onChange.mock.calls[0][0] as SessionForm).durationMinutes).toBe(33);
    fireEvent.change(screen.getByLabelText("Algılanan Zorluk Derecesi (RPE 1 - 10)"), { target: { value: "9" } });
    expect((onChange.mock.calls[1][0] as SessionForm).rpe).toBe(9);
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
  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  function stubWorkouts(post: () => Response = () => jsonResponse({ error: "beklenmedi" }, 500)) {
    const s = stubFetch([
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
  }

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
    await act(async () => fireEvent.click(screen.getByText("Antrenmanı Bitir & Kaydet")));

    expect(await screen.findByText(/Seans Tamamlandı/)).toBeTruthy();
    expect(screen.queryByText("Antrenmanı Bitir & Kaydet")).toBeNull();
    expect(readDraft()).toBeNull();

    const post = s.calls.find((c) => c.init?.method === "POST");
    const body = JSON.parse(String(post?.init?.body));
    expect(body.setLogs).toHaveLength(6);
    expect(body.setLogs[0]).not.toHaveProperty("key");
  });

  it("kayıt 400 dönerse seans ve taslak korunur, hata gösterilir", async () => {
    stubWorkouts(() => jsonResponse({ error: "Geçersiz veri — weightKg" }, 400));
    renderWithQuery(<WorkoutsPage />);
    await startStrength();
    await act(async () => fireEvent.click(screen.getByText("Antrenmanı Bitir & Kaydet")));

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

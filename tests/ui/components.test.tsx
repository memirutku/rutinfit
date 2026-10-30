import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UndoToast } from "@/components/dashboard/UndoToast";
import { QuickAddModal } from "@/components/dashboard/QuickAddModal";
import { RestTimer } from "@/components/workouts/RestTimer";
import type { Countdown } from "@/hooks/useCountdown";

describe("UndoToast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("7 sn sonra kendini kapatır; yeni bildirim zamanlayıcıyı yeniden başlatır", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<UndoToast toast={{ key: "a", name: "Yulaf", action: "added" }} onUndo={vi.fn()} onDismiss={onDismiss} />);
    expect(screen.getByRole("status").textContent).toContain("Yulaf");

    act(() => vi.advanceTimersByTime(5000));
    rerender(<UndoToast toast={{ key: "b", name: "Süt", action: "deleted" }} onUndo={vi.fn()} onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(5000));
    expect(onDismiss).not.toHaveBeenCalled(); // önceki bildirimin zamanlayıcısı yenisini kapatmaz
    act(() => vi.advanceTimersByTime(2000));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("süre dolunca en son verilen onDismiss çağrılır; yeni callback zamanlayıcıyı yeniden başlatmaz", () => {
    const toast = { key: "a", name: "Yulaf", action: "added" as const };
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<UndoToast toast={toast} onUndo={vi.fn()} onDismiss={first} />);
    act(() => vi.advanceTimersByTime(5000));
    rerender(<UndoToast toast={toast} onUndo={vi.fn()} onDismiss={second} />);
    act(() => vi.advanceTimersByTime(2000));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("Geri Al ve kapat düğmeleri çalışır; kapat düğmesinin erişilebilir adı vardır", async () => {
    const onUndo = vi.fn().mockResolvedValue(undefined);
    const onDismiss = vi.fn();
    render(<UndoToast toast={{ key: "a", name: "Yulaf", action: "added" }} onUndo={onUndo} onDismiss={onDismiss} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Geri Al/ })));
    expect(onUndo).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Bildirimi kapat" }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe("QuickAddModal — F02 arama", () => {
  it("arama kutusu listeyi Türkçe karakter gerektirmeden süzer ve ilk sonucu seçer", () => {
    const foods = [
      { id: "f1", name: "Yulaf Ezmesi", calories: 370, basisGrams: 100 },
      { id: "f2", name: "Süt", calories: 46, basisGrams: 100 },
      { id: "f3", name: "İnek Sütü", calories: 60, basisGrams: 100 },
    ] as any;
    render(<QuickAddModal open onClose={() => {}} foods={foods} isLoadingFoods={false} recentFoods={[]} initialMealType="lunch" onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Besin ara"), { target: { value: "sut" } });
    const select = screen.getByLabelText("Besin Seçin") as HTMLSelectElement;
    const names = Array.from(select.options).map((o) => o.textContent);
    expect(names.filter((n) => n?.includes("Yulaf"))).toEqual([]);
    expect(names.some((n) => n?.startsWith("Süt"))).toBe(true);
    expect(select.value).toBe("f2");
  });
});

describe("QuickAddModal — F73 ev ölçüleri", () => {
  it("seçilen besinin ölçüsüyle miktar girilir; gram karşılığı gösterilir ve kaydedilir; kullanıcı ölçüsü öncelikli", async () => {
    const foods = [{ id: "f1", name: "Yulaf Ezmesi", calories: 370, basisGrams: 100 }] as any;
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <QuickAddModal
        open
        onClose={() => {}}
        foods={foods}
        isLoadingFoods={false}
        recentFoods={[]}
        initialMealType="breakfast"
        onSubmit={onSubmit}
        customMeasures={{ f1: [{ id: "m1", name: "kase", grams: 45 }] }}
      />
    );
    const unit = screen.getByLabelText("Birim") as HTMLSelectElement;
    expect(Array.from(unit.options).map((o) => o.textContent)).toEqual(["gram", "yemek kaşığı (8 g)", "su bardağı (80 g)", "kase (45 g)"]);
    fireEvent.change(unit, { target: { value: "yemek kaşığı" } });
    fireEvent.change(screen.getByLabelText("Miktar"), { target: { value: "3" } });
    expect(screen.getByText("≈ 24 g")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ekle" }));
    await act(async () => {});
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ foodItemId: "f1", grams: 24, mealType: "breakfast" }));
  });
});

describe("QuickAddModal", () => {
  const foods = [
    { id: "f1", name: "Tavuk Göğsü", calories: 165, basisGrams: 100 },
    { id: "f2", name: "Pirinç", calories: 130, basisGrams: 100 },
  ];

  it("erişilebilir dialog olarak açılır, Esc ile kapanır", () => {
    const onClose = vi.fn();
    render(<QuickAddModal open onClose={onClose} foods={foods} isLoadingFoods={false} recentFoods={[]} onSubmit={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Hızlı Öğün Kaydı" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("Esc, modal açıkken değişen en son onClose'u çağırır", () => {
    const first = vi.fn();
    const second = vi.fn();
    const props = { open: true, foods, isLoadingFoods: false, recentFoods: [], onSubmit: vi.fn() };
    const { rerender } = render(<QuickAddModal {...props} onClose={first} />);
    rerender(<QuickAddModal {...props} onClose={second} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("her açılışta öğün türü ve hata sıfırlanır; besin seçimi korunur", async () => {
    const props = {
      onClose: vi.fn(),
      foods,
      isLoadingFoods: false,
      recentFoods: [],
      initialMealType: "dinner" as const,
      onSubmit: vi.fn().mockRejectedValue(new Error("Sunucu hatası")),
    };
    const { rerender } = render(<QuickAddModal open {...props} />);
    const meal = () => screen.getByLabelText<HTMLSelectElement>("Öğün Türü").value;
    const food = () => screen.getByLabelText<HTMLSelectElement>("Besin Seçin").value;
    expect(meal()).toBe("dinner");
    expect(food()).toBe("f1"); // ilk besin kendiliğinden seçilir

    fireEvent.change(screen.getByLabelText("Öğün Türü"), { target: { value: "breakfast" } });
    fireEvent.change(screen.getByLabelText("Besin Seçin"), { target: { value: "f2" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ekle" })));
    expect(screen.getByRole("alert")).toBeTruthy();

    rerender(<QuickAddModal open={false} {...props} />);
    rerender(<QuickAddModal open {...props} />);
    expect(meal()).toBe("dinner");
    expect(food()).toBe("f2");
    expect(screen.queryByRole("alert")).toBeNull();

    // Açıkken başka bir öğün için açılırsa seçim ona uyar.
    rerender(<QuickAddModal open {...props} initialMealType="workSnack" />);
    expect(meal()).toBe("workSnack");
  });

  it("besinler sonradan yüklenince ilk besin seçilir", () => {
    const props = { open: true, onClose: vi.fn(), recentFoods: [], onSubmit: vi.fn() };
    const { rerender } = render(<QuickAddModal {...props} foods={[]} isLoadingFoods />);
    expect(screen.getByLabelText<HTMLSelectElement>("Besin Seçin").value).toBe("");
    rerender(<QuickAddModal {...props} foods={foods} isLoadingFoods={false} />);
    expect(screen.getByLabelText<HTMLSelectElement>("Besin Seçin").value).toBe("f1");
  });

  it("etiketli alanlarla seçilen değerleri gönderir", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<QuickAddModal open onClose={vi.fn()} foods={foods} isLoadingFoods={false} recentFoods={[]} initialMealType="dinner" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Besin Seçin"), { target: { value: "f2" } });
    fireEvent.change(screen.getByLabelText("Miktar (Gram)"), { target: { value: "180" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ekle" })));
    expect(onSubmit).toHaveBeenCalledWith({ foodItemId: "f2", name: "Pirinç", grams: 180, mealType: "dinner" });
  });

  it("listede olmayan son kullanılan besin de seçilip gönderilebilir", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <QuickAddModal open onClose={vi.fn()} foods={foods} isLoadingFoods={false} recentFoods={[{ id: "old", name: "Kefir", defaultGrams: 250 }]} onSubmit={onSubmit} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Kefir/ }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ekle" })));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ foodItemId: "old", name: "Kefir", grams: 250 }));
  });

  it("kayıt başarısız olursa hata mesajını gösterir ve açık kalır", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Sunucu hatası"));
    const onClose = vi.fn();
    render(<QuickAddModal open onClose={onClose} foods={foods} isLoadingFoods={false} recentFoods={[]} onSubmit={onSubmit} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ekle" })));
    expect(screen.getByRole("alert").textContent).toContain("Sunucu hatası");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("RestTimer", () => {
  const countdown = (over: Partial<Countdown> = {}): Countdown => ({
    secondsLeft: 75, totalSeconds: 90, isRunning: true,
    start: vi.fn(), pause: vi.fn(), resume: vi.fn(), reset: vi.fn(), ...over,
  });

  it("kalan süreyi gösterir ve düğmeler sayacı yönetir", () => {
    const c = countdown();
    render(<RestTimer countdown={c} />);
    expect(screen.getByText("1:15")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sayacı duraklat" }));
    fireEvent.click(screen.getByRole("button", { name: "120s" }));
    expect(c.pause).toHaveBeenCalled();
    expect(c.start).toHaveBeenCalledWith(120);
  });

  it("duraklatılmışken devam ve sıfırla düğmeleri görünür", () => {
    const c = countdown({ isRunning: false, secondsLeft: 40 });
    render(<RestTimer countdown={c} />);
    fireEvent.click(screen.getByRole("button", { name: "Sayaca devam et" }));
    fireEvent.click(screen.getByRole("button", { name: "Sayacı sıfırla" }));
    expect(c.resume).toHaveBeenCalled();
    expect(c.reset).toHaveBeenCalled();
  });
});

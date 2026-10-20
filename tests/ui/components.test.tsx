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

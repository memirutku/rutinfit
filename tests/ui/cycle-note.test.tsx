import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WellbeingCard } from "@/components/dashboard/WellbeingCard";

const today = { date: "2026-10-30", creatineTaken: false, weightKg: 80, energy1to5: 3, sleepMinutes: 420, hunger1to5: null, cycleNote: "period" };

describe("F82: döngü notu", () => {
  it("ayarda kapalıysa seçim görünmez ve kayda eklenmez", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<WellbeingCard today={today} onSave={onSave} />);
    expect(screen.queryByLabelText(/Döngü/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("cycleNote");
  });

  it("açıksa bugünün notuyla dolar; değiştirilip kaydedilir; boş seçim siler", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<WellbeingCard today={today} onSave={onSave} cycleTracking />);
    const select = screen.getByLabelText(/Döngü/) as HTMLSelectElement;
    expect(select.value).toBe("period");
    fireEvent.change(select, { target: { value: "spotting" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({ cycleNote: "spotting" });
    fireEvent.change(select, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[1][0]).toMatchObject({ cycleNote: null });
  });
});

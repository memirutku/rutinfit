import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlateCalculator } from "@/components/PlateCalculator";

describe("F22: plaka hesaplayıcısında ısınma setleri", () => {
  it("hedef ağırlığa göre ısınma tablosunu Türkçe ondalıkla gösterir", () => {
    render(<PlateCalculator />);
    const table = screen.getByRole("table", { name: "Isınma setleri" });
    expect(within(table).getByText(/40 kg × 5/)).toBeTruthy();
    expect(within(table).getByText(/90 kg × 1/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Hedef Toplam Ağırlık (kg)"), { target: { value: "80" } });
    const updated = screen.getByRole("table", { name: "Isınma setleri" });
    expect(within(updated).getByText(/32,5 kg × 5/)).toBeTruthy();
    expect(within(updated).queryByText(/× 1$/)).toBeNull();
  });
});

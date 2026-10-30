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

describe("B23: plaka hesabında ondalıklar (1,25 → '1,3' değil)", () => {
  it("142,5 kg: her tarafa 61,25 kg; 1,25'lik plaka iki ondalıkla ve virgülle", () => {
    const { container } = render(<PlateCalculator />);
    fireEvent.change(screen.getByLabelText("Hedef Toplam Ağırlık (kg)"), { target: { value: "142,5" } });
    expect(screen.getByText("61,25 kg")).toBeTruthy();
    expect(screen.getByText(/Bar 20 kg \+ 2 × 61,25 kg/)).toBeTruthy();
    expect(screen.getByText("1 × 1,25 kg")).toBeTruthy();
    const warmups = screen.getByRole("table", { name: "Isınma setleri" });
    expect(within(warmups).getByText("15 + 2,5 + 1,25")).toBeTruthy();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\d\.\d/); // hiçbir yerde noktalı ondalık yok
    expect(text).not.toMatch(/61,3|1,3\b/);
  });

  it("seçeneklerde ve eksik uyarısında virgül; %1RM tablosunda 2,5'luk ağırlıklar", () => {
    const { container } = render(<PlateCalculator />);
    expect(screen.getByRole("option", { name: /Yaylı Metal Klips \(0,5 kg\)/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Olimpik Yarışma Kilidi \(2,5 kg\)/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Hedef Toplam Ağırlık (kg)"), { target: { value: "61,5" } });
    // her tarafa 20,75: 20 takılır, 0,75 kalır → toplam 1,5 kg eksik
    expect(screen.getByText(/1,5 kg eksik \(mevcut en küçük plaka 1,25 kg\)/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Kaldırılan Ağırlık (kg)"), { target: { value: "97,5" } });
    expect(container.textContent).not.toMatch(/\d\.\d/);
  });
});

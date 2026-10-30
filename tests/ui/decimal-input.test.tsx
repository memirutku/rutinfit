import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DecimalInput } from "@/components/ui/DecimalInput";

function Harness({ initial = 0, onValue }: { initial?: number; onValue: (v: number) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="w">Ağırlık</label>
      <DecimalInput
        id="w"
        value={value}
        onValueChange={(v) => {
          setValue(v);
          onValue(v);
        }}
      />
      <button type="button" onClick={() => setValue(100)}>
        dışarıdan
      </button>
    </>
  );
}

describe("F80: DecimalInput", () => {
  it("virgüllü girişi sayıya çevirir; ondalık klavye ister", () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByLabelText("Ağırlık") as HTMLInputElement;
    expect(input.getAttribute("inputmode")).toBe("decimal");
    fireEvent.change(input, { target: { value: "62,5" } });
    expect(onValue).toHaveBeenLastCalledWith(62.5);
    expect(input.value).toBe("62,5");
  });

  it("yarım yazılmış girişi ('62,') silmez; boş alan 0 sayılır ama ekranda boş kalır", () => {
    const onValue = vi.fn();
    render(<Harness initial={40} onValue={onValue} />);
    const input = screen.getByLabelText("Ağırlık") as HTMLInputElement;
    expect(input.value).toBe("40");
    fireEvent.change(input, { target: { value: "62," } });
    expect(input.value).toBe("62,");
    expect(onValue).toHaveBeenLastCalledWith(62);
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
    expect(onValue).toHaveBeenLastCalledWith(0);
  });

  it("değer dışarıdan değişince ekrandaki metin Türkçe biçimle güncellenir", () => {
    render(<Harness initial={2.5} onValue={vi.fn()} />);
    const input = screen.getByLabelText("Ağırlık") as HTMLInputElement;
    expect(input.value).toBe("2,5");
    fireEvent.click(screen.getByText("dışarıdan"));
    expect(input.value).toBe("100");
  });
});

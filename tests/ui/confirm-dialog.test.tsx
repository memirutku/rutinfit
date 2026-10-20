import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useConfirm } from "@/components/ui/ConfirmDialog";

function Harness({ onResult }: { onResult: (v: boolean) => void }) {
  const { confirm, dialog } = useConfirm();
  return (
    <>
      <button onClick={async () => onResult(await confirm({ title: "Sil", message: "Emin misiniz?", confirmLabel: "Evet" }))}>
        aç
      </button>
      {dialog}
    </>
  );
}

describe("useConfirm", () => {
  it("onaylanınca true, Vazgeç veya Esc ile false döner", async () => {
    const results: boolean[] = [];
    render(<Harness onResult={(v) => results.push(v)} />);

    fireEvent.click(screen.getByText("aç"));
    expect(screen.getByRole("dialog", { name: "Sil" }).textContent).toContain("Emin misiniz?");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Evet" })));

    fireEvent.click(screen.getByText("aç"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Vazgeç" })));

    fireEvent.click(screen.getByText("aç"));
    await act(async () => fireEvent.keyDown(document, { key: "Escape" }));

    expect(results).toEqual([true, false, false]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

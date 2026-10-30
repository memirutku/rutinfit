import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilePicker } from "@/components/ui/FilePicker";

describe("B35: Türkçe dosya seçici", () => {
  it("tarayıcının 'Choose File' metni yerine Türkçe düğme ve seçilen dosyanın adını gösterir", () => {
    const onFile = vi.fn();
    render(<FilePicker id="ornek" label="Fotoğraf" accept="image/png" onFile={onFile} />);
    const input = screen.getByLabelText<HTMLInputElement>("Fotoğraf");
    expect(input.type).toBe("file");
    expect(input.accept).toBe("image/png");
    // Gerçek girdi görünmez ama klavyeyle odaklanabilir (display:none değil).
    expect(input.className).toContain("sr-only");
    expect(screen.getByText("Dosya seç")).toBeTruthy();
    expect(screen.getByText("Dosya seçilmedi")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Choose|No file/i);

    const file = new File(["x"], "on-taraf.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
    expect(screen.getByText("on-taraf.png")).toBeTruthy();
  });

  it("görünen düğme gizli girdiyi açar; pasifken açmaz; dışarıdan sıfırlanınca ad silinir", () => {
    const { rerender } = render(<FilePicker id="yedek" label="Yedek dosyası" buttonText="JSON dosyası seç" onFile={() => {}} fileName="yedek.json" />);
    const input = screen.getByLabelText<HTMLInputElement>("Yedek dosyası");
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    expect(screen.getByText("yedek.json")).toBeTruthy();
    fireEvent.click(screen.getByText("JSON dosyası seç"));
    expect(click).toHaveBeenCalledTimes(1);

    rerender(<FilePicker id="yedek" label="Yedek dosyası" buttonText="JSON dosyası seç" onFile={() => {}} fileName={null} disabled />);
    expect(screen.getByText("Dosya seçilmedi")).toBeTruthy();
    expect(input.disabled).toBe(true);
    fireEvent.click(screen.getByText("JSON dosyası seç"));
    expect(click).toHaveBeenCalledTimes(1);
  });
});

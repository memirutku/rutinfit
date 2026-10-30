import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { Navigation } from "@/components/Navigation";

describe("B32: dar ekran alt menüsü", () => {
  it("Daha fazla menüsü Ayarlar, İlerleme ve diğer sayfalara ulaştırır", () => {
    pathname = "/";
    render(<Navigation />);
    const bottom = screen.getByRole("navigation", { name: "Alt menü" });
    expect(within(bottom).queryByRole("link", { name: /Ayarlar/ })).toBeNull();

    const more = within(bottom).getByRole("button", { name: "Daha fazla" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");

    const sheet = screen.getByRole("dialog", { name: "Diğer sayfalar" });
    const hrefs = within(sheet)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/settings", "/progress", "/pantry", "/opengym", "/report"]));

    // Bağlantıya basınca menü kapanır; Esc de kapatır.
    fireEvent.click(within(sheet).getByRole("link", { name: /Ayarlar/ }));
    expect(screen.queryByRole("dialog", { name: "Diğer sayfalar" })).toBeNull();
    fireEvent.click(more);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Diğer sayfalar" })).toBeNull();
  });

  it("menüdeki bir sayfadayken Daha fazla etkin görünür", () => {
    pathname = "/settings";
    render(<Navigation />);
    const bottom = screen.getByRole("navigation", { name: "Alt menü" });
    expect(within(bottom).getByRole("button", { name: "Daha fazla" }).getAttribute("data-active")).toBe("true");
  });

  it("yan menü yerel çalışmayı Türkçe anlatır", () => {
    render(<Navigation />);
    expect(screen.queryByText(/Yerel-First/)).toBeNull();
  });
});

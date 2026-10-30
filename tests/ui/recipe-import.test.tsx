import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecipeImportModal } from "@/components/foods/RecipeImportModal";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const PREVIEW = {
  name: "Mercimek Köftesi",
  servings: 6,
  prepMinutes: 45,
  instructions: "1. Haşla.",
  sourceUrl: "https://ornek.com/mk",
  ingredients: [
    { raw: "1 su bardağı kırmızı mercimek", match: { type: "food", id: "f1", name: "Kırmızı Mercimek (çiğ)" }, alternatives: [], grams: 180 },
    { raw: "1 demet nane", match: null, alternatives: [], grams: null, note: '"demet nane" katalogda bulunamadı.' },
  ],
};

describe("F33: adresten tarif", () => {
  it("adresi önizler, eşleşmeyen malzemeyi gösterir ve onaylanınca tarifi kaydeder", async () => {
    const s = stubFetch([
      ["/api/recipes/import-url", () => jsonResponse(PREVIEW)],
      ["/api/recipes", () => jsonResponse({ id: "r1" }, 201)],
    ]);
    restore = s.restore;
    const onClose = vi.fn();
    renderWithQuery(<RecipeImportModal open onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Tarif adresi"), { target: { value: "https://ornek.com/mk" } });
    fireEvent.click(screen.getByRole("button", { name: "Getir" }));
    expect(await screen.findByDisplayValue("Mercimek Köftesi")).toBeTruthy();
    expect(screen.getByText(/katalogda bulunamadı/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tarifi kaydet (1 malzeme)" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const post = s.calls.find((c) => c.url.endsWith("/api/recipes") && c.init?.method === "POST")!;
    expect(JSON.parse(String(post.init?.body))).toMatchObject({
      name: "Mercimek Köftesi",
      servings: 6,
      prepMinutes: 45,
      tags: ["İçe aktarıldı"],
      ingredients: [{ foodItemId: "f1", grams: 180 }],
    });
    expect(JSON.parse(String(post.init?.body)).instructions).toContain("Kaynak: https://ornek.com/mk");
  });

  it("sunucu reddederse mesajı gösterir", async () => {
    restore = stubFetch([["/api/recipes/import-url", () => jsonResponse({ error: "Yerel ağdaki ya da bu bilgisayardaki adresler içe aktarılamaz." }, 400)]]).restore;
    renderWithQuery(<RecipeImportModal open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Tarif adresi"), { target: { value: "http://192.168.1.1" } });
    fireEvent.click(screen.getByRole("button", { name: "Getir" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Yerel ağdaki/);
  });
});

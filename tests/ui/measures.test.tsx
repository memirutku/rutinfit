import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MeasuresModal } from "@/components/foods/MeasuresModal";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

describe("F73: besin ölçüleri penceresi", () => {
  it("yerleşik ve kullanıcı ölçülerini listeler; ölçü ekler ve kullanıcı ölçüsünü siler", async () => {
    const s = stubFetch([
      [
        "/api/foods/measures",
        (_u, init) =>
          init?.method === "POST"
            ? jsonResponse({ id: "m2" }, 201)
            : init?.method === "DELETE"
              ? jsonResponse({ success: true })
              : jsonResponse({
                  food: { id: "f1", name: "Yulaf Ezmesi" },
                  measures: [
                    { name: "yemek kaşığı", grams: 8, source: "builtin" },
                    { id: "m1", name: "kase", grams: 45, source: "custom" },
                  ],
                }),
      ],
    ]);
    restore = s.restore;
    renderWithQuery(<MeasuresModal open food={{ id: "f1", name: "Yulaf Ezmesi" }} onClose={vi.fn()} />);
    expect(await screen.findByText(/yemek kaşığı · 8 g/)).toBeTruthy();
    expect(screen.getByText(/kase · 45 g/).closest("li")?.textContent).toContain("senin tartımın");
    expect(screen.queryByRole("button", { name: "yemek kaşığı ölçüsünü sil" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Ölçü"), { target: { value: "su bardağı" } });
    fireEvent.change(screen.getByLabelText("Gram"), { target: { value: "85" } });
    fireEvent.click(screen.getByRole("button", { name: "Ölçüyü kaydet" }));
    await waitFor(() => expect(s.calls.some((c) => c.init?.method === "POST")).toBe(true));
    expect(JSON.parse(String(s.calls.find((c) => c.init?.method === "POST")!.init?.body))).toEqual({ foodItemId: "f1", name: "su bardağı", grams: 85 });

    fireEvent.click(screen.getByRole("button", { name: "kase ölçüsünü sil" }));
    await waitFor(() => expect(s.calls.some((c) => c.init?.method === "DELETE" && c.url.includes("id=m1"))).toBe(true));
  });
});

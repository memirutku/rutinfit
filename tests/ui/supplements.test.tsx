import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SupplementsCard } from "@/components/dashboard/SupplementsCard";
import { SupplementsSection } from "@/components/settings/SupplementsSection";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const list = [
  { id: "s1", name: "Kreatin Monohidrat", doseAmount: 5, doseUnit: "g", active: true, notes: null, takenToday: true, takenLast7: 6 },
  { id: "s2", name: "D Vitamini", doseAmount: 1000, doseUnit: "IU", active: true, notes: "Kahvaltıyla", takenToday: false, takenLast7: 2 },
  { id: "s3", name: "Eski Takviye", doseAmount: 1, doseUnit: "tablet", active: false, notes: null, takenToday: false, takenLast7: 0 },
];

describe("F15: takviyeler", () => {
  it("panoda yalnız aktif takviyeler görünür; işaretleme günü ve durumu gönderir", async () => {
    const logs: unknown[] = [];
    restore = stubFetch([
      ["/api/supplements/log", (_u, init) => {
        logs.push(JSON.parse(String(init?.body)));
        return jsonResponse({ ok: true });
      }],
      ["/api/supplements", () => jsonResponse({ supplements: list })],
    ]).restore;
    renderWithQuery(<SupplementsCard date="2026-10-30" />);
    const creatine = await screen.findByRole("button", { name: /Kreatin Monohidrat/ });
    expect(creatine.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/5 g · 6\/7 gün/)).toBeTruthy();
    expect(screen.queryByText("Eski Takviye")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /D Vitamini/ }));
    await waitFor(() => expect(logs).toEqual([{ supplementId: "s2", date: "2026-10-30", taken: true }]));
  });

  it("panoda takviye yoksa ayarlara yönlendirir", async () => {
    restore = stubFetch([["/api/supplements", () => jsonResponse({ supplements: [] })]]).restore;
    renderWithQuery(<SupplementsCard date="2026-10-30" />);
    expect(await screen.findByText(/Ayarlar'dan takviye ekleyebilirsin/)).toBeTruthy();
  });

  it("ayarlarda takviye eklenir, pasifleştirilir ve silinir", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    restore = stubFetch([
      ["/api/supplements", (url, init) => {
        const method = init?.method ?? "GET";
        if (method !== "GET") calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        return method === "GET" ? jsonResponse({ supplements: list }) : jsonResponse({ ok: true });
      }],
    ]).restore;
    renderWithQuery(<SupplementsSection />);
    const row = (await screen.findByText("D Vitamini")).closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "D Vitamini pasifleştir" }));
    fireEvent.click(within(row).getByRole("button", { name: "D Vitamini sil" }));
    await waitFor(() => expect(calls).toHaveLength(2));
    fireEvent.change(screen.getByLabelText("Takviye adı"), { target: { value: "Omega 3" } });
    fireEvent.change(screen.getByLabelText("Doz"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Birim"), { target: { value: "kapsül" } });
    const addButton = screen.getByRole("button", { name: "Takviye ekle" }) as HTMLButtonElement;
    await waitFor(() => expect(addButton.disabled).toBe(false));
    fireEvent.click(addButton);
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[0]).toMatchObject({ method: "PATCH", body: { active: false } });
    expect(calls[0].url).toContain("id=s2");
    expect(calls[1]).toMatchObject({ method: "DELETE" });
    expect(calls[2]).toMatchObject({ method: "POST", body: { name: "Omega 3", doseAmount: 2, doseUnit: "kapsül" } });
    expect(within(screen.getByText("Eski Takviye").closest("li")!).getByText("pasif")).toBeTruthy();
  });
});

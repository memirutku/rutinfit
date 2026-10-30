import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SupplementsCard } from "@/components/dashboard/SupplementsCard";
import { SupplementsSection } from "@/components/settings/SupplementsSection";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const none = { caloriesPerDose: null, proteinPerDose: null };
const list = [
  { id: "s1", name: "Kreatin Monohidrat", doseAmount: 5, doseUnit: "g", active: true, notes: null, takenToday: true, takenLast7: 6, ...none },
  { id: "s2", name: "D Vitamini", doseAmount: 1000, doseUnit: "IU", active: true, notes: "Kahvaltıyla", takenToday: false, takenLast7: 2, ...none },
  { id: "s3", name: "Eski Takviye", doseAmount: 1, doseUnit: "tablet", active: false, notes: null, takenToday: false, takenLast7: 0, ...none },
];
const whey = { id: "s4", name: "Whey Protein", doseAmount: 30, doseUnit: "g", active: true, notes: null, takenToday: false, takenLast7: 0, caloriesPerDose: 120, proteinPerDose: 24 };

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

  it("B12: panodaki kartta liste doluyken de '+ Takviye / Düzenle' bağlantısı ve günlüğe yazılan değer görünür", async () => {
    restore = stubFetch([["/api/supplements", () => jsonResponse({ supplements: [...list, whey] })]]).restore;
    renderWithQuery(<SupplementsCard date="2026-10-30" />);
    const link = await screen.findByRole("link", { name: "+ Takviye / Düzenle" });
    expect(link.getAttribute("href")).toBe("/settings#takviyeler");
    expect(await screen.findByText(/30 g · 24 g protein · 0\/7 gün/)).toBeTruthy();
  });

  it("B12: işaretleme günlük öğün özetini de tazeler", async () => {
    restore = stubFetch([
      ["/api/supplements/log", () => jsonResponse({ ok: true })],
      ["/api/supplements", () => jsonResponse({ supplements: [whey] })],
    ]).restore;
    const { client } = renderWithQuery(<SupplementsCard date="2026-10-30" />);
    client.setQueryData(["food-logs", "2026-10-30"], { logs: [] });
    fireEvent.click(await screen.findByRole("button", { name: /Whey Protein/ }));
    await waitFor(() => expect(client.getQueryState(["food-logs", "2026-10-30"])?.isInvalidated).toBe(true));
  });

  it("B12: ayarlarda doz başına kalori ve protein girilir; var olan takviye düzenlenir", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    restore = stubFetch([
      ["/api/supplements", (url, init) => {
        const method = init?.method ?? "GET";
        if (method !== "GET") calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        return method === "GET" ? jsonResponse({ supplements: [whey] }) : jsonResponse({ ok: true });
      }],
    ]).restore;
    renderWithQuery(<SupplementsSection />);
    expect(document.getElementById("takviyeler")).not.toBeNull();
    const row = (await screen.findByText("Whey Protein")).closest("li")!;
    expect(row.textContent).toContain("120 kcal · 24 g protein günlüğe yazılır");

    fireEvent.change(screen.getByLabelText("Takviye adı"), { target: { value: "Kazein" } });
    fireEvent.change(screen.getByLabelText("Doz"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Kalori (doz başına)"), { target: { value: "110" } });
    fireEvent.change(screen.getByLabelText("Protein (g, doz başına)"), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "Takviye ekle" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ method: "POST", body: { name: "Kazein", doseAmount: 30, caloriesPerDose: 110, proteinPerDose: 24 } });

    fireEvent.click(within(row).getByRole("button", { name: "Whey Protein düzenle" }));
    expect(screen.getByLabelText<HTMLInputElement>("Takviye adı").value).toBe("Whey Protein");
    fireEvent.change(screen.getByLabelText("Protein (g, doz başına)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].url).toContain("id=s4");
    expect(calls[1]).toMatchObject({ method: "PATCH", body: { name: "Whey Protein", doseAmount: 30, caloriesPerDose: 120, proteinPerDose: null } });
  });
});

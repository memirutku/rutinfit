import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

const records = Array.from({ length: 6001 }, (_, i) => ({ key: `steps:${i}`, type: "steps", date: "2026-10-01", value: 1, unit: "count", source: "Watch" }));
vi.mock("@/lib/apple-health", () => ({
  readAppleHealthExport: vi.fn(async (_file: Blob, onProgress?: (r: number, t: number) => void) => {
    onProgress?.(50, 100);
    onProgress?.(100, 100);
    return { records, stats: { lines: 9000, records: 8000, skipped: 1000, workouts: 0 } };
  }),
}));

const { AppleHealthSection } = await import("@/components/progress/AppleHealthSection");

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const summary = (total: number) => ({
  total,
  lastImportedAt: total ? "2026-10-30T09:00:00.000Z" : null,
  steps: { avg7: 7300, avg30: 7100, series: [] },
  activeKcal: { avg7: 410 },
  restingHr: { latest: { value: 61, date: "2026-10-30" }, avg30: 62 },
  weight: { latest: { value: 100.2, date: "2026-10-29" }, ownLatest: { value: 101, date: "2026-10-28" } },
  workouts: [{ id: "w1", date: "2026-10-27", source: "Apple Watch", detail: { activity: "Koşu", durationMin: 30.5, distanceKm: 5, kcal: 320 } }],
});

describe("F62: Apple Sağlık bölümü", () => {
  it("dosyayı tarayıcıda okur, 5000'lik partilerle gönderir ve sonucu gösterir", async () => {
    const batches: number[] = [];
    let total = 0;
    restore = stubFetch([
      ["/api/apple-health/import", (_u, init) => {
        const n = JSON.parse(String(init?.body)).records.length;
        batches.push(n);
        total += n;
        return jsonResponse({ created: n, updated: 0 });
      }],
      ["/api/apple-health", () => jsonResponse(summary(total))],
    ]).restore;
    renderWithQuery(<AppleHealthSection />);
    expect(await screen.findByText(/Henüz Apple Sağlık verisi yok/)).toBeTruthy();
    const input = screen.getByLabelText("Apple Sağlık dışa aktarımı (export.zip)");
    fireEvent.change(input, { target: { files: [new File(["x"], "export.zip")] } });
    expect(await screen.findByText(/6.001 kayıt içe aktarıldı \(6.001 yeni, 0 güncellendi\)/)).toBeTruthy();
    expect(batches).toEqual([5000, 1001]);
    expect(await screen.findByText("7.300")).toBeTruthy();
    expect(screen.getByText(/Koşu · 30,5 dk · 5 km/)).toBeTruthy();
    expect(screen.getByText(/kendi kaydın: 101 kg/)).toBeTruthy();
  });

  it("silme iki adımda onaylanır", async () => {
    let deleted = false;
    restore = stubFetch([
      ["/api/apple-health", (_u, init) => {
        if (init?.method === "DELETE") {
          deleted = true;
          return jsonResponse({ deleted: 5 });
        }
        return jsonResponse(summary(deleted ? 0 : 5));
      }],
    ]).restore;
    renderWithQuery(<AppleHealthSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Apple Sağlık verilerini kaldır" }));
    expect(deleted).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Kaldırmayı onayla" }));
    await waitFor(() => expect(deleted).toBe(true));
    expect(await screen.findByText(/Henüz Apple Sağlık verisi yok/)).toBeTruthy();
  });
});

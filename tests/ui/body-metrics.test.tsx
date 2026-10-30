import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BodyMetricsSection } from "@/components/progress/BodyMetricsSection";
import { PhotosSection } from "@/components/progress/PhotosSection";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const metrics = {
  from: "2025-10-31",
  to: "2026-10-30",
  entries: [
    { id: "m1", date: "2026-09-01", waistCm: 104, hipCm: null, chestCm: null, armCm: null, thighCm: null, neckCm: null, bodyFatPercent: null, restingHr: null, systolic: 128, diastolic: 82, notes: null },
    { id: "m2", date: "2026-10-15", waistCm: 99.5, hipCm: null, chestCm: null, armCm: null, thighCm: null, neckCm: null, bodyFatPercent: null, restingHr: 61, systolic: 146, diastolic: 88, notes: null },
  ],
  latest: { waistCm: { value: 99.5, date: "2026-10-15" }, restingHr: { value: 61, date: "2026-10-15" }, systolic: { value: 146, date: "2026-10-15" }, diastolic: { value: 88, date: "2026-10-15" } },
  changes: { waistCm: { from: 104, to: 99.5, delta: -4.5 } },
  waistToHeight: { ratio: 0.55, elevated: true },
  bloodPressure: { date: "2026-10-15", systolic: 146, diastolic: 88, level: "high", message: "Yüksek ölçüm. 5 dakika oturup dinlendikten sonra tekrar ölç." },
};

describe("F16: ölçüler ve fotoğraflar", () => {
  it("son değerleri, değişimi, bel/boy oranını ve tansiyon uyarısını gösterir; yeni ölçü kaydeder", async () => {
    const puts: unknown[] = [];
    restore = stubFetch([
      ["/api/body-metrics", (_u, init) => {
        if (init?.method === "PUT") {
          puts.push(JSON.parse(String(init.body)));
          return jsonResponse({ ok: true });
        }
        return jsonResponse(metrics);
      }],
    ]).restore;
    renderWithQuery(<BodyMetricsSection today="2026-10-30" />);
    const waist = (await screen.findByText("Bel")).closest("li")!;
    expect(within(waist).getByText("99,5 cm")).toBeTruthy();
    expect(within(waist).getByText("−4,5")).toBeTruthy();
    expect(screen.getByText(/Bel\/boy oranı 0,55/)).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("146/88");

    fireEvent.change(screen.getByLabelText("Bel (cm)"), { target: { value: "98,5" } });
    fireEvent.change(screen.getByLabelText("Dinlenik nabız"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Ölçüleri kaydet" }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ date: "2026-10-30", waistCm: 98.5, restingHr: 60 });
  });

  it("fotoğraflar tarih ve pozla listelenir; ilk ve son fotoğraf yan yana karşılaştırılır; klasör ve yedek notu görünür", async () => {
    restore = stubFetch([
      ["/api/progress-photos", () =>
        jsonResponse({
          folder: "/Users/x/Library/Application Support/RutinFit/progress-photos",
          photos: [
            { id: "p3", date: "2026-10-20", pose: "front", fileName: "c.jpg", mimeType: "image/jpeg", sizeBytes: 10, notes: null },
            { id: "p2", date: "2026-10-01", pose: "side", fileName: "b.jpg", mimeType: "image/jpeg", sizeBytes: 10, notes: null },
            { id: "p1", date: "2026-09-01", pose: "front", fileName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 10, notes: "Başlangıç" },
          ],
        })],
    ]).restore;
    renderWithQuery(<PhotosSection />);
    const compare = await screen.findByRole("group", { name: "Karşılaştırma" });
    const imgs = (await within(compare).findAllByRole("img")) as HTMLImageElement[];
    expect(imgs.map((i) => i.getAttribute("src"))).toEqual(["/api/progress-photos/file?id=p1", "/api/progress-photos/file?id=p3"]);
    expect(within(compare).getByText(/01.09.2026/)).toBeTruthy();
    expect(screen.getByText(/progress-photos/)).toBeTruthy();
    expect(screen.getByText(/yedek dosyasına girmez/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Karşılaştırılacak poz"), { target: { value: "side" } });
    expect(within(screen.getByRole("group", { name: "Karşılaştırma" })).getByText(/Karşılaştırmak için bu pozda en az iki fotoğraf gerekir/)).toBeTruthy();
  });
});

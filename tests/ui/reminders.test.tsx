import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReminderRunner } from "@/components/ReminderRunner";
import { RemindersSection, daysLabel } from "@/components/settings/RemindersSection";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => {
  restore?.();
  vi.unstubAllGlobals();
});

function stubNotification(permission: NotificationPermission) {
  const shown: Array<{ title: string; body?: string }> = [];
  class FakeNotification {
    static permission = permission;
    static requestPermission = vi.fn(async () => "granted" as NotificationPermission);
    constructor(title: string, opts?: { body?: string }) {
      shown.push({ title, body: opts?.body });
    }
  }
  vi.stubGlobal("Notification", FakeNotification);
  return { shown, FakeNotification };
}

describe("F83: hatırlatmalar", () => {
  it("vakti gelen hatırlatma sistem bildirimi ve ekranda görünür; bugün için işaretlenir", async () => {
    const fired: unknown[] = [];
    let served = false;
    restore = stubFetch([
      ["/api/reminders/due", () => {
        const due = served ? [] : [{ id: "r1", kind: "water", title: "Su iç", body: "Bugün 500 / 2.500 ml içtin." }];
        served = true;
        return jsonResponse({ due });
      }],
      ["/api/reminders/fired", (_u, init) => {
        fired.push(JSON.parse(String(init?.body)));
        return jsonResponse({ ok: true });
      }],
    ]).restore;
    const { shown } = stubNotification("granted");
    render(<ReminderRunner intervalMs={20} />);
    expect(await screen.findByText("Su iç")).toBeTruthy();
    expect(shown).toEqual([{ title: "Su iç", body: "Bugün 500 / 2.500 ml içtin." }]);
    expect(fired).toEqual([{ ids: ["r1"] }]);
    // Sonraki yoklamalar aynı hatırlatmayı tekrar göstermez.
    await act(() => new Promise((r) => setTimeout(r, 80)));
    expect(shown).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Su iç hatırlatmasını kapat" }));
    expect(screen.queryByText("Su iç")).toBeNull();
  });

  it("izin yoksa yalnız uygulama içinde gösterir; sunucu hatasında sessiz kalır", async () => {
    restore = stubFetch([
      ["/api/reminders/due", () => jsonResponse({ due: [{ id: "r2", kind: "custom", title: "Esneme", body: "" }] })],
      ["/api/reminders/fired", () => jsonResponse({ error: "x" }, 500)],
    ]).restore;
    const { shown } = stubNotification("denied");
    render(<ReminderRunner intervalMs={1000} />);
    await new Promise((r) => setTimeout(r, 50));
    // İşaretleme başarısızsa bildirim gösterilmez (bir sonraki dakikada yeniden denenir).
    expect(screen.queryByText("Esneme")).toBeNull();
    expect(shown).toEqual([]);
  });

  it("gün etiketleri", () => {
    expect(daysLabel("1234567")).toBe("Her gün");
    expect(daysLabel("12345")).toBe("Hafta içi");
    expect(daysLabel("67")).toBe("Hafta sonu");
    expect(daysLabel("135")).toBe("Pzt, Çar, Cum");
  });

  it("ayarlarda takviye hatırlatması seçili günlerle eklenir; kapatılır ve silinir; izin istenir", async () => {
    const calls: Array<{ url: string; method: string; body?: any }> = [];
    restore = stubFetch([
      ["/api/supplements", () =>
        jsonResponse({ supplements: [{ id: "s1", name: "Omega 3", doseAmount: 2, doseUnit: "kapsül", active: true, notes: null, takenToday: false, takenLast7: 0 }] })],
      ["/api/reminders", (url, init) => {
        const method = init?.method ?? "GET";
        if (method !== "GET") calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        return method === "GET"
          ? jsonResponse({ reminders: [{ id: "r1", kind: "water", title: "Su iç", time: "10:00", days: "12345", enabled: true, mealType: null, supplementId: null }] })
          : jsonResponse({ ok: true });
      }],
    ]).restore;
    const { FakeNotification } = stubNotification("default");
    renderWithQuery(<RemindersSection />);
    const row = (await screen.findByText(/Su iç/)).closest("li")!;
    expect(within(row).getByText(/Hafta içi/)).toBeTruthy();

    fireEvent.click(await screen.findByRole("button", { name: "Bildirimlere izin ver" }));
    await waitFor(() => expect(FakeNotification.requestPermission).toHaveBeenCalled());
    expect(await screen.findByText("Sistem bildirimleri açık.")).toBeTruthy();

    fireEvent.click(within(row).getByLabelText("Su iç açık"));
    await waitFor(() => expect(calls).toHaveLength(1));
    fireEvent.click(within(row).getByRole("button", { name: "Su iç hatırlatmasını sil" }));
    await waitFor(() => expect(calls).toHaveLength(2));

    fireEvent.change(screen.getByLabelText("Tür"), { target: { value: "supplement" } });
    fireEvent.change(await screen.findByLabelText("Takviye"), { target: { value: "s1" } });
    fireEvent.change(screen.getByLabelText("Saat"), { target: { value: "21:30" } });
    const group = screen.getByRole("group", { name: "Günler" });
    fireEvent.click(within(group).getByRole("button", { name: "Cmt" }));
    fireEvent.click(within(group).getByRole("button", { name: "Paz" }));
    const addButton = screen.getByRole("button", { name: "Hatırlatma ekle" }) as HTMLButtonElement;
    await waitFor(() => expect(addButton.disabled).toBe(false));
    fireEvent.click(addButton);
    await waitFor(() => expect(calls).toHaveLength(3));

    expect(calls[0]).toMatchObject({ method: "PATCH", body: { enabled: false } });
    expect(calls[0].url).toContain("id=r1");
    expect(calls[1]).toMatchObject({ method: "DELETE" });
    expect(calls[2]).toMatchObject({ method: "POST", body: { kind: "supplement", supplementId: "s1", time: "21:30", days: "12345" } });
  });

  it("B41: 'Takvime aktar (.ics)' dosyayı indirir; nereye indiğini ve telefona nasıl ekleneceğini söyler", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:ics"), revokeObjectURL: vi.fn() }));
    const requested: string[] = [];
    restore = stubFetch([
      ["/api/supplements", () => jsonResponse({ supplements: [] })],
      ["/api/reminders/ics", (url) => {
        requested.push(url);
        return new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", {
          headers: {
            "Content-Type": "text/calendar",
            "Content-Disposition": 'attachment; filename="rutinfit-hatirlatmalar-2026-10-30.ics"',
            "X-RutinFit-Export-Path": encodeURIComponent("/data/exports/rutinfit-hatirlatmalar-2026-10-30.ics"),
          },
        });
      }],
      ["/api/reminders", () => jsonResponse({ reminders: [{ id: "r1", kind: "water", title: "Su iç", time: "10:00", days: "1234567", enabled: true, mealType: null, supplementId: null }] })],
    ]).restore;
    renderWithQuery(<RemindersSection />);
    expect(await screen.findByText(/telefonuna da gelir/)).toBeTruthy();
    const button = await screen.findByRole("button", { name: "Takvime aktar (.ics)" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    expect(await screen.findByText("Takvim dosyası indirildi: rutinfit-hatirlatmalar-2026-10-30.ics (İndirilenler klasörü)")).toBeTruthy();
    expect(requested).toHaveLength(1);
    expect(screen.getByRole("button", { name: "İndirilen takvim dosyasını Finder'da göster" })).toBeTruthy();
    expect(screen.getByText(/iş yapılmış olsa da/)).toBeTruthy();
  });

  it("B41: açık hatırlatma yoksa takvim düğmesi pasiftir", async () => {
    restore = stubFetch([
      ["/api/supplements", () => jsonResponse({ supplements: [] })],
      ["/api/reminders", () => jsonResponse({ reminders: [{ id: "r1", kind: "water", title: "Su iç", time: "10:00", days: "1234567", enabled: false, mealType: null, supplementId: null }] })],
    ]).restore;
    renderWithQuery(<RemindersSection />);
    await screen.findByText(/Su iç/);
    expect((screen.getByRole("button", { name: "Takvime aktar (.ics)" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

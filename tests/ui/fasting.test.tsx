import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FastingCard, formatDuration } from "@/components/dashboard/FastingCard";
import { FastingSection } from "@/components/settings/FastingSection";
import { dashboardMealLabel } from "@/components/dashboard/TodayMealsList";
import { mealTypeLabel } from "@/lib/schemas/enums";
import { renderWithQuery } from "../helpers/query";
import { jsonResponse, stubFetch } from "../helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const times = (date: string, imsak: string, iftar: string) => ({ date, imsak, iftar, fastMinutes: 749 });
const noTimer = { targetHours: null, active: null, recent: [] };

describe("F76 + F14: oruç", () => {
  it("süre biçimi", () => {
    expect(formatDuration(126)).toBe("2 sa 6 dk");
    expect(formatDuration(45)).toBe("45 dk");
    expect(formatDuration(120)).toBe("2 sa");
  });

  it("Ramazan modunda il, vakitler, iftara kalan süre ve su önerisi görünür", async () => {
    restore = stubFetch([
      ["/api/fasting", () =>
        jsonResponse({
          ramadan: {
            province: "Ankara",
            today: times("2026-02-19", "06:06", "18:35"),
            tomorrow: times("2026-02-20", "06:05", "18:36"),
            phase: "fasting",
            minutesLeft: 360,
            progressPercent: 52,
            waterAdvice: "İftar ile sahur arasında 2.500 ml hedefle.",
          },
          timer: noTimer,
        })],
    ]).restore;
    renderWithQuery(<FastingCard />);
    expect(await screen.findByText("Ramazan · Ankara")).toBeTruthy();
    expect(screen.getByText(/İmsak 06:06 · İftar 18:35/)).toBeTruthy();
    expect(screen.getByText("İftara 6 sa")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("52");
    expect(screen.getByText(/2.500 ml hedefle/)).toBeTruthy();
  });

  it("B26: Ramazan dışında iftar sayacı yerine Ramazan'a kalan gün görünür", async () => {
    restore = stubFetch([
      ["/api/fasting", () =>
        jsonResponse({
          ramadan: {
            province: "İstanbul",
            today: times("2026-10-30", "05:51", "18:09"),
            tomorrow: times("2026-10-31", "05:52", "18:08"),
            phase: "fasting",
            minutesLeft: 120,
            progressPercent: 80,
            waterAdvice: "x",
            period: { inRamadan: false, day: null, start: "2027-02-08", end: "2027-03-09", daysUntil: 101 },
          },
          timer: noTimer,
        })],
    ]).restore;
    renderWithQuery(<FastingCard />);
    expect(await screen.findByText("Ramazan'a 101 gün")).toBeTruthy();
    expect(screen.getByText(/Başlangıç 08\.02\.2027/)).toBeTruthy();
    expect(screen.queryByText(/İftara/)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("B26: sahur ve iftar hatırlatması tek tıkla kurulur", async () => {
    const posts: unknown[] = [];
    let reminders: Array<{ id: string; kind: string }> = [];
    restore = stubFetch([
      ["/api/reminders", (_u, init) => {
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body));
          posts.push(body);
          reminders = [...reminders, { id: `r${reminders.length}`, kind: body.kind }];
          return jsonResponse({}, 201);
        }
        return jsonResponse({ reminders });
      }],
      ["/api/fasting", () =>
        jsonResponse({
          ramadan: {
            province: "Ankara",
            today: times("2026-02-19", "06:06", "18:35"),
            tomorrow: times("2026-02-20", "06:05", "18:36"),
            phase: "fasting",
            minutesLeft: 360,
            progressPercent: 52,
            waterAdvice: "su",
            period: { inRamadan: true, day: 1, start: "2026-02-19", end: "2026-03-19", daysUntil: 0 },
          },
          timer: noTimer,
        })],
    ]).restore;
    renderWithQuery(<FastingCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Sahur ve iftar hatırlatması kur" }));
    expect(await screen.findByText(/Sahur ve iftar hatırlatmaları açık/)).toBeTruthy();
    expect(posts).toEqual([{ kind: "sahur", offsetMinutes: 45 }, { kind: "iftar", offsetMinutes: 15 }]);
  });

  it("Ramazan kapalı ve hedef yoksa kart görünmez", async () => {
    let served = false;
    restore = stubFetch([["/api/fasting", () => ((served = true), jsonResponse({ ramadan: null, timer: noTimer }))]]).restore;
    const { container } = renderWithQuery(<FastingCard />);
    await waitFor(() => expect(served).toBe(true));
    expect(container.textContent).toBe("");
  });

  it("aralıklı oruç başlatılır; sürerken geçen süre ve bitirme düğmesi görünür", async () => {
    const posts: string[] = [];
    let active = false;
    restore = stubFetch([
      ["/api/fasting/start", () => ((active = true), posts.push("start"), jsonResponse({ id: "f1" }, 201))],
      ["/api/fasting/stop", () => ((active = false), posts.push("stop"), jsonResponse({ id: "f1" }))],
      ["/api/fasting", () =>
        jsonResponse({
          ramadan: null,
          timer: {
            targetHours: 16,
            active: active ? { id: "f1", startedAt: "2026-10-29T20:00:00.000Z", targetHours: 16, elapsedMinutes: 605, progressPercent: 63 } : null,
            recent: [{ id: "f0", startedAt: "", endedAt: "", targetHours: 16, durationMinutes: 990, reachedTarget: true }],
          },
        })],
    ]).restore;
    renderWithQuery(<FastingCard />);
    expect(await screen.findByText(/Son 1 oruç: 1 kez hedef tuttu/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Orucu başlat (16 sa)" }));
    expect(await screen.findByText("10 sa 5 dk / 16 sa")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Orucu bitir" }));
    await waitFor(() => expect(posts).toEqual(["start", "stop"]));
  });

  it("ayarlar: Ramazan modu, il, düzeltme ve oruç hedefi kaydedilir", async () => {
    const puts: unknown[] = [];
    restore = stubFetch([
      ["/api/fasting/settings", (_u, init) => (puts.push(JSON.parse(String(init?.body))), jsonResponse({ ok: true }))],
      ["/api/profile", () => jsonResponse({ id: "default-user", ramadanMode: false, ramadanProvince: "İstanbul", ramadanImsakAdjust: 0, ramadanIftarAdjust: 0, fastingTargetHours: null })],
    ]).restore;
    renderWithQuery(<FastingSection />);
    fireEvent.click(await screen.findByLabelText("Ramazan modu"));
    fireEvent.change(screen.getByLabelText("İl"), { target: { value: "Konya" } });
    fireEvent.change(screen.getByLabelText("İftar düzeltmesi (dk)"), { target: { value: "2" } });
    fireEvent.click(screen.getByLabelText("Aralıklı oruç zamanlayıcısı"));
    fireEvent.change(screen.getByLabelText("Hedef süre"), { target: { value: "18" } });
    fireEvent.click(screen.getByRole("button", { name: "Oruç ayarlarını kaydet" }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ ramadanMode: true, ramadanProvince: "Konya", ramadanImsakAdjust: 0, ramadanIftarAdjust: 2, fastingTargetHours: 18 });
  });

  it("Ramazan modunda kahvaltı Sahur, akşam yemeği İftar olarak adlandırılır", () => {
    expect(mealTypeLabel("breakfast", true)).toBe("Sahur");
    expect(mealTypeLabel("dinner", true)).toBe("İftar");
    expect(mealTypeLabel("lunch", true)).toBe("Öğle Yemeği");
    expect(mealTypeLabel("breakfast")).toBe("Kahvaltı");
    expect(dashboardMealLabel("dinner", true)).toBe("İftar");
    expect(dashboardMealLabel("dinner")).toBe("Akşam Yemeği");
  });
});

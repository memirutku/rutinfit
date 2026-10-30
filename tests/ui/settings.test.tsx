import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "@/app/settings/page";
import { queryKeys } from "@/lib/client/queries/keys";
import type { Profile } from "@/lib/schemas/profile";
import type { Diagnostics } from "@/lib/schemas/system";
import { jsonResponse, stubFetch } from "../helpers/fetch";
import { renderWithQuery } from "../helpers/query";

const PROFILE: Profile = {
  id: "default-user",
  heightCm: 181,
  age: 25,
  sex: "male",
  currentWeightKg: 112,
  calorieTarget: 2080,
  calorieCeiling: 2100,
  proteinTargetG: 165,
  fatTargetG: 60,
  carbTargetG: 220,
  wakeTime: "06:00",
  workdayHomeTime: "19:30",
  isOnboarded: true,
};

const DIAGNOSTICS: Diagnostics = {
  storage: { dbPath: "/data/rutinfit.db", dbSizeFormatted: "1.23 MB", backupsDir: "/data/backups", backupCount: 4 },
  counts: { foods: 42, foodLogs: 7, recipes: 3, mealPlans: 2, workoutSessions: 5, setLogs: 60, weightLogs: 9, pantryItems: 11 },
  system: { nodeVersion: "v22.1.0", platform: "darwin", arch: "arm64", memoryRssMb: 180 },
};

type Responder = Parameters<typeof stubFetch>[0][number][1];
const method = (init?: RequestInit) => (init?.method ?? "GET").toUpperCase();
const body = (init?: RequestInit) => JSON.parse(String(init?.body));

/** Sayfanın her zaman yaptığı istekler + teste özel yollar (önce eşleşen kazanır). */
function setup(routes: Array<[string | RegExp, Responder]> = []) {
  const s = stubFetch([
    ...routes,
    ["/api/profile", () => jsonResponse(PROFILE)],
    ["/api/diagnostics", () => jsonResponse(DIAGNOSTICS)],
  ]);
  const view = renderWithQuery(<SettingsPage />);
  return { ...s, ...view };
}

const callsTo = (calls: { url: string; init?: RequestInit }[], path: string, verb = "GET") =>
  calls.filter((c) => c.url.includes(path) && method(c.init) === verb);

/** jsdom'un File'ında text() yok; tarayıcıdaki gibi içeriği döndüren bir dosya oluşturulur. */
function backupFile(content: string, name: string): File {
  const file = new File([content], name, { type: "application/json" });
  return Object.assign(file, { text: () => Promise.resolve(content) });
}

function chooseBackup(content: string, name = "yedek.json") {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = backupFile(content, name);
  fireEvent.change(input, { target: { files: [file] } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Ayarlar — profil ve hedefler", () => {
  it("yüklenirken bekleme gösterir, sonra profil değerleriyle formu doldurur", async () => {
    setup();
    expect(screen.getByText("Ayarlar yükleniyor...")).toBeTruthy();
    const calories = await screen.findByLabelText<HTMLInputElement>("Kalori Hedefi (kcal)");
    expect(calories.value).toBe("2080");
    expect(screen.getByLabelText<HTMLSelectElement>("Cinsiyet").value).toBe("male");
    expect(screen.getByLabelText<HTMLInputElement>("İşten Eve Varış Saati").value).toBe("19:30");
  });

  it("kaydedince düzenlenen hedefi gönderir ve başarı mesajı gösterir", async () => {
    const { calls } = setup([
      ["/api/profile", (_u, init) => (method(init) === "PUT" ? jsonResponse({ ...PROFILE, ...body(init) }) : jsonResponse(PROFILE))],
    ]);
    fireEvent.change(await screen.findByLabelText("Kalori Hedefi (kcal)"), { target: { value: "1950" } });
    fireEvent.click(screen.getByRole("button", { name: "Hedefleri Güncelle" }));

    expect(await screen.findByText("Profil ve hedefler başarıyla güncellendi! ✓")).toBeTruthy();
    const put = callsTo(calls, "/api/profile", "PUT");
    expect(put).toHaveLength(1);
    expect(body(put[0].init)).toMatchObject({ calorieTarget: 1950, proteinTargetG: 165 });
    expect(screen.getByLabelText<HTMLInputElement>("Kalori Hedefi (kcal)").value).toBe("1950");
  });

  it("sunucu kaydı reddederse hata gösterilir, başarı mesajı gösterilmez", async () => {
    setup([
      [
        "/api/profile",
        (_u, init) =>
          method(init) === "PUT"
            ? jsonResponse({ error: "Geçersiz veri — heightCm: Expected number" }, 400)
            : jsonResponse(PROFILE),
      ],
    ]);
    await screen.findByLabelText("Boy (cm)");
    fireEvent.click(screen.getByRole("button", { name: "Hedefleri Güncelle" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Geçersiz veri — heightCm");
    expect(screen.queryByText(/başarıyla güncellendi/)).toBeNull();
  });

  it("F56: taban altı kalori hedefinde uyarı ve onay kutusu çıkar; onay ve gizleme tercihi gönderilir", async () => {
    const { calls } = setup([
      ["/api/profile", (_u, init) => (method(init) === "PUT" ? jsonResponse({ ...PROFILE, ...body(init) }) : jsonResponse(PROFILE))],
    ]);
    const calories = await screen.findByLabelText("Kalori Hedefi (kcal)");
    expect(screen.queryByRole("checkbox", { name: /doktor ya da diyetisyenle/ })).toBeNull();

    fireEvent.change(calories, { target: { value: "1400" } });
    expect(screen.getByText(/1\.500 kcal altında/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /doktor ya da diyetisyenle/ }));
    // B34: gizleme anahtarı kendi başına kaydedilir (kayıtlı hedefle); form kaydı sonra gelir.
    fireEvent.click(screen.getByRole("checkbox", { name: /Kalori ve makro sayılarını gizle/ }));
    await waitFor(() => expect(callsTo(calls, "/api/profile", "PUT")).toHaveLength(1));
    expect(body(callsTo(calls, "/api/profile", "PUT")[0].init)).toMatchObject({ calorieTarget: 2080, hideNumbers: true });
    await waitFor(() => expect(screen.getByRole("button", { name: "Hedefleri Güncelle" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Hedefleri Güncelle" }));

    await screen.findByText("Profil ve hedefler başarıyla güncellendi! ✓");
    expect(body(callsTo(calls, "/api/profile", "PUT")[1].init)).toMatchObject({
      calorieTarget: 1400,
      acknowledgeLowCalorie: true,
      hideNumbers: true,
    });
  });

  it("F09: 'Sihirbazla yeniden hesapla' kurulum sihirbazını açar", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Sihirbazla yeniden hesapla" }));
    expect(await screen.findByRole("dialog", { name: /Hedeflerini birlikte kuralım/ })).toBeTruthy();
  });

  it("F52: koça notlar profil formundan kaydedilir", async () => {
    const { calls } = setup([
      ["/api/profile", (_u, init) => (method(init) === "PUT" ? jsonResponse({ ...PROFILE, ...body(init) }) : jsonResponse(PROFILE))],
    ]);
    fireEvent.change(await screen.findByLabelText(/Koça notlar/), { target: { value: "Glutensiz besleniyorum." } });
    fireEvent.click(screen.getByRole("button", { name: "Hedefleri Güncelle" }));
    await screen.findByText("Profil ve hedefler başarıyla güncellendi! ✓");
    expect(body(callsTo(calls, "/api/profile", "PUT")[0].init)).toMatchObject({ coachNotes: "Glutensiz besleniyorum." });
  });

  it("F31: hane büyüklüğü profil formundan kaydedilir", async () => {
    const { calls } = setup([
      ["/api/profile", (_u, init) => (method(init) === "PUT" ? jsonResponse({ ...PROFILE, ...body(init) }) : jsonResponse(PROFILE))],
    ]);
    fireEvent.change(await screen.findByLabelText("Hane büyüklüğü (kişi)"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Hedefleri Güncelle" }));
    await screen.findByText("Profil ve hedefler başarıyla güncellendi! ✓");
    expect(body(callsTo(calls, "/api/profile", "PUT")[0].init)).toMatchObject({ householdSize: 3 });
  });

  it("F13: günlük su hedefi profil formundan kaydedilir", async () => {
    const { calls } = setup([
      ["/api/profile", (_u, init) => (method(init) === "PUT" ? jsonResponse({ ...PROFILE, ...body(init) }) : jsonResponse(PROFILE))],
    ]);
    fireEvent.change(await screen.findByLabelText("Günlük su hedefi (ml)"), { target: { value: "3000" } });
    fireEvent.click(screen.getByRole("button", { name: "Hedefleri Güncelle" }));
    await screen.findByText("Profil ve hedefler başarıyla güncellendi! ✓");
    expect(body(callsTo(calls, "/api/profile", "PUT")[0].init)).toMatchObject({ waterTargetMl: 3000 });
  });

  it("yerel düzenleme korunur; profil verisi değişince (ör. geri yükleme) form yeniden kurulur", async () => {
    const { client } = setup();
    const protein = await screen.findByLabelText<HTMLInputElement>("Protein Hedefi (g)");
    fireEvent.change(protein, { target: { value: "170" } });
    expect(protein.value).toBe("170");

    act(() => client.setQueryData(queryKeys.profile, { ...PROFILE, proteinTargetG: 180, calorieTarget: 1800 }));
    await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>("Protein Hedefi (g)").value).toBe("180"));
    expect(screen.getByLabelText<HTMLInputElement>("Kalori Hedefi (kcal)").value).toBe("1800");
  });
});

describe("Ayarlar — F58 koç kontrolleri", () => {
  it("kayıtlı sağlayıcıyı gösterir; koçu kapatma ve ton seçimi kaydedilir", async () => {
    const saved = { providerType: "lmstudio", baseUrl: "http://127.0.0.1:1234/v1", modelName: "qwen", coachEnabled: true, tone: "supportive", endpointKind: "local" };
    const { calls } = setup([
      ["/api/ai/settings", (_u, init) => jsonResponse(method(init) === "PUT" ? { ...saved, ...body(init) } : saved)],
    ]);
    await waitFor(() => expect(screen.getByLabelText<HTMLSelectElement>("Sağlayıcı").value).toBe("lmstudio"));
    expect(screen.getByLabelText<HTMLInputElement>("Model Adı").value).toBe("qwen");

    fireEvent.click(screen.getByRole("checkbox", { name: /AI koçu açık/ }));
    await waitFor(() => expect(callsTo(calls, "/api/ai/settings", "PUT")).toHaveLength(1));
    expect(body(callsTo(calls, "/api/ai/settings", "PUT")[0].init)).toEqual({ coachEnabled: false });

    fireEvent.change(screen.getByLabelText("Koçun üslubu"), { target: { value: "direct" } });
    await waitFor(() => expect(callsTo(calls, "/api/ai/settings", "PUT")).toHaveLength(2));
    expect(body(callsTo(calls, "/api/ai/settings", "PUT")[1].init)).toEqual({ tone: "direct" });
  });
});

describe("Ayarlar — F67 şeffaflık", () => {
  const local = { providerType: "ollama", baseUrl: "http://127.0.0.1:11434/v1", modelName: "llama3.2", coachEnabled: true, tone: "supportive", endpointKind: "local" };

  it("yerel uç noktayı gösterir; OpenAI seçilince ne gideceğini açıkça uyarır", async () => {
    setup([
      ["/api/ai/settings", () => jsonResponse(local)],
      ["/api/ai/exposure", () => jsonResponse({ applicable: true, exposed: false, port: 11434, lanAddresses: ["192.168.1.20"] })],
    ]);
    expect(await screen.findByText(/Bu bilgisayarda · 127\.0\.0\.1:11434/)).toBeTruthy();
    expect(screen.queryByText(/OpenAI sunucularına gönderilir/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Sağlayıcı"), { target: { value: "openai" } });
    expect(screen.getByText(/OpenAI sunucularına gönderilir/)).toBeTruthy();
  });

  it("bulut uç noktası rozetle işaretlenir", async () => {
    setup([
      ["/api/ai/settings", () => jsonResponse({ ...local, providerType: "openai", baseUrl: "https://api.openai.com/v1", endpointKind: "cloud" })],
      ["/api/ai/exposure", () => jsonResponse({ applicable: false, exposed: false, port: null, lanAddresses: [] })],
    ]);
    expect(await screen.findByText(/Bulut · api\.openai\.com/)).toBeTruthy();
  });

  it("'cihazdan ne çıkar' tablosu, sürüm ve doğrulama komutu; model sunucusu ağa açıksa uyarı", async () => {
    setup([
      ["/api/ai/settings", () => jsonResponse(local)],
      ["/api/ai/exposure", () => jsonResponse({ applicable: true, exposed: true, port: 11434, lanAddresses: ["192.168.1.20"], exposedAt: "192.168.1.20:11434" })],
      ["/api/diagnostics", () => jsonResponse({ ...DIAGNOSTICS, system: { ...DIAGNOSTICS.system, appVersion: "0.1.0" } })],
    ]);
    expect(await screen.findByRole("heading", { name: /Hesap yok, bulut yok/ })).toBeTruthy();
    expect(screen.getByText("world.openfoodfacts.org")).toBeTruthy();
    expect(await screen.findByText(/192\.168\.1\.20:11434/)).toBeTruthy();
    expect(screen.getByText(/OLLAMA_HOST=127\.0\.0\.1/)).toBeTruthy();
    expect(await screen.findByText(/Sürüm 0\.1\.0/)).toBeTruthy();
    expect(screen.getByText(/shasum -a 256/)).toBeTruthy();
  });
});

describe("Ayarlar — yapay zekâ ve openGym bağlantı testi", () => {
  it("AI testi başarılıysa mesajı ve algılanan modelleri gösterir", async () => {
    const { calls } = setup([
      ["/api/ai/test-connection", () => jsonResponse({ success: true, message: "Bağlantı kuruldu.", models: ["llama3.2", "mistral"] })],
    ]);
    fireEvent.change(await screen.findByLabelText("Sağlayıcı"), { target: { value: "lmstudio" } });
    expect(screen.getByLabelText<HTMLInputElement>("Base URL").value).toBe("http://127.0.0.1:1234/v1");
    fireEvent.click(screen.getAllByRole("button", { name: "Bağlantıyı Test Et" })[0]);

    expect(await screen.findByText("Bağlantı kuruldu.")).toBeTruthy();
    expect(screen.getByText(/llama3.2, mistral/)).toBeTruthy();
    expect(body(callsTo(calls, "/api/ai/test-connection", "POST")[0].init)).toEqual({
      providerType: "lmstudio",
      baseUrl: "http://127.0.0.1:1234/v1",
      modelName: "llama3.2",
    });
  });

  it("sunucu adresi reddederse onun mesajı, ağ hatasında sabit metin gösterilir", async () => {
    let fail: "server" | "network" = "server";
    setup([
      [
        "/api/ai/test-connection",
        () => {
          if (fail === "network") throw new TypeError("fetch failed");
          return jsonResponse({ success: false, error: "Adres güvenli değil.", message: "Adres güvenli değil." }, 400);
        },
      ],
    ]);
    const testButton = (await screen.findAllByRole("button", { name: "Bağlantıyı Test Et" }))[0];
    fireEvent.click(testButton);
    expect(await screen.findByText("Adres güvenli değil.")).toBeTruthy();

    fail = "network";
    fireEvent.click(testButton);
    expect(await screen.findByText("Test sırasında bir bağlantı hatası oluştu.")).toBeTruthy();
  });

  it("openGym kapalıysa (500 + isOnline:false) bağlantı hatası, açıksa sürüm gösterilir", async () => {
    let online = false;
    setup([
      [
        "/api/opengym/status",
        () =>
          online
            ? jsonResponse({ isOnline: true, url: "http://localhost:8080", version: "2.0.0" })
            : jsonResponse({ isOnline: false, error: "ECONNREFUSED" }, 500),
      ],
    ]);
    const testButton = (await screen.findAllByRole("button", { name: "Bağlantıyı Test Et" }))[1];
    fireEvent.click(testButton);
    expect(await screen.findByText("Bağlantı Hatası: ECONNREFUSED")).toBeTruthy();

    online = true;
    fireEvent.click(testButton);
    expect(await screen.findByText("Bağlantı Başarılı! openGym v2.0.0 aktif olarak çalışıyor.")).toBeTruthy();
  });
});

describe("Ayarlar — yedekleme", () => {
  it("onaylanan yedek geri yüklenir, tablo sayıları gösterilir ve profil/tanılama tazelenir", async () => {
    const { calls } = setup([
      ["/api/backup/import", () => jsonResponse({ success: true, message: "ok", counts: { foodItem: 3, foodLog: 12 } })],
    ]);
    await screen.findByLabelText("Boy (cm)");
    chooseBackup('{"version":"2.0","data":{}}', "rutinfit.json");

    const dialog = await screen.findByRole("dialog", { name: "Yedeği geri yükle" });
    expect(dialog.textContent).toContain("rutinfit.json");
    fireEvent.click(screen.getByRole("button", { name: "Geri Yükle" }));

    const status = await screen.findByText("Yedek başarıyla geri yüklendi!");
    expect(status.closest('[role="status"]')).toBeTruthy();
    expect(screen.getByText(/foodLog:/).textContent).toContain("12");
    expect(body(callsTo(calls, "/api/backup/import", "POST")[0].init)).toEqual({ version: "2.0", data: {} });
    await waitFor(() => {
      expect(callsTo(calls, "/api/profile").length).toBeGreaterThanOrEqual(2);
      expect(callsTo(calls, "/api/diagnostics").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("Vazgeç seçilirse hiçbir şey gönderilmez", async () => {
    const { calls } = setup();
    await screen.findByLabelText("Boy (cm)");
    chooseBackup("{}");
    fireEvent.click(await screen.findByRole("button", { name: "Vazgeç" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(callsTo(calls, "/api/backup/import", "POST")).toHaveLength(0);
  });

  it("bozuk JSON ve sunucunun reddettiği yedek hata olarak gösterilir", async () => {
    setup([["/api/backup/import", () => jsonResponse({ error: "Yedek dosyası geçersiz: foodLog.0.caloriesSnapshot" }, 400)]]);
    await screen.findByLabelText("Boy (cm)");

    chooseBackup("{bozuk");
    fireEvent.click(await screen.findByRole("button", { name: "Geri Yükle" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Geçersiz JSON dosyası:");

    chooseBackup('{"version":"2.0","data":{}}');
    fireEvent.click(await screen.findByRole("button", { name: "Geri Yükle" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Hata: Yedek dosyası geçersiz: foodLog.0.caloriesSnapshot")
    );
  });

  it("F61: otomatik yedek klasörü, sıklık ve saklama sayısı kaydedilir; 'Şimdi yedekle' sonucu gösterilir", async () => {
    const state = { enabled: false, folderPath: null as string | null, frequency: "daily", keepCount: 10, lastRunAt: null, lastStatus: null, lastMessage: null, lastFile: null, suggestedFolder: "/Users/ben/Documents/RutinFit Yedekleri" };
    const { calls } = setup([
      [
        "/api/backup/auto",
        (_u, init) => {
          if (method(init) === "PUT") Object.assign(state, body(init));
          if (method(init) === "POST") return jsonResponse({ ok: true, message: "Yedek alındı.", file: "/Users/ben/iCloud/rutinfit-otomatik-yedek-1.json" });
          return jsonResponse(state);
        },
      ],
    ]);
    const folder = (await screen.findByLabelText("Yedek klasörü")) as HTMLInputElement;
    expect(folder.value).toBe("");
    expect(screen.getByText(/Önerilen: \/Users\/ben\/Documents\/RutinFit Yedekleri/)).toBeTruthy();
    // Elle yazılan klasör alandan çıkınca kaydedilir (B34: ayrı Kaydet düğmesi yok).
    fireEvent.change(folder, { target: { value: "/Users/ben/iCloud" } });
    fireEvent.blur(folder);
    await waitFor(() => expect(callsTo(calls, "/api/backup/auto", "PUT")).toHaveLength(1));
    expect(body(callsTo(calls, "/api/backup/auto", "PUT")[0].init)).toEqual({ folderPath: "/Users/ben/iCloud" });
    fireEvent.click(screen.getByRole("checkbox", { name: /Otomatik yedek açık/ }));
    await waitFor(() => expect(callsTo(calls, "/api/backup/auto", "PUT")).toHaveLength(2));
    expect(body(callsTo(calls, "/api/backup/auto", "PUT")[1].init)).toEqual({ enabled: true, folderPath: "/Users/ben/iCloud" });

    await waitFor(() => expect(screen.getByRole("button", { name: "Şimdi yedekle" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Şimdi yedekle" }));
    expect(await screen.findByText(/Yedek alındı\. .*rutinfit-otomatik-yedek-1\.json/)).toBeTruthy();
  });

  it("F60: CSV düğmesi doğru türü ister, dosyayı indirir ve kopyanın yolunu bildirir", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:csv"), revokeObjectURL: vi.fn() }));
    const { calls } = setup([
      [
        "/api/export/csv",
        () =>
          new Response("date,time\n", {
            headers: {
              "Content-Type": "text/csv",
              "Content-Disposition": 'attachment; filename="rutinfit-antrenmanlar-2026-10-30.csv"',
              "X-RutinFit-Export-Path": encodeURIComponent("/data/exports/rutinfit-antrenmanlar-2026-10-30.csv"),
            },
          }),
      ],
    ]);
    fireEvent.click(await screen.findByRole("button", { name: "Antrenmanlar (CSV, Strong biçimi)" }));
    expect(await screen.findByText(/CSV indirildi: rutinfit-antrenmanlar-2026-10-30\.csv/)).toBeTruthy();
    expect(screen.getByText(/\/data\/exports\//)).toBeTruthy();
    expect(calls.some((c) => c.url.includes("/api/export/csv?type=workouts"))).toBe(true);
    expect(click).toHaveBeenCalled();
  });

  it("dışa aktarma dosyayı indirir ve kaydedilen kopyanın yolunu bildirir; hata durumunda uyarı verir", async () => {
    let failExport = false;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:yedek"), revokeObjectURL: vi.fn() }));
    setup([
      [
        "/api/backup/export",
        () =>
          failExport
            ? jsonResponse({ error: "Disk dolu" }, 500)
            : new Response("{}", {
                headers: {
                  "Content-Disposition": 'attachment; filename="rutinfit-2026-10-20.json"',
                  "X-RutinFit-Backup-Path": encodeURIComponent("/data/backups/rutinfit-2026-10-20.json"),
                },
              }),
      ],
    ]);
    const exportButton = await screen.findByRole("button", { name: /Tüm Verileri JSON Olarak İndir/ });
    fireEvent.click(exportButton);
    const status = await screen.findByRole("status");
    expect(status.textContent).toBe(
      "Yedek indirildi: rutinfit-2026-10-20.json. Bir kopyası uygulama klasörüne de kaydedildi: /data/backups/rutinfit-2026-10-20.json"
    );
    expect(click).toHaveBeenCalledTimes(1);

    failExport = true;
    fireEvent.click(exportButton);
    expect((await screen.findByRole("alert")).textContent).toBe("Hata: Disk dolu");
  });
});

describe("Ayarlar — B34 içindekiler, Gelişmiş ve anında kaydeden anahtarlar", () => {
  const profileRoute = (puts: unknown[], fail = false): [string, Responder] => [
    "/api/profile",
    (_u, init) => {
      if (method(init) !== "PUT") return jsonResponse(PROFILE);
      puts.push(body(init));
      return fail ? jsonResponse({ error: "Disk dolu" }, 500) : jsonResponse({ ...PROFILE, ...body(init) });
    },
  ];

  afterEach(() => {
    window.location.hash = "";
  });

  it("içindekiler her bölüme bağlanır; teknik bölümler kapalı 'Gelişmiş' altında durur ve bağlantıyla açılır", async () => {
    setup();
    const nav = await screen.findByRole("navigation", { name: "Ayarlar bölümleri" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Profil", "Takviyeler", "Hatırlatmalar", "Oruç", "AI koçu", "Yedek", "Gelişmiş"]);
    for (const link of links) expect(document.getElementById(link.getAttribute("href")!.slice(1))).toBeTruthy();

    const advanced = document.getElementById("gelismis") as HTMLDetailsElement;
    expect(advanced.tagName).toBe("DETAILS");
    expect(advanced.open).toBe(false);
    for (const id of ["seffaflik", "yedek-ayrintilari", "opengym", "tanilama"]) expect(advanced.querySelector(`#${id}`)).toBeTruthy();
    // Kişisel bölümler Gelişmiş'in dışında kalır.
    for (const id of ["profil", "takviyeler", "hatirlatmalar", "yedek"]) expect(advanced.contains(document.getElementById(id))).toBe(false);

    fireEvent.click(within(nav).getByRole("link", { name: "Gelişmiş" }));
    expect(advanced.open).toBe(true);
  });

  it("adres bir gelişmiş bölümü gösteriyorsa (#tanilama) Gelişmiş açık gelir", async () => {
    window.location.hash = "#tanilama";
    setup();
    await screen.findByRole("navigation", { name: "Ayarlar bölümleri" });
    expect((document.getElementById("gelismis") as HTMLDetailsElement).open).toBe(true);
  });

  it("döngü notu anahtarı dokununca kaydeder; formdaki kaydedilmemiş düzenleme gönderilmez ve korunur", async () => {
    const puts: Array<Record<string, unknown>> = [];
    setup([profileRoute(puts)]);
    const calories = await screen.findByLabelText<HTMLInputElement>("Kalori Hedefi (kcal)");
    fireEvent.change(calories, { target: { value: "1950" } });

    fireEvent.click(screen.getByRole("checkbox", { name: /Adet döngüsü notu/ }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toMatchObject({ cycleTracking: true, calorieTarget: 2080 });
    const saved = await screen.findByText("Kaydedildi ✓");
    expect(saved.closest("label")?.textContent).toContain("Adet döngüsü notu");
    expect(screen.getByRole("checkbox", { name: /Adet döngüsü notu/ })).toHaveProperty("checked", true);
    expect(calories.value).toBe("1950");
  });

  it("sayıları gizle anahtarı kaydedilemezse eski hâline döner ve hata yanında görünür", async () => {
    const puts: Array<Record<string, unknown>> = [];
    setup([profileRoute(puts, true)]);
    const toggle = await screen.findByRole("checkbox", { name: /Kalori ve makro sayılarını gizle/ });
    fireEvent.click(toggle);
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toMatchObject({ hideNumbers: true });
    expect((await screen.findByRole("alert")).textContent).toContain("Disk dolu");
    expect(toggle).toHaveProperty("checked", false);
  });

  it("otomatik yedek anahtarı ve sıklık dokununca kaydeder (klasör seçilmemişse önerilen klasörle); ayrı 'Kaydet' düğmesi yok", async () => {
    const state = { enabled: false, folderPath: null as string | null, frequency: "daily", keepCount: 10, lastRunAt: null, lastStatus: null, lastMessage: null, lastFile: null, suggestedFolder: "/Users/ben/Documents/RutinFit Yedekleri", exportCopies: true };
    const { calls } = setup([
      [
        "/api/backup/auto",
        (_u, init) => {
          if (method(init) === "PUT") Object.assign(state, body(init));
          return jsonResponse(state);
        },
      ],
    ]);
    fireEvent.click(await screen.findByRole("checkbox", { name: /Otomatik yedek açık/ }));
    await waitFor(() => expect(callsTo(calls, "/api/backup/auto", "PUT")).toHaveLength(1));
    expect(body(callsTo(calls, "/api/backup/auto", "PUT")[0].init)).toEqual({ enabled: true, folderPath: "/Users/ben/Documents/RutinFit Yedekleri" });

    fireEvent.change(screen.getByLabelText("Sıklık"), { target: { value: "weekly" } });
    await waitFor(() => expect(callsTo(calls, "/api/backup/auto", "PUT")).toHaveLength(2));
    expect(body(callsTo(calls, "/api/backup/auto", "PUT")[1].init)).toEqual({ frequency: "weekly" });
    expect(screen.queryByRole("button", { name: "Otomatik yedeği kaydet" })).toBeNull();

    // Saklama sayısı teknik ayrıntıdır: Gelişmiş › Yedek ayrıntıları altında, alandan çıkınca kaydedilir.
    const keep = screen.getByLabelText("Saklanacak otomatik yedek sayısı");
    expect(document.getElementById("gelismis")!.contains(keep)).toBe(true);
    fireEvent.change(keep, { target: { value: "5" } });
    fireEvent.blur(keep);
    await waitFor(() => expect(callsTo(calls, "/api/backup/auto", "PUT")).toHaveLength(3));
    expect(body(callsTo(calls, "/api/backup/auto", "PUT")[2].init)).toEqual({ keepCount: 5 });
  });
});

describe("Ayarlar — sistem tanılama", () => {
  it("depolama, ortam ve kayıt sayılarını gösterir; Yenile yeniden çeker", async () => {
    const { calls } = setup();
    expect(await screen.findByText("rutinfit.db")).toBeTruthy();
    expect(screen.getByText("Boyut: 1.23 MB")).toBeTruthy();
    expect(screen.getByText("Node v22.1.0 (darwin-arm64)")).toBeTruthy();
    expect(screen.getByText("Besinler:").nextElementSibling?.textContent).toBe("42");
    expect(screen.getByText("Kiler Ürünleri:").nextElementSibling?.textContent).toBe("11");
    await waitFor(() => expect(screen.getByRole("button", { name: "Yenile" }).hasAttribute("disabled")).toBe(false));

    const before = callsTo(calls, "/api/diagnostics").length;
    fireEvent.click(screen.getByRole("button", { name: "Yenile" }));
    await waitFor(() => expect(callsTo(calls, "/api/diagnostics")).toHaveLength(before + 1));
  });
});

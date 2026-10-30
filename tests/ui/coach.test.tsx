import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CoachPage from "@/app/coach/page";
import { ActionProposalCard } from "@/components/coach/ActionProposalCard";
import { AttachmentBar, UploadStatus } from "@/components/coach/AttachmentBar";
import { ChatComposer } from "@/components/coach/ChatComposer";
import { QuickPrompts, quickPrompts } from "@/components/coach/QuickPrompts";
import { parseProposal, parseStoredProposal, welcomeMessage, type AttachedFile, type CardProposal } from "@/components/coach/types";
import { jsonResponse, stubFetch, type StubbedCall } from "../helpers/fetch";
import { renderWithQuery } from "../helpers/query";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const mealProposal = {
  type: "meal_proposal",
  title: "Tavuklu Tabak",
  rationale: "Protein açığını kapatır",
  ingredients: [
    { foodName: "Tavuk Göğsü", grams: 150 },
    { foodName: "Pirinç", grams: 80 },
  ],
  estimatedMacros: { calories: 999, proteinG: 99, carbsG: 9, fatG: 9 },
  deterministicMacros: { totalCalories: 420, totalProteinG: 48, totalCarbsG: 30, totalFatG: 6, missingIngredients: [] },
  draftId: "d1",
  approvalToken: "tok",
};

const body = (call: StubbedCall) => JSON.parse(String(call.init?.body ?? "{}"));
const isAction = (call: StubbedCall, action: string) => call.url.includes("/api/ai/actions") && body(call).action === action;

interface ChatStubOptions {
  conversations?: Array<{ id: string; title: string }>;
  detail?: unknown;
  reply?: () => Response | Promise<Response>;
  actions?: (payload: { action: string }) => Response | Promise<Response>;
  upload?: () => Response | Promise<Response>;
  settings?: { coachEnabled: boolean; tone: string };
  profile?: Record<string, unknown>;
  status?: Record<string, unknown> | (() => Record<string, unknown>);
  suggestions?: Record<string, unknown>;
}

const SUGGESTIONS = {
  remaining: { calories: 700, proteinG: 60, carbsG: 80, fatG: 25 },
  suggestions: [
    { id: "s1", source: "saved_meal", name: "Tavuk ve pilav", calories: 450, proteinG: 49, carbsG: 44, fatG: 7, kcalShare: 0.643, proteinShare: 0.817, score: 0.7 },
    { id: "r1", source: "recipe", name: "Mercimek çorbası", calories: 340, proteinG: 24, carbsG: 50, fatG: 1.5, kcalShare: 0.486, proteinShare: 0.4, score: 0.4 },
  ],
};

const READY = { status: "ready", providerType: "ollama", baseUrl: "http://127.0.0.1:11434/v1", modelName: "llama3.2", models: ["llama3.2:latest"], message: "Model hazır: llama3.2" };
const UNREACHABLE = { ...READY, status: "unreachable", models: [], message: "Yerel model bulunamadı: http://127.0.0.1:11434/v1 adresinde çalışan bir sunucu yok." };

const PROFILE = { id: "default-user", calorieTarget: 1850, calorieCeiling: 1950, proteinTargetG: 140, fatTargetG: 60, carbTargetG: 200, isOnboarded: true, hideNumbers: false };

function stubCoach(opts: ChatStubOptions = {}) {
  const s = stubFetch([
    [
      "/api/ai/chat",
      (url, init) => {
        if (init?.method === "POST") return opts.reply ? opts.reply() : jsonResponse({ reply: "Merhaba", conversationId: "c-new" });
        if (url.includes("conversationId=")) return jsonResponse(opts.detail);
        return jsonResponse({ conversations: opts.conversations ?? [] });
      },
    ],
    ["/api/ai/actions", (_u, init) => (opts.actions ? opts.actions(JSON.parse(String(init?.body))) : jsonResponse({ success: true }))],
    ["/api/files/upload", () => (opts.upload ? opts.upload() : jsonResponse({ error: "yok" }, 500))],
    ["/api/profile", () => jsonResponse(opts.profile ?? PROFILE)],
    ["/api/ai/meal-suggestions", () => jsonResponse(opts.suggestions ?? SUGGESTIONS)],
    ["/api/ai/status", () => jsonResponse(typeof opts.status === "function" ? opts.status() : (opts.status ?? READY))],
    ["/api/ai/settings", () => jsonResponse({ providerType: "ollama", baseUrl: "http://127.0.0.1:11434/v1", modelName: "m", endpointKind: "local", ...(opts.settings ?? { coachEnabled: true, tone: "supportive" }) })],
  ]);
  restore = s.restore;
  return s;
}

async function ask(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByPlaceholderText(/Sorunuzu yazın/), text);
  await user.click(screen.getByRole("button", { name: /Gönder/ }));
}

describe("ActionProposalCard", () => {
  const card = (proposal: CardProposal, over: Partial<Parameters<typeof ActionProposalCard>[0]> = {}) =>
    render(
      <ActionProposalCard
        proposal={proposal}
        isApplied={false}
        isEditing={false}
        isBusy={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onToggleEdit={vi.fn()}
        onEditTitle={vi.fn()}
        {...over}
      />
    );

  it("modelin tahminini değil katalogdan hesaplanan makroları gösterir", () => {
    card(parseProposal(mealProposal)!);
    expect(screen.getByText("420 kcal")).toBeTruthy();
    expect(screen.queryByText("999 kcal")).toBeNull();
    expect(screen.getByText("Hesaplandı")).toBeTruthy();
    expect(screen.queryByText("(model tahmini)")).toBeNull();
    expect(screen.getByText("• Tavuk Göğsü")).toBeTruthy();
  });

  it("hesap yoksa tahmini işaretler; eksik malzemeyi not olarak gösterir", () => {
    const { unmount } = card(parseProposal({ ...mealProposal, deterministicMacros: undefined })!);
    expect(screen.getByText("999 kcal")).toBeTruthy();
    expect(screen.getByText("(model tahmini)")).toBeTruthy();
    unmount();

    card(
      parseProposal({
        ...mealProposal,
        deterministicMacros: { ...mealProposal.deterministicMacros, missingIngredients: ["Kinoa"] },
      })!
    );
    expect(screen.getByRole("note").textContent).toContain("Kinoa");
  });

  it("antrenman önerisinde süre ve egzersizler; düzenleme alanı başlığı iletir", () => {
    const onEditTitle = vi.fn();
    card(
      parseProposal({
        type: "workout_adjustment",
        title: "Hafif Seans",
        reason: "Yorgunluk",
        targetDurationMinutes: 25,
        exercises: [{ exerciseName: "Squat", sets: 2, repMin: 8, repMax: 10, restSeconds: 90 }],
      })!,
      { isEditing: true, onEditTitle }
    );
    expect(screen.getByText("Hedef Süre: 25 dakika")).toBeTruthy();
    expect(screen.getByText("2 set × 8-10 tekrar")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Başlık / İsim"), { target: { value: "Yeni Ad" } });
    expect(onEditTitle).toHaveBeenCalledWith("Yeni Ad");
    expect(screen.getByRole("button", { name: /Kapat/ })).toBeTruthy();
  });

  it("onaylanınca düğme pasifleşir, Vazgeç ve Düzenle gizlenir", () => {
    card(parseProposal(mealProposal)!, { isApplied: true });
    expect((screen.getByRole("button", { name: /Plana Eklendi/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Vazgeç" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Düzenle/ })).toBeNull();
  });
});

describe("kayıtlı önerilerin ayrıştırılması", () => {
  it("şemaya tam uymayan eski öneri kartı düşürmez", () => {
    const old = parseStoredProposal(
      JSON.stringify({ type: "meal_proposal", title: "Eski", deterministicMacros: { totalCalories: 300, totalProteinG: 20, totalCarbsG: 10, totalFatG: 5 } })
    );
    expect(old).toMatchObject({ type: "meal_proposal", title: "Eski", rationale: "" });
    expect(old?.type === "meal_proposal" && old.deterministicMacros?.missingIngredients).toEqual([]);
  });

  it("bilinmeyen tür yalnız başlıkla, bozuk JSON hiç kart üretmez", () => {
    expect(parseStoredProposal(JSON.stringify({ type: "x", title: "T", draftId: "d" }))).toEqual({
      type: "other",
      title: "T",
      draftId: "d",
      approvalToken: undefined,
    });
    expect(parseStoredProposal("{bozuk")).toBeUndefined();
    expect(parseStoredProposal(null)).toBeUndefined();
  });
});

describe("AttachmentBar ve UploadStatus", () => {
  const file: AttachedFile = {
    id: "f1",
    originalName: "plan.xlsx",
    sizeBytes: 2048,
    mimeType: "application/vnd.ms-excel",
    status: "ready",
    confidence: "low",
    sourceSummary: "Tablo",
    uncertainties: [],
  };

  it("eki güven etiketiyle gösterir ve kaldırır; boşken hiçbir şey çizmez", () => {
    const onRemove = vi.fn();
    const { container, rerender } = render(<AttachmentBar files={[file]} onRemove={onRemove} />);
    expect(screen.getByText("(2 KB)")).toBeTruthy();
    expect(screen.getByText("Düşük güven")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "plan.xlsx dosyasını kaldır" }));
    expect(onRemove).toHaveBeenCalledWith("f1");
    rerender(<AttachmentBar files={[]} onRemove={onRemove} />);
    expect(container.innerHTML).toBe("");
  });

  it("yükleme şeridi ve kapatılabilir hata şeridi", () => {
    const onDismiss = vi.fn();
    render(<UploadStatus uploading error="Dosya çok büyük" onDismissError={onDismiss} />);
    expect(screen.getByText(/ayrıştırılıyor/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hata mesajını kapat" }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe("ChatComposer ve QuickPrompts", () => {
  const composer = (over: Partial<Parameters<typeof ChatComposer>[0]> = {}) => (
    <ChatComposer
      input=""
      onInputChange={vi.fn()}
      onSubmit={vi.fn()}
      onFilesSelected={vi.fn().mockResolvedValue(undefined)}
      loading={false}
      uploading={false}
      hasAttachments={false}
      {...over}
    />
  );
  const send = () => screen.getByRole("button", { name: /Gönder/ }) as HTMLButtonElement;
  const attach = () => screen.getByTitle(/Dosya Yükle/) as HTMLButtonElement;

  it("metin veya ek yokken gönderilemez; yanıt beklerken alanlar kilitlenir", () => {
    const { rerender } = render(composer());
    expect(send().disabled).toBe(true);
    rerender(composer({ hasAttachments: true }));
    expect(send().disabled).toBe(false);
    rerender(composer({ input: "selam" }));
    expect(send().disabled).toBe(false);
    rerender(composer({ input: "selam", loading: true }));
    expect(send().disabled).toBe(true);
    expect((screen.getByPlaceholderText(/Sorunuzu yazın/) as HTMLInputElement).disabled).toBe(true);
    expect(attach().disabled).toBe(true);
    rerender(composer({ uploading: true }));
    expect(attach().disabled).toBe(true);
  });

  it("B33: gönder düğmesinin metni dar ekranda gizlense de erişilebilir adı 'Gönder'dir", () => {
    render(composer({ input: "selam" }));
    const button = send();
    expect(button.getAttribute("aria-label")).toBe("Gönder");
    expect(button.getAttribute("title")).toBe("Gönder");
  });

  it("form gönderimi ve yazma olaylarını iletir; dosya seçimi sonrası seçici sıfırlanır", async () => {
    const onSubmit = vi.fn();
    const onInputChange = vi.fn();
    const onFilesSelected = vi.fn().mockResolvedValue(undefined);
    const { container } = render(composer({ input: "x", onSubmit, onInputChange, onFilesSelected }));
    fireEvent.change(screen.getByPlaceholderText(/Sorunuzu yazın/), { target: { value: "xy" } });
    expect(onInputChange).toHaveBeenCalledWith("xy");
    fireEvent.click(send());
    expect(onSubmit).toHaveBeenCalled();

    const picker = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.setup().upload(picker, new File(["a"], "a.txt", { type: "text/plain" }));
    expect(onFilesSelected).toHaveBeenCalledWith([expect.objectContaining({ name: "a.txt" })]);
    expect(picker.value).toBe("");
  });

  it("hazır soru tıklanınca metniyle gönderilir; pasifken tıklanamaz", () => {
    const onSend = vi.fn();
    const prompts = quickPrompts(null, false);
    const { rerender } = render(<QuickPrompts prompts={prompts} disabled={false} onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: prompts[0] }));
    expect(onSend).toHaveBeenCalledWith(prompts[0]);
    rerender(<QuickPrompts prompts={prompts} disabled onSend={onSend} />);
    expect((screen.getByRole("button", { name: prompts[1] }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("B03: karşılama ve hazır sorular profildeki hedeften üretilir", () => {
  const kcalNumber = /\d[\d.]*\s*kcal/;

  it("hedef sayıları profilden, Türkçe biçimle; sabit 2.080 yok", () => {
    const text = welcomeMessage({ calorieTarget: 1850, proteinTargetG: 140 }, false);
    expect(text).toContain("1.850 kcal");
    expect(text).toContain("140 g protein");
    expect(text).not.toContain("2.080");
    expect(quickPrompts({ calorieTarget: 2460, proteinTargetG: 180 }, false).some((p) => p.includes("2.460 kcal hedefime"))).toBe(true);
  });

  it("sihirbaz atlandıysa hedefin tahmini olduğu söylenir", () => {
    expect(welcomeMessage({ calorieTarget: 2000, proteinTargetG: 100, estimated: true }, false)).toMatch(/tahmini/);
  });

  it("'sayıları gizle' açıkken ya da profil yokken metinde sayı yok", () => {
    for (const text of [welcomeMessage({ calorieTarget: 1850, proteinTargetG: 140 }, true), welcomeMessage(null, false)]) {
      expect(text).not.toMatch(/\d/);
      expect(text).toMatch(/^Merhaba! Ben RutinFit/);
    }
    for (const prompts of [quickPrompts({ calorieTarget: 1850, proteinTargetG: 140 }, true), quickPrompts(null, false)]) {
      expect(prompts.some((p) => kcalNumber.test(p))).toBe(false);
      expect(prompts.some((p) => p.includes("kalori hedefime uyan"))).toBe(true);
    }
  });

  it("koç sayfası profili okuyup karşılamayı ve hazır soruyu hedefle gösterir", async () => {
    stubCoach();
    renderWithQuery(<CoachPage />);
    expect(await screen.findByText(/^Merhaba! Ben RutinFit.*1\.850 kcal/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /1\.850 kcal hedefime uyan/ })).toBeTruthy();
    expect(screen.queryByText(/2\.080/)).toBeNull();
  });

  it("koç sayfası 'sayıları gizle' açıkken karşılamada sayı göstermez", async () => {
    stubCoach({ profile: { ...PROFILE, hideNumbers: true } });
    renderWithQuery(<CoachPage />);
    await waitFor(() => expect(screen.getByText(/^Merhaba! Ben RutinFit/).textContent).toMatch(/Hedeflerine/));
    expect(screen.getByText(/^Merhaba! Ben RutinFit/).textContent).not.toMatch(/\d/);
    expect(screen.queryByText(/\d[\d.]*\s*kcal/)).toBeNull();
  });
});

describe("Koç sayfası", () => {
  it("öneri çift tıklansa da bir kez onaylanır ve plana eklendi gösterilir", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const s = stubCoach({
      reply: () => jsonResponse({ reply: "Akşam için önerim:", conversationId: "c1", actionProposal: mealProposal, isError: false }),
      actions: async () => {
        await gate;
        return jsonResponse({ success: true });
      },
    });
    const user = userEvent.setup();
    renderWithQuery(<CoachPage />);
    await ask(user, "Akşam ne yiyeyim?");

    const approve = await screen.findByRole("button", { name: "Onayla ve Plana Ekle" });
    await user.dblClick(approve);
    await act(async () => release());

    expect(await screen.findByText("Plana Eklendi ✓")).toBeTruthy();
    expect(screen.getByText(/"Tavuklu Tabak" başarıyla onaylandı/)).toBeTruthy();
    const approvals = s.calls.filter((c) => isAction(c, "approve"));
    expect(approvals).toHaveLength(1);
    expect(body(approvals[0])).toMatchObject({ draftId: "d1", approvalToken: "tok" });
    // Yeni sohbet kimliği gelince geçmiş listesi tazelenir.
    expect(s.calls.filter((c) => c.url.endsWith("/api/ai/chat") && !c.init?.method).length).toBeGreaterThanOrEqual(2);
  });

  it("F58: modelden gelen yanıt 'AI tarafından üretildi' etiketi taşır; karşılama mesajı taşımaz", async () => {
    stubCoach({ reply: () => jsonResponse({ reply: "Bugün iyisin.", conversationId: "c1" }) });
    const user = userEvent.setup();
    renderWithQuery(<CoachPage />);
    expect(screen.queryByText(/AI tarafından üretildi/)).toBeNull();
    await ask(user, "nasılım");
    await screen.findByText("Bugün iyisin.");
    expect(screen.getAllByText(/AI tarafından üretildi · hatalı olabilir/)).toHaveLength(1);
  });

  it("F58: koç kapalıysa uyarı gösterilir ve mesaj yazılamaz", async () => {
    stubCoach({ settings: { coachEnabled: false, tone: "supportive" } });
    renderWithQuery(<CoachPage />);
    expect(await screen.findByText(/Koç kapalı/)).toBeTruthy();
    expect((screen.getByPlaceholderText(/Sorunuzu yazın/) as HTMLTextAreaElement).disabled).toBe(true);
  });

  it("F50: veri yanıtı kartta kaynak kayıtlarıyla gösterilir", async () => {
    stubCoach({
      reply: () =>
        jsonResponse({
          reply: "Bu ay 2 antrenman yaptın.",
          conversationId: "c1",
          dataAnswer: {
            type: "workouts_count",
            title: "Antrenmanlar · Bu ay",
            answer: "Bu ay 2 antrenman tamamladın.",
            rows: [{ label: "20.10.2026", value: "A · 6 set" }],
            range: { from: "2026-10-01", to: "2026-10-30", label: "Bu ay" },
          },
        }),
    });
    const user = userEvent.setup();
    renderWithQuery(<CoachPage />);
    await ask(user, "bu ay kaç antrenman yaptım");
    expect(await screen.findByText("Antrenmanlar · Bu ay")).toBeTruthy();
    expect(screen.getByText("Bu ay 2 antrenman tamamladın.")).toBeTruthy();
    expect(screen.getByText("Kaynak kayıtlar")).toBeTruthy();
    expect(screen.getByText("A · 6 set")).toBeTruthy();
    // B31: kartın sayıları modelden değil kayıtlardan.
    expect(screen.getByText("Kayıtlarından hesaplandı")).toBeTruthy();
  });

  it("F56: yanıt güvenlik notu taşıyorsa mesajın altında not olarak gösterilir", async () => {
    stubCoach({
      reply: () => jsonResponse({ reply: "Seni dinliyorum.", conversationId: "c1", safetyNotice: "Bir uzmanla konuş. Acilse 112." }),
    });
    const user = userEvent.setup();
    renderWithQuery(<CoachPage />);
    await ask(user, "kendimi kusturuyorum");
    const note = await screen.findByRole("note");
    expect(note.textContent).toContain("112");
  });

  it("öneri reddedilince iptal notu görünür", async () => {
    const s = stubCoach({
      reply: () => jsonResponse({ reply: "Öneri:", conversationId: "c1", actionProposal: mealProposal }),
    });
    const user = userEvent.setup();
    renderWithQuery(<CoachPage />);
    await ask(user, "öneri");
    await user.click(await screen.findByRole("button", { name: "Vazgeç" }));
    expect(await screen.findByText("Bu öneri taslağı kullanıcı tarafından iptal edildi.")).toBeTruthy();
    expect(body(s.calls.find((c) => isAction(c, "reject"))!)).toMatchObject({ draftId: "d1", reason: "Kullanıcı vazgeçti" });
  });

  it("sunucu hata dönerse anlaşılır hata balonu gösterilir", async () => {
    stubCoach({ reply: () => jsonResponse({ error: "İstek işlenemedi" }, 400) });
    const user = userEvent.setup();
    renderWithQuery(<CoachPage />);
    await ask(user, "selam");
    expect(await screen.findByText(/İstek gönderilirken bir hata oluştu/)).toBeTruthy();
    expect((screen.getByPlaceholderText(/Sorunuzu yazın/) as HTMLInputElement).value).toBe("");
  });

  it("geçmiş sohbet taslak durumlarıyla yüklenir; bekleyen taslak yeni anahtarla onaylanır", async () => {
    const stored = (title: string, draftId: string) =>
      JSON.stringify({ ...mealProposal, title, draftId, approvalToken: undefined });
    const s = stubCoach({
      conversations: [{ id: "c9", title: "Eski Sohbet" }],
      detail: {
        conversation: {
          id: "c9",
          title: "Eski Sohbet",
          messages: [
            { id: "m1", role: "user", content: "öneri ver", draftId: null, actionProposal: null, draft: null },
            { id: "m2", role: "assistant", content: "Uygulandı", draftId: "a", actionProposal: stored("Uygulanan", "a"), draft: { id: "a", status: "applied" } },
            { id: "m3", role: "assistant", content: "İptal", draftId: "r", actionProposal: stored("İptal Edilen", "r"), draft: { id: "r", status: "rejected" } },
            { id: "m4", role: "assistant", content: "Bekliyor", draftId: "p", actionProposal: stored("Bekleyen", "p"), draft: { id: "p", status: "pending" } },
          ],
        },
      },
      actions: (payload) => jsonResponse(payload.action === "reissue" ? { approvalToken: "yeni" } : { success: true }),
    });
    const user = userEvent.setup();
    renderWithQuery(<CoachPage />);

    const select = await screen.findByLabelText("Geçmiş sohbetler");
    await user.selectOptions(select, "c9");

    expect(await screen.findByText("Plana Eklendi ✓")).toBeTruthy();
    expect(screen.getByText("Bu öneri taslağı kullanıcı tarafından iptal edildi.")).toBeTruthy();
    expect(screen.queryByText("İptal Edilen")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Onayla ve Plana Ekle" }));
    await waitFor(() => expect(screen.getAllByText("Plana Eklendi ✓")).toHaveLength(2));
    expect(body(s.calls.find((c) => isAction(c, "reissue"))!)).toMatchObject({ draftId: "p" });
    expect(body(s.calls.find((c) => isAction(c, "approve"))!)).toMatchObject({ draftId: "p", approvalToken: "yeni" });
  });

  it("yüklenen dosya ek olarak görünür, kaldırılabilir; yükleme hatası gösterilir", async () => {
    let fail = false;
    stubCoach({
      upload: () =>
        fail
          ? jsonResponse({ error: "Desteklenmeyen dosya" }, 422)
          : jsonResponse({
              success: true,
              file: { id: "f1", originalName: "program.pdf", mimeType: "application/pdf", sizeBytes: 4096, status: "ready" },
              artifact: { confidence: "high", sourceSummary: "Program", uncertainties: [] },
            }),
    });
    const user = userEvent.setup();
    const { container } = renderWithQuery(<CoachPage />);
    const picker = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(picker, new File(["x"], "program.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("program.pdf")).toBeTruthy();
    expect(screen.getByText("Yüksek güven")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "program.pdf dosyasını kaldır" }));
    expect(screen.queryByText("program.pdf")).toBeNull();

    fail = true;
    await user.upload(picker, new File(["x"], "bozuk.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("Desteklenmeyen dosya")).toBeTruthy();
  });
});

describe("B28: model yokken koç sayfası durumu söyler ve çözüm gösterir", () => {
  it("bağlantı yoksa 'Koç kapalı' satırı, kurulum adımları ve Ayarlar'da test et bağlantısı; rozet gerçek durumu gösterir", async () => {
    stubCoach({ status: UNREACHABLE });
    renderWithQuery(<CoachPage />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Koç kapalı: yerel model bulunamadı");
    expect(alert.textContent).toMatch(/Ollama/);
    expect(alert.textContent).toMatch(/ollama pull llama3\.2/);
    expect(alert.textContent).toMatch(/LM Studio/);
    expect(screen.getByRole("link", { name: "Ayarlar'da test et" }).getAttribute("href")).toBe("/settings#yapay-zeka");
    expect(screen.getByTestId("ai-status-badge").textContent).toMatch(/Koç kapalı/);
    // Model gerektiren hazır sorular kapalı; geçmiş soruları için yazma alanı açık kalır.
    expect((screen.getAllByRole("button", { name: /protein hedefimi/ })[0] as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByPlaceholderText(/Sorunuzu yazın/) as HTMLInputElement).disabled).toBe(false);
  });

  it("model hazırsa satır çıkmaz ve rozet 'Model hazır' der", async () => {
    stubCoach();
    renderWithQuery(<CoachPage />);
    await waitFor(() => expect(screen.getByTestId("ai-status-badge").textContent).toMatch(/Model hazır · llama3\.2/));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("seçili model sunucuda yoksa hangi modellerin bulunduğunu söyler", async () => {
    stubCoach({ status: { ...READY, status: "model_missing", modelName: "mistral", models: ["llama3.2:latest", "qwen2.5"], message: "x" } });
    renderWithQuery(<CoachPage />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/"mistral" modeli bulunamadı/);
    expect(alert.textContent).toMatch(/llama3\.2:latest, qwen2\.5/);
    expect(screen.getByRole("link", { name: "Ayarlar'da test et" })).toBeTruthy();
  });

  it("hata yanıtı ham markdown olmadan düz metin gösterilir ve bağlantı durumu yeniden denetlenir", async () => {
    let calls = 0;
    const s = stubCoach({
      status: () => (++calls === 1 ? READY : UNREACHABLE),
      reply: () =>
        jsonResponse({ reply: "Ulaşılamadı. **Ollama** veya **LM Studio** açık mı?", conversationId: "c1", isError: true, errorKind: "unreachable" }),
    });
    const user = userEvent.setup();
    renderWithQuery(<CoachPage />);
    await waitFor(() => expect(screen.getByTestId("ai-status-badge").textContent).toMatch(/Model hazır/));
    await ask(user, "akşam ne yiyeyim");
    expect(await screen.findByText("Ulaşılamadı. Ollama veya LM Studio açık mı?")).toBeTruthy();
    expect(screen.queryByText(/\*\*/)).toBeNull();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(s.calls.filter((c) => c.url.includes("/api/ai/status")).length).toBeGreaterThanOrEqual(2);
  });
});

describe("B29: öneri kartı", () => {
  const card = (proposal: CardProposal, over: Partial<Parameters<typeof ActionProposalCard>[0]> = {}) =>
    render(
      <ActionProposalCard
        proposal={proposal}
        isApplied={false}
        isEditing={false}
        isBusy={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onToggleEdit={vi.fn()}
        onEditTitle={vi.fn()}
        {...over}
      />
    );
  const allMissing = {
    ...mealProposal,
    deterministicMacros: { totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0, missingIngredients: ["Tavuk Göğsü", "Pirinç"] },
  };

  it("onay bekleyen kart 'Onay Bekliyor', onaylanan kart 'Onaylandı' der", () => {
    const { unmount } = card(parseProposal(mealProposal)!);
    expect(screen.getByText("Onay Bekliyor")).toBeTruthy();
    unmount();
    card(parseProposal(mealProposal)!, { isApplied: true });
    expect(screen.getByText("Onaylandı")).toBeTruthy();
    expect(screen.queryByText("Onay Bekliyor")).toBeNull();
  });

  it("hiçbir malzeme katalogda yoksa '0 kcal · Hesaplandı' yazmaz; eksik malzeme ve seçenekler sunar", () => {
    const onApprove = vi.fn();
    card(parseProposal(allMissing)!, { onApprove });
    expect(screen.queryByText("Hesaplandı")).toBeNull();
    expect(screen.queryByText("0 kcal")).toBeNull();
    expect(screen.getByText("Eksik malzeme")).toBeTruthy();
    expect(screen.getByText("Kalori hesaplanamadı")).toBeTruthy();
    expect(screen.getByText(/model tahmini: 999 kcal/)).toBeTruthy();
    expect(screen.getByRole("note").textContent).toMatch(/Tavuk Göğsü, Pirinç/);
    expect(screen.getByRole("link", { name: "Eksikleri kataloğa ekle" }).getAttribute("href")).toBe("/foods");
    fireEvent.click(screen.getByRole("button", { name: "Yalnız adıyla plana ekle" }));
    expect(onApprove).toHaveBeenCalled();
  });

  it("bir kısmı eksikse toplamın eksikler hariç olduğu yazılır ve katalogdakilerle ekleme önerilir", () => {
    card(parseProposal({ ...mealProposal, deterministicMacros: { ...mealProposal.deterministicMacros, missingIngredients: ["Pirinç"] } })!);
    expect(screen.queryByText("Hesaplandı")).toBeNull();
    expect(screen.getByText("420 kcal")).toBeTruthy();
    expect(screen.getByText("(eksik malzemeler hariç)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Katalogdakilerle plana ekle" })).toBeTruthy();
  });

  it("geçmiş sohbetteki öneri mesajında JSON bloğu gösterilmez", async () => {
    stubCoach({
      conversations: [{ id: "c9", title: "Eski" }],
      detail: {
        conversation: {
          id: "c9",
          title: "Eski",
          messages: [
            {
              id: "m2",
              role: "assistant",
              content: "Önerim:\n```json\n" + JSON.stringify({ ...mealProposal, approvalToken: undefined }) + "\n```",
              draftId: "d1",
              actionProposal: JSON.stringify({ ...mealProposal, approvalToken: undefined }),
              draft: { id: "d1", status: "pending" },
            },
          ],
        },
      },
    });
    const user = userEvent.setup();
    renderWithQuery(<CoachPage />);
    await user.selectOptions(await screen.findByLabelText("Geçmiş sohbetler"), "c9");
    expect(await screen.findByText("Önerim:")).toBeTruthy();
    expect(screen.queryByText(/meal_proposal/)).toBeNull();
  });
});

describe("B42: model yokken yapay zekâsız öğün önerisi", () => {
  it("model yoksa kalan kalori ve makroya göre kayıtlı öğün ve tarifler sayılarla, 'yapay zekâ değil' etiketiyle gösterilir", async () => {
    stubCoach({ status: UNREACHABLE });
    renderWithQuery(<CoachPage />);
    const section = await screen.findByRole("region", { name: "Model olmadan öneri" });
    expect(section.textContent).toMatch(/Yapay zekâ değil/);
    await waitFor(() => expect(section.textContent).toMatch(/Bugün kalan: 700 kcal · P 60 g · K 80 g · Y 25 g/));
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toMatch(/Tavuk ve pilav/);
    expect(items[0].textContent).toMatch(/Kayıtlı öğün/);
    expect(items[0].textContent).toMatch(/450 kcal · P 49 g · K 44 g · Y 7 g/);
    expect(items[0].textContent).toMatch(/Kalan kalori payı %64 · kalan protein payı %82/);
    expect(items[1].textContent).toMatch(/Tarif/);
    expect(items[1].textContent).toMatch(/Y 1,5 g/);
  });

  it("model hazırken gösterilmez ve istek atılmaz", async () => {
    const s = stubCoach();
    renderWithQuery(<CoachPage />);
    await waitFor(() => expect(screen.getByTestId("ai-status-badge").textContent).toMatch(/Model hazır/));
    expect(screen.queryByRole("region", { name: "Model olmadan öneri" })).toBeNull();
    expect(s.calls.some((c) => c.url.includes("/api/ai/meal-suggestions"))).toBe(false);
  });

  it("'sayıları gizle' açıkken sayısız; aday yoksa ne yapılacağını söyler", async () => {
    stubCoach({ status: UNREACHABLE, profile: { ...PROFILE, hideNumbers: true } });
    renderWithQuery(<CoachPage />);
    const section = await screen.findByRole("region", { name: "Model olmadan öneri" });
    await waitFor(() => expect(within(section).getAllByRole("listitem")).toHaveLength(2));
    expect(section.textContent).not.toMatch(/\d/);
    cleanup();

    stubCoach({ status: UNREACHABLE, suggestions: { remaining: SUGGESTIONS.remaining, suggestions: [], reason: "no_candidates" } });
    renderWithQuery(<CoachPage />);
    const empty = await screen.findByRole("region", { name: "Model olmadan öneri" });
    await waitFor(() => expect(empty.textContent).toMatch(/kayıtlı öğün ya da tarif yok/));
  });
});

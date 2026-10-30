import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CoachPage from "@/app/coach/page";
import { ActionProposalCard } from "@/components/coach/ActionProposalCard";
import { AttachmentBar, UploadStatus } from "@/components/coach/AttachmentBar";
import { ChatComposer } from "@/components/coach/ChatComposer";
import { QuickPrompts, QUICK_PROMPTS } from "@/components/coach/QuickPrompts";
import { parseProposal, parseStoredProposal, type AttachedFile, type CardProposal } from "@/components/coach/types";
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
}

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
    const { rerender } = render(<QuickPrompts disabled={false} onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: QUICK_PROMPTS[0] }));
    expect(onSend).toHaveBeenCalledWith(QUICK_PROMPTS[0]);
    rerender(<QuickPrompts disabled onSend={onSend} />);
    expect((screen.getByRole("button", { name: QUICK_PROMPTS[1] }) as HTMLButtonElement).disabled).toBe(true);
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

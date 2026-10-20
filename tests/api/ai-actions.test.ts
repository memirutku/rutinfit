import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as actions } from "@/app/api/ai/actions/route";
import { GET as chatGet, POST as chatPost } from "@/app/api/ai/chat/route";
import { prisma } from "@/lib/prisma";
import { createActionDraft } from "@/lib/ai-tools/action-tools";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { startMockLLMServer, withActionBlock, type MockLLMServer } from "../helpers/mock-llm-server";

beforeEach(resetDatabase);

const foodDraft = () =>
  createActionDraft({
    draftType: "food_log",
    proposedChanges: { date: "2026-10-18", name: "Omlet", grams: 150, calories: 280, proteinG: 22, carbsG: 2, fatG: 20 },
    impactSummary: "Omlet",
  });

describe("POST /api/ai/actions — onay", () => {
  it("aynı anda iki kez onaylanan taslak yalnız BİR kez uygulanır", async () => {
    const draft = await foodDraft();
    const body = { draftId: draft.draftId, approvalToken: draft.approvalToken, action: "approve" };

    const results = await Promise.all([callRoute(actions, { body }), callRoute(actions, { body })]);

    expect(await prisma.foodLog.count()).toBe(1);
    expect(results.filter((r) => r.status === 200 && r.json.success && !r.json.alreadyApplied)).toHaveLength(1);
    expect(await prisma.auditEvent.count({ where: { actionType: "APPLY_DRAFT" } })).toBe(1);
  });

  it("uygulanmış taslağı tekrar onaylamak yeni kayıt oluşturmaz", async () => {
    const draft = await foodDraft();
    const body = { draftId: draft.draftId, approvalToken: draft.approvalToken, action: "approve" };
    await callRoute(actions, { body });
    const again = await callRoute(actions, { body });
    expect(again.json.alreadyApplied).toBe(true);
    expect(await prisma.foodLog.count()).toBe(1);
  });

  it("hata türüne göre doğru HTTP kodu döner: 404 / 403 / 410", async () => {
    const missing = await callRoute(actions, { body: { draftId: "yok", approvalToken: "x", action: "approve" } });
    expect(missing.status).toBe(404);

    const draft = await foodDraft();
    const wrong = await callRoute(actions, { body: { draftId: draft.draftId, approvalToken: "yanlis", action: "approve" } });
    expect(wrong.status).toBe(403);

    await prisma.actionDraft.update({ where: { id: draft.draftId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await callRoute(actions, {
      body: { draftId: draft.draftId, approvalToken: draft.approvalToken, action: "approve" },
    });
    expect(expired.status).toBe(410);
    expect(await prisma.foodLog.count()).toBe(0);
  });

  it("uygulanmış taslak reddedilemez (409) ve durumu değişmez", async () => {
    const draft = await foodDraft();
    await callRoute(actions, { body: { draftId: draft.draftId, approvalToken: draft.approvalToken, action: "approve" } });
    const rej = await callRoute(actions, { body: { draftId: draft.draftId, action: "reject" } });
    expect(rej.status).toBe(409);
    expect((await prisma.actionDraft.findUnique({ where: { id: draft.draftId } }))?.status).toBe("applied");
  });

  it("reissue: bekleyen taslağa yeni anahtar verir, eski anahtar geçersizleşir", async () => {
    const draft = await foodDraft();
    const re = await callRoute(actions, { body: { draftId: draft.draftId, action: "reissue" } });
    expect(re.status).toBe(200);
    expect(re.json.approvalToken).toBeTruthy();
    expect(re.json.approvalToken).not.toBe(draft.approvalToken);

    const old = await callRoute(actions, { body: { draftId: draft.draftId, approvalToken: draft.approvalToken, action: "approve" } });
    expect(old.status).toBe(403);
    const ok = await callRoute(actions, { body: { draftId: draft.draftId, approvalToken: re.json.approvalToken, action: "approve" } });
    expect(ok.status).toBe(200);
    expect(await prisma.foodLog.count()).toBe(1);
  });

  it("reissue süresi dolmuş taslakta 410 döner", async () => {
    const draft = await foodDraft();
    await prisma.actionDraft.update({ where: { id: draft.draftId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const re = await callRoute(actions, { body: { draftId: draft.draftId, action: "reissue" } });
    expect(re.status).toBe(410);
  });
});

describe("Sohbet geçmişi onay anahtarını sızdırmaz", () => {
  let llm: MockLLMServer;
  beforeAll(async () => {
    llm = await startMockLLMServer();
  });
  afterAll(async () => {
    await llm.close();
  });

  it("GET ?conversationId yanıtında ham approvalToken bulunmaz", async () => {
    await prisma.aISettings.create({ data: { id: "default-ai", baseUrl: llm.baseUrl, modelName: "mock-llama" } });
    llm.queueReply(
      withActionBlock("Öneri:", {
        type: "workout_adjustment",
        title: "Kısa Seans",
        targetDurationMinutes: 25,
        reason: "Yorgunluk",
        exercises: [{ exerciseName: "Squat", sets: 2, repMin: 8, repMax: 10, restSeconds: 90 }],
      })
    );
    const post = await callRoute(chatPost, { body: { messages: [{ role: "user", content: "Kısa antrenman" }] } });
    const token: string = post.json.actionProposal.approvalToken;
    expect(token).toBeTruthy(); // anında yanıtta istemciye verilir

    const history = await callRoute(chatGet, { query: { conversationId: post.json.conversationId } });
    expect(history.status).toBe(200);
    expect(history.text).not.toContain(token);
    expect(history.text).not.toContain("approvalTokenHash");
  });
});

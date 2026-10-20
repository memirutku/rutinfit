import { test as base, expect, type APIRequestContext } from "@playwright/test";

const MOCK = `http://127.0.0.1:${process.env.E2E_MOCK_PORT ?? 3106}`;

export interface Mocks {
  queueLLM: (content: string) => Promise<void>;
  queueLLMError: (status: number) => Promise<void>;
  reset: () => Promise<void>;
}

/** Benzersiz test verisi adı (testler aynı veritabanını paylaşır). */
export const uniq = (label: string) => `${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const actionBlock = (text: string, action: unknown) =>
  `${text}\n\n\`\`\`json\n${JSON.stringify(action, null, 2)}\n\`\`\``;

export const test = base.extend<{ mocks: Mocks; api: APIRequestContext }>({
  mocks: async ({ request }, use) => {
    const post = (path: string, data?: unknown) => request.post(`${MOCK}${path}`, { data });
    await post("/__control/reset");
    await use({
      queueLLM: async (content) => void (await post("/__control/llm/queue", { content })),
      queueLLMError: async (status) => void (await post("/__control/llm/queue", { status })),
      reset: async () => void (await post("/__control/reset")),
    });
  },
  api: async ({ request }, use) => use(request),
});

export { expect };

/** Uygulamanın kullandığı "bugün" (sunucu ile aynı makine saat dilimi). */
export const todayStr = () => new Intl.DateTimeFormat("sv-SE").format(new Date());

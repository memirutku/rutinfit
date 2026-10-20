import type { ReactElement, ReactNode } from "react";
import { render, renderHook, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** Testler için QueryClient: yeniden deneme yok, her test kendi önbelleğiyle başlar. */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/** Bileşeni QueryClientProvider içinde çizer; önbelleği incelemek için istemciyi de döner. */
export function renderWithQuery(ui: ReactElement, options: RenderOptions & { client?: QueryClient } = {}) {
  const { client = makeTestQueryClient(), ...rest } = options;
  return { client, ...render(ui, { wrapper: wrapperFor(client), ...rest }) };
}

export function renderHookWithQuery<T>(hook: () => T, client: QueryClient = makeTestQueryClient()) {
  return { client, ...renderHook(hook, { wrapper: wrapperFor(client) }) };
}

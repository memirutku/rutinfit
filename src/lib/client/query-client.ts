import { QueryClient } from "@tanstack/react-query";

/**
 * Uygulamanın tek veri katmanı ayarları.
 * - retry kapalı: sunucu yereldir; hata hemen gösterilir (önceki fetch davranışıyla aynı).
 * - Pencere odağında yeniden çekme kapalı: açık formlar (ör. iyilik hali) arka planda ezilmez.
 * - Aynı anahtarlı eşzamanlı istekler TanStack Query tarafından tekilleştirilir.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 2_000,
      },
      mutations: { retry: false },
    },
  });
}

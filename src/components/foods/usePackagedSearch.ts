"use client";

import { useMutation } from "@tanstack/react-query";
import { errorMessage } from "@/lib/client/api";
import { searchPackagedProducts } from "@/lib/client/queries/nutrition";
import type { PackagedProduct } from "@/lib/schemas/food";

/**
 * Paketli gıda araması (kullanıcı tetikler, önbelleğe alınmaz). Sonuç ve hata sayfa
 * düzeyinde tutulur; sekme değişince kaybolmaz. Yeni arama öncekini temizler.
 */
export function usePackagedSearch() {
  const mutation = useMutation({
    mutationFn: async (q: string): Promise<PackagedProduct[]> => {
      const data = await searchPackagedProducts(q);
      if (data.product) return [data.product];
      if (data.products && data.products.length > 0) return data.products;
      throw new Error(`"${q}" için ürün bulunamadı. Lütfen manuel ekleyin.`);
    },
  });

  const { mutate } = mutation;
  return {
    results: mutation.data ?? [],
    error: mutation.error ? errorMessage(mutation.error, "Arama sırasında bağlantı hatası oluştu.") : null,
    loading: mutation.isPending,
    search: (raw: string) => {
      const q = raw.trim();
      if (q) mutate(q);
    },
  };
}

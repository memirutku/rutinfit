"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { queryKeys } from "./keys";
import type { SupplementInput, SupplementView } from "@/lib/schemas/supplement";

/** F15: takviyeler ve o günkü durumları. */
export function useSupplements(date: string) {
  return useQuery({
    queryKey: [...queryKeys.supplements, date],
    queryFn: () => apiFetch<{ supplements: SupplementView[] }>(`/api/supplements?date=${date}`),
    select: (d) => d.supplements,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  // Kreatin ilerleme ekranında da görünür.
  return () => Promise.all([qc.invalidateQueries({ queryKey: queryKeys.supplements }), qc.invalidateQueries({ queryKey: queryKeys.progress })]);
}

/** İyimser güncelleme: düğme anında değişir; sunucu hata verirse eski hâline döner. */
export function useLogSupplement() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { supplementId: string; date: string; taken: boolean }) => apiFetch("/api/supplements/log", { method: "POST", json: input }),
    onMutate: async ({ supplementId, date, taken }) => {
      const key = [...queryKeys.supplements, date];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<{ supplements: SupplementView[] }>(key);
      if (previous) {
        qc.setQueryData(key, {
          supplements: previous.supplements.map((s) =>
            s.id === supplementId && s.takenToday !== taken ? { ...s, takenToday: taken, takenLast7: s.takenLast7 + (taken ? 1 : -1) } : s,
          ),
        });
      }
      return { key, previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: invalidate,
  });
}

export function useSaveSupplement() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Partial<SupplementInput> }) =>
      id ? apiFetch(`/api/supplements?id=${id}`, { method: "PATCH", json: input }) : apiFetch("/api/supplements", { method: "POST", json: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteSupplement() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/supplements?id=${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

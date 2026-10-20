import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/client/queries/keys";
import { useToggleCreatine, withCreatine } from "@/lib/client/queries/progress";
import { useAdjustPantry, useDeletePantryItem, usePantry } from "@/lib/client/queries/pantry";
import { useShoppingList, useToggleShoppingItem, withItemChecked } from "@/lib/client/queries/shopping";
import { searchPackagedProducts, useFoods } from "@/lib/client/queries/nutrition";
import { fetchOpenGymStatus, useSaveProfile } from "@/lib/client/queries/system";
import type { ProgressResponse } from "@/lib/schemas/progress";
import type { PantryItem } from "@/lib/schemas/pantry";
import type { ShoppingList } from "@/lib/schemas/shopping";
import { jsonResponse, stubFetch } from "../helpers/fetch";
import { makeTestQueryClient, renderHookWithQuery } from "../helpers/query";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

/** Testin elle çözdüğü yanıt: iyimser durumu istek bitmeden görmek için. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const progress = (taken: boolean): ProgressResponse => ({
  weights: [],
  wellbeings: [],
  measurements: [],
  creatineCompliance: [
    { date: "2026-10-19", taken: true },
    { date: "2026-10-20", taken },
  ],
  weeklyWeightDelta: 0,
  today: { date: "2026-10-20", creatineTaken: taken, weightKg: null, energy1to5: null, sleepMinutes: null, hunger1to5: null },
});

const pantryItem = (over: Partial<PantryItem> = {}): PantryItem => ({
  id: "p1", name: "Süt", amount: 1, unit: "l", category: "Süt Ürünleri", expiryDate: "2030-01-01", notes: "laktozsuz", ...over,
});

const shoppingList = (): ShoppingList => {
  const items = [
    { id: "s1", weekStart: "2026-10-19", category: "Manav", name: "Elma", amount: 500, unit: "g", checked: false },
    { id: "s2", weekStart: "2026-10-19", category: "Kuru Gıda", name: "Yulaf", amount: 300, unit: "g", checked: false },
  ];
  return { weekStart: "2026-10-19", items, grouped: { Manav: [items[0]], "Kuru Gıda": [items[1]] }, pantrySummary: "1 kalem kilerden düşüldü." };
};

describe("kreatin işareti (iyimser)", () => {
  it("istek bitmeden işaretler; sunucu hata verirse önceki duruma döner", async () => {
    const post = deferred<Response>();
    const s = stubFetch([
      [/\/api\/progress$/, (_u, init) => (init?.method === "POST" ? post.promise : jsonResponse(progress(false)))],
    ]);
    restore = s.restore;
    const client = makeTestQueryClient();
    client.setQueryData(queryKeys.progress, progress(false));
    const { result } = renderHookWithQuery(() => useToggleCreatine(), client);

    act(() => result.current.mutate({ date: "2026-10-20", taken: true }));
    await waitFor(() => expect(client.getQueryData<ProgressResponse>(queryKeys.progress)?.today.creatineTaken).toBe(true));
    expect(client.getQueryData<ProgressResponse>(queryKeys.progress)?.creatineCompliance[1].taken).toBe(true);

    post.resolve(jsonResponse({ error: "Disk dolu" }, 500));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Disk dolu");
    expect(client.getQueryData<ProgressResponse>(queryKeys.progress)?.today.creatineTaken).toBe(false);
    expect(JSON.parse(String(s.calls.find((c) => c.init?.method === "POST")?.init?.body))).toMatchObject({
      date: "2026-10-20", creatineTaken: true, creatineDoseGrams: 5,
    });
  });

  it("withCreatine yalnız ilgili günü değiştirir", () => {
    const next = withCreatine(progress(false), "2026-10-20", true);
    expect(next.creatineCompliance.map((c) => c.taken)).toEqual([true, true]);
    expect(withCreatine(progress(false), "2026-10-01", true).today.creatineTaken).toBe(false);
  });
});

describe("kiler ± (iyimser)", () => {
  it("miktar istek bitmeden değişir, hata olursa geri alınır", async () => {
    const patch = deferred<Response>();
    restore = stubFetch([
      [/\/api\/pantry$/, (_u, init) => (init?.method === "PATCH" ? patch.promise : jsonResponse({ items: [pantryItem()] }))],
    ]).restore;
    const client = makeTestQueryClient();
    client.setQueryData(queryKeys.pantry, [pantryItem()]);
    const { result } = renderHookWithQuery(() => useAdjustPantry(), client);

    act(() => result.current.mutate({ id: "p1", delta: 0.1 }));
    await waitFor(() => expect(client.getQueryData<PantryItem[]>(queryKeys.pantry)?.[0].amount).toBe(1.1));

    patch.resolve(jsonResponse({ error: "Miktar güncellenemedi." }, 500));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<PantryItem[]>(queryKeys.pantry)?.[0]).toMatchObject({ amount: 1, notes: "laktozsuz" });
  });

  it("art arda tıklamalar birikir; liste yalnız son istek bitince tazelenir", async () => {
    const pending: Array<ReturnType<typeof deferred<Response>>> = [];
    let serverAmount = 1;
    const s = stubFetch([
      [
        /\/api\/pantry$/,
        (_u, init) => {
          if (init?.method !== "PATCH") return jsonResponse({ items: [pantryItem({ amount: serverAmount })] });
          const d = deferred<Response>();
          pending.push(d);
          return d.promise;
        },
      ],
    ]);
    restore = s.restore;
    const gets = () => s.calls.filter((c) => !c.init?.method || c.init.method === "GET").length;
    const client = makeTestQueryClient();
    client.setQueryData(queryKeys.pantry, [pantryItem()]);
    const { result } = renderHookWithQuery(() => ({ list: usePantry(), adjust: useAdjustPantry() }), client);
    await waitFor(() => expect(result.current.list.isFetching).toBe(false));
    const baseline = gets();

    act(() => result.current.adjust.mutate({ id: "p1", delta: 0.1 }));
    await waitFor(() => expect(pending).toHaveLength(1));
    act(() => result.current.adjust.mutate({ id: "p1", delta: 0.1 }));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(result.current.list.data?.[0].amount).toBe(1.2);

    serverAmount = 1.1;
    pending[0].resolve(jsonResponse({ success: true, item: pantryItem({ amount: 1.1 }) }));
    await waitFor(() => expect(client.isMutating()).toBe(1));
    expect(gets()).toBe(baseline);
    expect(result.current.list.data?.[0].amount).toBe(1.2); // geri sıçramaz

    serverAmount = 1.2;
    pending[1].resolve(jsonResponse({ success: true, item: pantryItem({ amount: 1.2 }) }));
    await waitFor(() => expect(gets()).toBe(baseline + 1));
    await waitFor(() => expect(result.current.list.data?.[0].amount).toBe(1.2));
  });

  it("silme başarılı olunca öğe önbellekten çıkar", async () => {
    restore = stubFetch([[/\/api\/pantry\?id=p1/, () => jsonResponse({ success: true })]]).restore;
    const client = makeTestQueryClient();
    client.setQueryData(queryKeys.pantry, [pantryItem(), pantryItem({ id: "p2", name: "Yulaf" })]);
    const { result } = renderHookWithQuery(() => useDeletePantryItem(), client);
    await act(() => result.current.mutateAsync("p1"));
    expect(client.getQueryData<PantryItem[]>(queryKeys.pantry)?.map((i) => i.id)).toEqual(["p2"]);
  });
});

describe("alışveriş listesi", () => {
  it("kalem anında işaretlenir, gruplar güncellenir; hata olursa geri alınır ve liste yeniden çekilmez", async () => {
    const put = deferred<Response>();
    const s = stubFetch([[/\/api\/shopping/, (_u, init) => (init?.method === "PUT" ? put.promise : jsonResponse(shoppingList()))]]);
    restore = s.restore;
    const client = makeTestQueryClient();
    const key = queryKeys.shopping.week("2026-10-20");
    client.setQueryData(key, shoppingList());
    const { result } = renderHookWithQuery(() => useToggleShoppingItem("2026-10-20"), client);

    act(() => result.current.mutate({ id: "s1", checked: true }));
    await waitFor(() => expect(client.getQueryData<ShoppingList>(key)?.grouped.Manav[0].checked).toBe(true));

    put.resolve(jsonResponse({ error: "Güncelleme başarısız" }, 500));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<ShoppingList>(key)?.items[0].checked).toBe(false);
    expect(client.getQueryData<ShoppingList>(key)?.pantrySummary).toBe("1 kalem kilerden düşüldü.");
    expect(s.calls.filter((c) => c.init?.method !== "PUT")).toHaveLength(0);
  });

  it("bu hafta liste yoksa bir kez kiler düşülerek oluşturulur", async () => {
    const s = stubFetch([
      [
        /\/api\/shopping/,
        (_u, init) =>
          init?.method === "POST"
            ? jsonResponse(shoppingList())
            : jsonResponse({ weekStart: "2026-10-19", items: [], grouped: {}, generated: false }),
      ],
    ]);
    restore = s.restore;
    const { result } = renderHookWithQuery(() => useShoppingList("2026-10-20"));
    await waitFor(() => expect(result.current.data?.items).toHaveLength(2));
    const post = s.calls.find((c) => c.init?.method === "POST");
    expect(JSON.parse(String(post?.init?.body))).toEqual({ weekStart: "2026-10-20", deductPantry: true });
  });

  it("withItemChecked kategorileri sunucu sırasıyla yeniden kurar", () => {
    const next = withItemChecked(shoppingList(), "s2", true);
    expect(Object.keys(next.grouped)).toEqual(["Manav", "Kuru Gıda"]);
    expect(next.grouped["Kuru Gıda"][0].checked).toBe(true);
  });
});

describe("tekilleştirme ve geçersiz kılma", () => {
  it("aynı anahtarlı iki bileşen tek istek yapar", async () => {
    const s = stubFetch([[/\/api\/foods\?limit=50/, () => jsonResponse([])]]);
    restore = s.restore;
    const client = makeTestQueryClient();
    const a = renderHookWithQuery(() => useFoods(50), client);
    renderHookWithQuery(() => useFoods(50), client);
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    expect(s.calls).toHaveLength(1);
  });

  it("profil kaydı önbelleği günceller ve günlük özetleri (hedefler) geçersiz kılar", async () => {
    restore = stubFetch([[/\/api\/profile/, () => jsonResponse({ id: "default-user", calorieTarget: 1950 })]]).restore;
    const client = makeTestQueryClient();
    client.setQueryData(queryKeys.foodLogs.byDate("2026-10-20"), { logs: [] });
    const { result } = renderHookWithQuery(() => useSaveProfile(), client);
    await act(() =>
      result.current.mutateAsync({
        heightCm: 181, age: 25, sex: "male", currentWeightKg: 112, calorieTarget: 1950, calorieCeiling: 2100,
        proteinTargetG: 165, fatTargetG: 60, carbTargetG: 220, wakeTime: "06:00", workdayHomeTime: "19:30",
      })
    );
    expect(client.getQueryData<{ calorieTarget: number }>(queryKeys.profile)?.calorieTarget).toBe(1950);
    expect(client.getQueryState(queryKeys.foodLogs.byDate("2026-10-20"))?.isInvalidated).toBe(true);
  });
});

describe("yardımcı istekler", () => {
  it("openGym kapalıyken (500) hata yerine çevrimdışı sonucu döner", async () => {
    restore = stubFetch([[/\/api\/opengym\/status/, () => jsonResponse({ isOnline: false, error: "ECONNREFUSED" }, 500)]]).restore;
    await expect(fetchOpenGymStatus()).resolves.toEqual({ isOnline: false, error: "ECONNREFUSED" });
  });

  it("paketli gıda araması barkodu ve ürün adını doğru parametreyle gönderir", async () => {
    const s = stubFetch([[/\/api\/foods\/barcode/, () => jsonResponse({ products: [] })]]);
    restore = s.restore;
    await searchPackagedProducts(" 8690000000017 ");
    await searchPackagedProducts("Eti Lifalif");
    expect(s.calls.map((c) => c.url)).toEqual([
      "/api/foods/barcode?barcode=8690000000017",
      "/api/foods/barcode?query=Eti%20Lifalif",
    ]);
  });
});

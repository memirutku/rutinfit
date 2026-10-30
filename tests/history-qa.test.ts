import { describe, expect, it } from "vitest";
import { detectHistoryQuery, parseRange } from "@/lib/history-qa";

const TODAY = "2026-10-30"; // Cuma

describe("F50: dönem ayrıştırma", () => {
  it.each([
    ["son 30 günde", "2026-10-01", "2026-10-30"],
    ["son 2 haftada", "2026-10-17", "2026-10-30"],
    ["son 3 ayda", "2026-08-01", "2026-10-30"],
    ["bu hafta", "2026-10-26", "2026-10-30"],
    ["geçen hafta", "2026-10-19", "2026-10-25"],
    ["bu ay", "2026-10-01", "2026-10-30"],
    ["geçen ay", "2026-09-01", "2026-09-30"],
    ["dün", "2026-10-29", "2026-10-29"],
    ["bugün", "2026-10-30", "2026-10-30"],
    ["genel olarak", "2026-10-01", "2026-10-30"],
  ])("%s", (q, from, to) => {
    expect(parseRange(q, TODAY)).toMatchObject({ from, to });
  });
});

describe("F50: soru tipi", () => {
  it.each([
    ["son 30 günde ortalama kaç kalori aldım?", "avg_calories"],
    ["bu hafta proteinim nasıldı", "avg_protein"],
    ["geçen ay kaç kilo verdim", "weight_change"],
    ["son 2 haftada kaç antrenman yaptım", "workouts_count"],
    ["bench press rekorum ne?", "best_lift"],
    ["en çok ne yemişim", "top_foods"],
    ["dün ne kadar su içtim", "water_avg"],
    ["bu ay kaç km koştum", "cardio_total"],
  ])("%s → %s", (q, type) => {
    expect(detectHistoryQuery(q, TODAY)?.type).toBe(type);
  });

  it("geçmişle ilgisiz soruda null", () => {
    expect(detectHistoryQuery("akşama ne pişireyim?", TODAY)).toBeNull();
    expect(detectHistoryQuery("merhaba", TODAY)).toBeNull();
  });

  it("rekor sorusunun dönemi tüm zamanlardır", () => {
    expect(detectHistoryQuery("squat rekorum", TODAY)?.range.from).toBe("2000-01-01");
  });
});

describe("B31: kardiyo sorusunda tür", () => {
  it.each([
    ["Bu hafta kaç km koştum?", "run"],
    ["bu ay koşu mesafem ne kadar", "run"],
    ["bu hafta ne kadar yürüdüm", "walk"],
    ["bu ay kaç km bisiklet sürdüm", "cycle"],
    ["bu ay kaç km yüzdüm", "swim"],
  ])("%s → %s", (q, kind) => {
    const query = detectHistoryQuery(q, TODAY);
    expect(query?.type).toBe("cardio_total");
    expect(query?.cardioKind).toBe(kind);
  });

  it("tür belirtilmemişse ya da birden çok tür varsa filtre yok (türlere ayrılır)", () => {
    expect(detectHistoryQuery("bu hafta toplam kaç km kardiyo yaptım", TODAY)?.cardioKind).toBeUndefined();
    expect(detectHistoryQuery("bu ay kaç km koştum ve yürüdüm", TODAY)?.cardioKind).toBeUndefined();
  });
});

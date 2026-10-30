import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

/**
 * /api/health anahtarsız erişilebilir (masaüstü kabuğu sunucunun bu örnek olduğunu nonce ile
 * doğrular). Bu yüzden yalnız uygulama adı, sürüm ve nonce döner; kişisel veri asla dönmez.
 * (Dalga 4'te Apple Sağlık özeti yanlışlıkla bu adrese yazılmıştı; masaüstü açılışı takılıyordu.)
 */
describe("/api/health", () => {
  it("yalnız app, version ve nonce alanlarını döndürür", async () => {
    process.env.RUTINFIT_INSTANCE_NONCE = "test-nonce";
    try {
      const res = GET();
      const json = await res.json();
      expect(Object.keys(json).sort()).toEqual(["app", "nonce", "version"]);
      expect(json).toMatchObject({ app: "rutinfit", nonce: "test-nonce" });
    } finally {
      delete process.env.RUTINFIT_INSTANCE_NONCE;
    }
  });
});

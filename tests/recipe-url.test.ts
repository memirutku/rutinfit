import { describe, expect, it, vi } from "vitest";
import { extractRecipeFromHtml, parseIsoMinutes, parseServings } from "@/lib/recipe-jsonld";
import { assertPublicUrl, isPrivateAddress } from "@/lib/security/url-safety";

const html = (data: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body></body></html>`;

describe("F33: schema.org Recipe (JSON-LD)", () => {
  it("@graph içindeki tarifi bulur; süre, porsiyon, malzeme ve adımları okur", () => {
    const r = extractRecipeFromHtml(
      html({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebPage", name: "x" },
          {
            "@type": ["Recipe"],
            name: "Mercimek Köftesi",
            recipeYield: ["6", "6 kişilik"],
            totalTime: "PT1H15M",
            recipeIngredient: ["1 su bardağı kırmızı mercimek", "2 yemek kaşığı salça"],
            recipeInstructions: [{ "@type": "HowToStep", text: "Mercimeği haşla." }, { "@type": "HowToStep", text: "Yoğur." }],
          },
        ],
      })
    );
    expect(r).toEqual({
      name: "Mercimek Köftesi",
      servings: 6,
      prepMinutes: 75,
      ingredients: ["1 su bardağı kırmızı mercimek", "2 yemek kaşığı salça"],
      instructions: "1. Mercimeği haşla.\n2. Yoğur.",
    });
  });

  it("tarif yoksa null; bozuk JSON atlanır", () => {
    expect(extractRecipeFromHtml('<script type="application/ld+json">{bozuk</script>')).toBeNull();
    expect(extractRecipeFromHtml(html({ "@type": "Article" }))).toBeNull();
  });

  it("süre ve porsiyon biçimleri", () => {
    expect(parseIsoMinutes("PT45M")).toBe(45);
    expect(parseIsoMinutes("PT2H")).toBe(120);
    expect(parseIsoMinutes("abc")).toBeNull();
    expect(parseServings("4 kişilik")).toBe(4);
    expect(parseServings(8)).toBe(8);
    expect(parseServings(undefined)).toBe(1);
  });
});

describe("F33: adres güvenliği (SSRF)", () => {
  it("özel, yerel ve bağlantı yerel adresler reddedilir", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.5", "192.168.1.10", "169.254.169.254", "0.0.0.0", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["93.184.216.34", "8.8.8.8", "2606:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("yalnız http(s); ad çözümü özel adrese giderse reddedilir", async () => {
    const lookup = vi.fn(async (host: string) => (host === "ic.ag" ? [{ address: "192.168.1.5" }] : [{ address: "93.184.216.34" }]));
    await expect(assertPublicUrl("ftp://example.com/x", lookup)).rejects.toThrow(/http/);
    await expect(assertPublicUrl("http://ic.ag/tarif", lookup)).rejects.toThrow(/yerel/i);
    await expect(assertPublicUrl("http://user:pw@example.com", lookup)).rejects.toThrow();
    await expect(assertPublicUrl("https://www.ornek-tarif.com/mercimek", lookup)).resolves.toBeInstanceOf(URL);
  });
});

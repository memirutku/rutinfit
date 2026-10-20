import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "./helpers/db";

/**
 * Prisma 7 sürücü adaptörünün (better-sqlite3), Prisma 6 Rust motorunun yazdığı mevcut kullanıcı
 * veritabanlarıyla uyumlu çalıştığını doğrular. Bu varsayımlar bozulursa güncelleme sonrası
 * kullanıcı verisi yanlış okunur veya ilişkiler korunmaz.
 */
beforeEach(resetDatabase);

describe("SQLite sürücü adaptörü ↔ Prisma 6 veritabanı uyumu", () => {
  it("Prisma 6'nın INTEGER milisaniye olarak yazdığı DateTime değerlerini doğru okur", async () => {
    const ms = Date.UTC(2026, 2, 4, 5, 6, 7, 89);
    // Prisma 6'nın yazdığı satır: createdAt/updatedAt INTEGER (epoch ms)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "FoodItem" ("id","name","category","basisGrams","calories","proteinG","carbsG","fatG","source","confidence","createdAt","updatedAt")
       VALUES ('eski','Yulaf','Genel',100,389,16.9,66,6.9,'Katalog','Yüksek',?,?)`,
      ms,
      ms
    );
    const row = await prisma.foodItem.findUniqueOrThrow({ where: { id: "eski" } });
    expect(row.createdAt.toISOString()).toBe("2026-03-04T05:06:07.089Z");
  });

  it("yeni DateTime değerlerini de INTEGER milisaniye yazar (eski satırlarla sıralama/filtre tutarlı)", async () => {
    await prisma.foodItem.create({
      data: { id: "yeni", name: "Muz", calories: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3, createdAt: new Date("2026-05-06T07:08:09.010Z") },
    });
    const [raw] = await prisma.$queryRawUnsafe<Array<{ t: string; v: bigint | number }>>(
      `SELECT typeof("createdAt") AS t, "createdAt" AS v FROM "FoodItem" WHERE id = 'yeni'`
    );
    expect(raw.t).toBe("integer");
    expect(Number(raw.v)).toBe(Date.UTC(2026, 4, 6, 7, 8, 9, 10));

    const after = await prisma.foodItem.findMany({ where: { createdAt: { gte: new Date("2026-04-01") } }, select: { id: true } });
    expect(after.map((r) => r.id)).toEqual(["yeni"]);
  });

  it("yabancı anahtarlar açık: ilişkili kayıt silinince alt kayıtlar da silinir (onDelete: Cascade)", async () => {
    const [fk] = await prisma.$queryRawUnsafe<Array<{ foreign_keys: bigint | number }>>("PRAGMA foreign_keys");
    expect(Number(fk.foreign_keys)).toBe(1);

    const food = await prisma.foodItem.create({ data: { name: "Pirinç", calories: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 } });
    const recipe = await prisma.recipe.create({
      data: { name: "Pilav", ingredients: { create: [{ foodItemId: food.id, grams: 150 }] } },
    });
    await prisma.recipe.delete({ where: { id: recipe.id } });
    expect(await prisma.recipeIngredient.count({ where: { recipeId: recipe.id } })).toBe(0);

    // Var olmayan kayda bağlanan alt kayıt reddedilir
    await expect(
      prisma.recipeIngredient.create({ data: { recipeId: "yok", foodItemId: food.id, grams: 1 } })
    ).rejects.toMatchObject({ code: "P2003" });
  });
});

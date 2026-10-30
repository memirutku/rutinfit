-- AlterTable
ALTER TABLE "Supplement" ADD COLUMN "caloriesPerDose" REAL;
ALTER TABLE "Supplement" ADD COLUMN "proteinPerDose" REAL;

-- AlterTable
ALTER TABLE "SupplementLog" ADD COLUMN "foodLogId" TEXT;


-- B02: Yeni kurulumda takviye listesi boş başlar. 0019'un herkese eklediği varsayılan kreatin,
-- kullanıcı onu hiç kullanmadıysa (kreatin kaydı ya da hatırlatması yok, adı değişmemiş) kaldırılır.
-- Kreatin kaydı olan mevcut kullanıcının takviyesi kalır.
DELETE FROM "Supplement"
WHERE "id" = 'default-creatine'
  AND "name" = 'Kreatin Monohidrat'
  AND NOT EXISTS (SELECT 1 FROM "SupplementLog" WHERE "name" = 'Kreatin Monohidrat')
  AND NOT EXISTS (SELECT 1 FROM "Reminder" WHERE "supplementId" = 'default-creatine');

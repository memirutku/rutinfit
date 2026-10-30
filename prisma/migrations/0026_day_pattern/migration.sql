-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "dayPattern" TEXT;


-- Kurulumu tamamlamış mevcut kullanıcılar şimdiye kadar ofis düzenine göre (iş çıkışı, eve varış)
-- bant görüyordu; onlarda davranış değişmesin. Yeni kurulumlar boş (null) başlar.
UPDATE "UserProfile" SET "dayPattern" = 'office' WHERE "isOnboarded" = 1;

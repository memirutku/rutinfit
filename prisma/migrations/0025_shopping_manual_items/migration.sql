-- B09: kullanıcının alışveriş listesine elle eklediği kalem (plandan yenilemede silinmez)
ALTER TABLE "ShoppingListItem" ADD COLUMN "manual" BOOLEAN NOT NULL DEFAULT false;

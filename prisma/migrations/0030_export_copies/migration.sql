-- B36: dışa aktarma kopyası ayarı (varsayılan açık). Yalnız sütun eklenir.
ALTER TABLE "AutoBackupSettings" ADD COLUMN "exportCopies" BOOLEAN NOT NULL DEFAULT true;

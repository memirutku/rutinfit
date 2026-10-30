-- F82: isteğe bağlı adet döngüsü notu
ALTER TABLE "UserProfile" ADD COLUMN "cycleTracking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DailyWellbeing" ADD COLUMN "cycleNote" TEXT;

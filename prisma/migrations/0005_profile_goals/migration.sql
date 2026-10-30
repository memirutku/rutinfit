-- F09: kurulum sihirbazı girdileri.
ALTER TABLE "UserProfile" ADD COLUMN "activityLevel" TEXT NOT NULL DEFAULT 'light';
ALTER TABLE "UserProfile" ADD COLUMN "goalType" TEXT NOT NULL DEFAULT 'lose';
ALTER TABLE "UserProfile" ADD COLUMN "goalRateKgPerWeek" REAL NOT NULL DEFAULT 0.5;
ALTER TABLE "UserProfile" ADD COLUMN "targetWeightKg" REAL;

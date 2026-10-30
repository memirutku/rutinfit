-- F19: set tipi; F21: egzersiz başına artış miktarı.
ALTER TABLE "SetLog" ADD COLUMN "setType" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "WorkoutExercise" ADD COLUMN "incrementKg" REAL NOT NULL DEFAULT 2.5;

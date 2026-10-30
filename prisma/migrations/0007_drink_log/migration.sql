-- F13: içecek günlüğü ve günlük sıvı hedefi.
-- CreateTable
CREATE TABLE "DrinkLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL DEFAULT '12:00',
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ml" REAL NOT NULL,
    "caffeineMg" REAL NOT NULL DEFAULT 0,
    "alcoholG" REAL NOT NULL DEFAULT 0,
    "kcal" REAL NOT NULL DEFAULT 0,
    "foodLogId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrinkLog_foodLogId_fkey" FOREIGN KEY ("foodLogId") REFERENCES "FoodLog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "waterTargetMl" INTEGER NOT NULL DEFAULT 2500;

-- CreateIndex
CREATE UNIQUE INDEX "DrinkLog_foodLogId_key" ON "DrinkLog"("foodLogId");
CREATE INDEX "DrinkLog_date_idx" ON "DrinkLog"("date");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailyWellbeing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "energy1to5" INTEGER,
    "hunger1to5" INTEGER,
    "sleepMinutes" INTEGER,
    "stress1to5" INTEGER,
    "soreness1to5" INTEGER,
    "mood1to5" INTEGER,
    "cycleNote" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_DailyWellbeing" ("createdAt", "cycleNote", "date", "energy1to5", "hunger1to5", "id", "mood1to5", "notes", "sleepMinutes", "soreness1to5", "stress1to5", "updatedAt") SELECT "createdAt", "cycleNote", "date", "energy1to5", "hunger1to5", "id", "mood1to5", "notes", "sleepMinutes", "soreness1to5", "stress1to5", "updatedAt" FROM "DailyWellbeing";
DROP TABLE "DailyWellbeing";
ALTER TABLE "new_DailyWellbeing" RENAME TO "DailyWellbeing";
CREATE UNIQUE INDEX "DailyWellbeing_date_key" ON "DailyWellbeing"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- CreateTable
CREATE TABLE "CardioLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "durationMin" REAL NOT NULL,
    "distanceKm" REAL,
    "avgHr" INTEGER,
    "rpe" REAL,
    "kcal" REAL,
    "kcalEstimated" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CardioLog_date_idx" ON "CardioLog"("date");


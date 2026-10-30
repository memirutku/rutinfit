-- CreateTable
CREATE TABLE "ProgressPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "pose" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BodyMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "waistCm" REAL,
    "hipCm" REAL,
    "chestCm" REAL,
    "armCm" REAL,
    "thighCm" REAL,
    "neckCm" REAL,
    "bodyFatPercent" REAL,
    "restingHr" INTEGER,
    "systolic" INTEGER,
    "diastolic" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_BodyMeasurement" ("createdAt", "date", "id", "waistCm") SELECT "createdAt", "date", "id", "waistCm" FROM "BodyMeasurement";
DROP TABLE "BodyMeasurement";
ALTER TABLE "new_BodyMeasurement" RENAME TO "BodyMeasurement";
CREATE UNIQUE INDEX "BodyMeasurement_date_key" ON "BodyMeasurement"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ProgressPhoto_fileName_key" ON "ProgressPhoto"("fileName");

-- CreateIndex
CREATE INDEX "ProgressPhoto_date_idx" ON "ProgressPhoto"("date");


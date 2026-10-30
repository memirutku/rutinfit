-- CreateTable
CREATE TABLE "WeeklyCheckin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" TEXT NOT NULL,
    "metrics" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "suggestion" TEXT,
    "draftId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCheckin_weekStart_key" ON "WeeklyCheckin"("weekStart");


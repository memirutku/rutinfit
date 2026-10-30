-- F15: takviye listesi
CREATE TABLE "Supplement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "doseAmount" REAL NOT NULL,
    "doseUnit" TEXT NOT NULL DEFAULT 'g',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Supplement_name_key" ON "Supplement"("name");

-- Günlük kayıtta doz birimi
ALTER TABLE "SupplementLog" ADD COLUMN "doseUnit" TEXT NOT NULL DEFAULT 'g';

-- Mevcut kreatin işaretlemesi listede görünmeye devam etsin
INSERT INTO "Supplement" ("id", "name", "doseAmount", "doseUnit", "active", "sortOrder", "createdAt", "updatedAt")
VALUES ('default-creatine', 'Kreatin Monohidrat', 5, 'g', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

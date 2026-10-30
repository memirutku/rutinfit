-- F14: aralıklı oruç kayıtları
CREATE TABLE "FastingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "targetHours" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- F76: Ramazan modu · F14: aralıklı oruç hedefi
ALTER TABLE "UserProfile" ADD COLUMN "ramadanMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserProfile" ADD COLUMN "ramadanProvince" TEXT NOT NULL DEFAULT 'İstanbul';
ALTER TABLE "UserProfile" ADD COLUMN "ramadanImsakAdjust" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserProfile" ADD COLUMN "ramadanIftarAdjust" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserProfile" ADD COLUMN "fastingTargetHours" INTEGER;

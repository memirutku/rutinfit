-- CreateTable
CREATE TABLE "AutoBackupSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "folderPath" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "keepCount" INTEGER NOT NULL DEFAULT 10,
    "lastRunAt" DATETIME,
    "lastStatus" TEXT,
    "lastMessage" TEXT,
    "lastFile" TEXT,
    "updatedAt" DATETIME NOT NULL
);


-- RutinFit başlangıç şeması (baseline).
-- IF NOT EXISTS ile idempotenttir: `prisma db push` ile kurulmuş mevcut veritabanlarına da
-- güvenle uygulanır ve eksik tablo/indeksleri tamamlar. Uygulayıcı: src/lib/db/migrate.ts

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default-user',
    "heightCm" REAL NOT NULL DEFAULT 181,
    "age" INTEGER NOT NULL DEFAULT 25,
    "sex" TEXT NOT NULL DEFAULT 'male',
    "currentWeightKg" REAL NOT NULL DEFAULT 112,
    "calorieTarget" INTEGER NOT NULL DEFAULT 2080,
    "calorieCeiling" INTEGER NOT NULL DEFAULT 2100,
    "proteinTargetG" INTEGER NOT NULL DEFAULT 165,
    "fatTargetG" INTEGER NOT NULL DEFAULT 60,
    "carbTargetG" INTEGER NOT NULL DEFAULT 220,
    "wakeTime" TEXT NOT NULL DEFAULT '06:00',
    "workdayHomeTime" TEXT NOT NULL DEFAULT '19:30',
    "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FoodItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Genel',
    "brand" TEXT,
    "barcode" TEXT,
    "basisGrams" REAL NOT NULL DEFAULT 100,
    "calories" REAL NOT NULL,
    "proteinG" REAL NOT NULL,
    "carbsG" REAL NOT NULL,
    "fatG" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'Katalog',
    "confidence" TEXT NOT NULL DEFAULT 'Yüksek',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "prepMinutes" INTEGER NOT NULL DEFAULT 15,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RecipeIngredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "foodItemId" TEXT NOT NULL,
    "grams" REAL NOT NULL,
    CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeIngredient_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MealPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlannedMeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mealPlanId" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "recipeId" TEXT,
    "customName" TEXT,
    "plannedTime" TEXT,
    "servings" REAL NOT NULL DEFAULT 1,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PlannedMeal_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlannedMeal_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FoodLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "foodItemId" TEXT,
    "recipeId" TEXT,
    "name" TEXT NOT NULL,
    "grams" REAL NOT NULL,
    "caloriesSnapshot" REAL NOT NULL,
    "proteinSnapshot" REAL NOT NULL,
    "carbsSnapshot" REAL NOT NULL,
    "fatSnapshot" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FoodLog_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FoodLog_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkoutTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "targetDurationMinutes" INTEGER NOT NULL DEFAULT 40,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkoutExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "targetSets" INTEGER NOT NULL DEFAULT 3,
    "repMin" INTEGER NOT NULL DEFAULT 8,
    "repMax" INTEGER NOT NULL DEFAULT 12,
    "restSeconds" INTEGER NOT NULL DEFAULT 90,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WorkoutExercise_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkoutSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "rpe" INTEGER,
    "notes" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkoutSession_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SetLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutSessionId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "weightKg" REAL NOT NULL,
    "reps" INTEGER NOT NULL,
    "isTargetMet" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SetLog_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "WorkoutSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WeightLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "weightKg" REAL NOT NULL,
    "conditionsNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BodyMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "waistCm" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DailyWellbeing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "energy1to5" INTEGER NOT NULL DEFAULT 3,
    "hunger1to5" INTEGER NOT NULL DEFAULT 3,
    "sleepMinutes" INTEGER NOT NULL DEFAULT 420,
    "stress1to5" INTEGER NOT NULL DEFAULT 3,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupplementLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Kreatin Monohidrat',
    "doseGrams" REAL NOT NULL DEFAULT 5.0,
    "taken" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ShoppingListItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AISettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default-ai',
    "providerType" TEXT NOT NULL DEFAULT 'ollama',
    "baseUrl" TEXT NOT NULL DEFAULT 'http://127.0.0.1:11434/v1',
    "modelName" TEXT NOT NULL DEFAULT 'llama3.2',
    "connectionStatus" TEXT NOT NULL DEFAULT 'untested',
    "lastTestedAt" DATETIME
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AIConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'Yeni Sohbet',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AIMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileIds" TEXT,
    "draftId" TEXT,
    "actionProposal" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AIMessage_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ActionDraft" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UploadedFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "parseErrors" TEXT,
    "retentionUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ExtractedArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileId" TEXT NOT NULL,
    "normalizedType" TEXT NOT NULL,
    "structuredData" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "uncertainties" TEXT,
    "sourceSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtractedArtifact_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "UploadedFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActionDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftType" TEXT NOT NULL,
    "proposedChanges" TEXT NOT NULL,
    "impactSummary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvalTokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "status" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PantryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "category" TEXT NOT NULL DEFAULT 'Genel',
    "expiryDate" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OpenFoodFactsCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queryKey" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FoodItem_barcode_key" ON "FoodItem"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MealPlan_date_key" ON "MealPlan"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FoodLog_date_createdAt_idx" ON "FoodLog"("date", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkoutSession_date_idx" ON "WorkoutSession"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SetLog_workoutSessionId_idx" ON "SetLog"("workoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WeightLog_date_key" ON "WeightLog"("date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BodyMeasurement_date_key" ON "BodyMeasurement"("date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DailyWellbeing_date_key" ON "DailyWellbeing"("date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SupplementLog_date_name_key" ON "SupplementLog"("date", "name");

-- Eski (db push ile kurulmuş) veritabanlarında aynı hafta + ad için kopya satır olabilir;
-- benzersiz indeksten önce her gruptan yalnız ilk satır bırakılır. Boş tabloda etkisizdir.
DELETE FROM "ShoppingListItem" WHERE rowid NOT IN (
    SELECT MIN(rowid) FROM "ShoppingListItem" GROUP BY "weekStart", "name"
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ShoppingListItem_weekStart_name_key" ON "ShoppingListItem"("weekStart", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UploadedFile_hash_key" ON "UploadedFile"("hash");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ActionDraft_approvalTokenHash_key" ON "ActionDraft"("approvalTokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PantryItem_name_idx" ON "PantryItem"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OpenFoodFactsCache_queryKey_key" ON "OpenFoodFactsCache"("queryKey");


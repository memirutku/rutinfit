-- CreateTable
CREATE TABLE "SavedMeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mealType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SavedMealItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "savedMealId" TEXT NOT NULL,
    "foodItemId" TEXT,
    "recipeId" TEXT,
    "name" TEXT NOT NULL,
    "grams" REAL NOT NULL,
    "caloriesSnapshot" REAL NOT NULL,
    "proteinSnapshot" REAL NOT NULL,
    "carbsSnapshot" REAL NOT NULL,
    "fatSnapshot" REAL NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SavedMealItem_savedMealId_fkey" FOREIGN KEY ("savedMealId") REFERENCES "SavedMeal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedMealItem_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SavedMealItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SavedMealItem_savedMealId_idx" ON "SavedMealItem"("savedMealId");

-- CreateIndex
CREATE INDEX "SavedMealItem_foodItemId_idx" ON "SavedMealItem"("foodItemId");

-- CreateIndex
CREATE INDEX "SavedMealItem_recipeId_idx" ON "SavedMealItem"("recipeId");


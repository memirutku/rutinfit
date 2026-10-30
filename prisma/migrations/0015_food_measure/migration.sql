-- CreateTable
CREATE TABLE "FoodMeasure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "foodItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grams" REAL NOT NULL,
    CONSTRAINT "FoodMeasure_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FoodMeasure_foodItemId_name_key" ON "FoodMeasure"("foodItemId", "name");


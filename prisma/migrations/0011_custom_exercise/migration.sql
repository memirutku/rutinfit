-- CreateTable
CREATE TABLE "CustomExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameTr" TEXT,
    "primary" TEXT NOT NULL,
    "secondary" TEXT NOT NULL DEFAULT '[]',
    "equipment" TEXT NOT NULL,
    "cues" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomExercise_name_key" ON "CustomExercise"("name");


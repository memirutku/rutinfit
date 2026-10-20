-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecipeIngredient_foodItemId_idx" ON "RecipeIngredient"("foodItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlannedMeal_mealPlanId_idx" ON "PlannedMeal"("mealPlanId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlannedMeal_recipeId_idx" ON "PlannedMeal"("recipeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FoodLog_foodItemId_idx" ON "FoodLog"("foodItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FoodLog_recipeId_idx" ON "FoodLog"("recipeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkoutExercise_templateId_idx" ON "WorkoutExercise"("templateId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkoutSession_templateId_idx" ON "WorkoutSession"("templateId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AIMessage_draftId_idx" ON "AIMessage"("draftId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExtractedArtifact_fileId_idx" ON "ExtractedArtifact"("fileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActionDraft_status_expiresAt_idx" ON "ActionDraft"("status", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");


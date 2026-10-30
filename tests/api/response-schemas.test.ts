import { beforeEach, describe, expect, it } from "vitest";
import { GET as profileGet } from "@/app/api/profile/route";
import { GET as foodsGet, POST as foodsPost } from "@/app/api/foods/route";
import { GET as recipesGet, POST as recipesPost } from "@/app/api/recipes/route";
import { GET as foodLogsGet, POST as foodLogsPost } from "@/app/api/food-logs/route";
import { GET as progressGet } from "@/app/api/progress/route";
import { GET as workoutsGet, POST as workoutsPost } from "@/app/api/workouts/route";
import { GET as pantryGet, PATCH as pantryPatch, POST as pantryPost } from "@/app/api/pantry/route";
import { GET as shoppingGet, POST as shoppingPost, PUT as shoppingPut } from "@/app/api/shopping/route";
import { GET as mealPlansGet } from "@/app/api/meal-plans/route";
import { GET as diagnosticsGet } from "@/app/api/diagnostics/route";
import { GET as chatGet } from "@/app/api/ai/chat/route";
import { prisma } from "@/lib/prisma";
import { getLocalDateString } from "@/lib/date-utils";
import { FoodItemSchema, FoodLogSchema, FoodLogsResponseSchema, RecipeSchema } from "@/lib/schemas/food";
import { ProfileSchema } from "@/lib/schemas/profile";
import { ProgressResponseSchema } from "@/lib/schemas/progress";
import { FinishWorkoutResponseSchema, WorkoutsResponseSchema } from "@/lib/schemas/workout";
import { PantryItemResultSchema, PantryResponseSchema } from "@/lib/schemas/pantry";
import { ShoppingListItemSchema, ShoppingListSchema } from "@/lib/schemas/shopping";
import { MealPlanSchema } from "@/lib/schemas/meal-plan";
import { DiagnosticsSchema } from "@/lib/schemas/system";
import { ActionProposalSchema, ConversationDetailSchema, ConversationListSchema } from "@/lib/schemas/chat";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createFood, createMealPlan, createRecipe } from "../helpers/factories";

/**
 * İstemci tipleri src/lib/schemas altındaki yanıt şemalarından türetilir. Bu testler
 * gerçek route yanıtlarını o şemalarla ayrıştırır: sunucu yanıtı değişip tip geride
 * kalırsa burada yakalanır.
 */
beforeEach(resetDatabase);

const today = getLocalDateString();

describe("yanıt şemaları gerçek route yanıtlarıyla uyumlu", () => {
  it("profil", async () => {
    const res = await callRoute(profileGet);
    expect(ProfileSchema.parse(res.json).id).toBe("default-user");
  });

  it("besin, tarif ve öğün kaydı", async () => {
    const created = await callRoute(foodsPost, { body: { name: "Yulaf", calories: 370, proteinG: 13, carbsG: 60, fatG: 7 } });
    FoodItemSchema.parse(created.json);
    for (const f of (await callRoute(foodsGet)).json) FoodItemSchema.parse(f);

    const recipe = await callRoute(recipesPost, { body: { name: "Kase", ingredients: [{ foodItemId: created.json.id, grams: 80 }] } });
    RecipeSchema.parse(recipe.json);
    const recipes = (await callRoute(recipesGet)).json;
    expect(RecipeSchema.parse(recipes[0]).calculatedMacros).toBeDefined();

    const log = await callRoute(foodLogsPost, {
      body: { date: today, mealType: "breakfast", foodItemId: created.json.id, name: "Yulaf", grams: 50 },
    });
    FoodLogSchema.parse(log.json);
    expect(FoodLogsResponseSchema.parse((await callRoute(foodLogsGet, { query: { date: today } })).json).logs).toHaveLength(1);
  });

  it("ilerleme", async () => {
    await prisma.weightLog.create({ data: { date: today, weightKg: 100 } });
    await prisma.dailyWellbeing.create({ data: { date: today } });
    expect(ProgressResponseSchema.parse((await callRoute(progressGet)).json).today.weightKg).toBe(100);
  });

  it("antrenman şablonu, seans listesi ve bitirme yanıtı", async () => {
    await prisma.workoutTemplate.create({
      data: { name: "Ağırlık A", type: "strength", dayOfWeek: 1, exercises: { create: [{ exerciseName: "Squat" }] } },
    });
    const finished = await callRoute(workoutsPost, {
      body: {
        date: today, name: "Ağırlık A", durationMinutes: 40,
        setLogs: [{ exerciseName: "Squat", setNumber: 1, weightKg: 60, reps: 10, targetRepMin: 8, targetRepMax: 12 }],
      },
    });
    expect(Object.keys(FinishWorkoutResponseSchema.parse(finished.json).progressionFeedbacks)).toEqual(["Squat"]);
    const list = WorkoutsResponseSchema.parse((await callRoute(workoutsGet)).json);
    expect(list.templates[0].exercises).toHaveLength(1);
    expect(list.sessions[0].setLogs).toHaveLength(1);
  });

  it("kiler", async () => {
    const saved = PantryItemResultSchema.parse((await callRoute(pantryPost, { body: { name: "Süt", amount: 1, unit: "l" } })).json);
    PantryItemResultSchema.parse((await callRoute(pantryPatch, { method: "PATCH", body: { id: saved.item.id, delta: 0.1 } })).json);
    expect(PantryResponseSchema.parse((await callRoute(pantryGet)).json).items).toHaveLength(1);
  });

  it("yemek planı ve alışveriş listesi", async () => {
    const food = await createFood({ name: "Bulgur", category: "Kuru Gıda" });
    const recipe = await createRecipe([{ foodItemId: food.id, grams: 200 }]);
    await createMealPlan(today, [{ mealType: "lunch", recipeId: recipe.id }]);

    const plans = (await callRoute(mealPlansGet, { query: { date: today } })).json;
    expect(MealPlanSchema.parse(plans[0]).meals[0].calculatedMacros).not.toBeNull();

    const generated = ShoppingListSchema.parse((await callRoute(shoppingPost, { body: { weekStart: today } })).json);
    expect(generated.pantrySummary).toBeTypeOf("string");
    ShoppingListItemSchema.parse(
      (await callRoute(shoppingPut, { method: "PUT", body: { id: generated.items[0].id, checked: true } })).json
    );
    expect(ShoppingListSchema.parse((await callRoute(shoppingGet, { query: { weekStart: today } })).json).generated).toBe(true);
  });

  it("tanılama", async () => {
    const res = await callRoute(diagnosticsGet);
    expect(DiagnosticsSchema.parse(res.json).counts.foods).toBe(0);
  });

  it("sohbet listesi ve kayıtlı öneri", async () => {
    const proposal = {
      type: "meal_proposal", title: "Tavuklu Tabak", rationale: "Protein", draftId: "d1",
      ingredients: [{ foodName: "Tavuk", grams: 150 }],
      deterministicMacros: { totalCalories: 250, totalProteinG: 45, totalCarbsG: 0, totalFatG: 5, missingIngredients: [] },
    };
    const conv = await prisma.aIConversation.create({
      data: {
        title: "Akşam",
        messages: {
          create: [
            { role: "user", content: "Akşam ne yiyeyim?" },
            { role: "assistant", content: "Önerim:", actionProposal: JSON.stringify(proposal) },
          ],
        },
      },
    });
    expect(ConversationListSchema.parse((await callRoute(chatGet)).json).conversations).toHaveLength(1);
    const detail = ConversationDetailSchema.parse((await callRoute(chatGet, { query: { conversationId: conv.id } })).json);
    const stored = detail.conversation.messages.find((m) => m.actionProposal)?.actionProposal;
    expect(ActionProposalSchema.parse(JSON.parse(stored!)).type).toBe("meal_proposal");
  });
});

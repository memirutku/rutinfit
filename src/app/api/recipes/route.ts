import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { calculateRecipeMacros } from "@/lib/nutrition-calculator";
import { RecipeInputSchema } from "@/lib/schemas/food";

export async function GET() {
  try {
    const recipes = await prisma.recipe.findMany({
      include: {
        ingredients: {
          include: {
            foodItem: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const enrichedRecipes = recipes.map((recipe) => {
      const macros = calculateRecipeMacros(
        recipe.ingredients.map((ing) => ({
          grams: ing.grams,
          foodItem: {
            basisGrams: ing.foodItem.basisGrams,
            calories: ing.foodItem.calories,
            proteinG: ing.foodItem.proteinG,
            carbsG: ing.foodItem.carbsG,
            fatG: ing.foodItem.fatG,
          },
        }))
      );

      return {
        ...recipe,
        calculatedMacros: macros,
      };
    });

    return NextResponse.json(enrichedRecipes);
  } catch (error) {
    return apiError(error, "Tarifler getirilemedi", "Recipes GET");
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = RecipeInputSchema.parse(body);

    const recipe = await prisma.recipe.create({
      data: {
        name: validated.name,
        instructions: validated.instructions,
        prepMinutes: validated.prepMinutes,
        servings: validated.servings,
        tags: validated.tags ? JSON.stringify(validated.tags) : null,
        ingredients: {
          create: validated.ingredients.map((ing) => ({
            foodItemId: ing.foodItemId,
            grams: ing.grams,
          })),
        },
      },
      include: {
        ingredients: {
          include: {
            foodItem: true,
          },
        },
      },
    });

    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    return apiError(error, "Tarif oluşturulamadı", "Recipes POST");
  }
}

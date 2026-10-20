import { NextResponse } from "next/server";
import fs from "fs";
import { prisma } from "@/lib/prisma";
import { getStoragePaths } from "@/lib/storage-paths";

export async function GET() {
  try {
    // turbopackIgnore: kullanıcı veri klasörü; derleyici bu yolları izleyip pakete katmasın.
    const paths = getStoragePaths();

    // Veritabanı dosya boyutu
    let dbSizeBytes = 0;
    let dbExists = false;
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ paths.dbPath)) {
        const stat = fs.statSync(/*turbopackIgnore: true*/ paths.dbPath);
        dbSizeBytes = stat.size;
        dbExists = true;
      }
    } catch {
      // ignore
    }

    // Yedek klasörü ve yedek sayısı
    let backupCount = 0;
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ paths.backupsDir)) {
        const files = fs.readdirSync(/*turbopackIgnore: true*/ paths.backupsDir);
        backupCount = files.filter((f) => f.endsWith(".db.bak") || f.endsWith(".json")).length;
      }
    } catch {
      // ignore
    }

    // Tablo kayıt sayıları
    const [
      foodCount,
      foodLogCount,
      recipeCount,
      mealPlanCount,
      workoutSessionCount,
      setLogCount,
      weightLogCount,
      wellbeingCount,
      pantryCount,
      shoppingCount,
      cacheCount,
    ] = await Promise.all([
      prisma.foodItem.count(),
      prisma.foodLog.count(),
      prisma.recipe.count(),
      prisma.mealPlan.count(),
      prisma.workoutSession.count(),
      prisma.setLog.count(),
      prisma.weightLog.count(),
      prisma.dailyWellbeing.count(),
      prisma.pantryItem.count(),
      prisma.shoppingListItem.count(),
      prisma.openFoodFactsCache.count(),
    ]);

    const memory = process.memoryUsage();

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      storage: {
        dataDir: paths.dataDir,
        dbPath: paths.dbPath,
        dbExists,
        dbSizeFormatted: `${(dbSizeBytes / (1024 * 1024)).toFixed(2)} MB`,
        dbSizeBytes,
        backupsDir: paths.backupsDir,
        backupCount,
        isCustomPath: paths.isCustomPath,
      },
      counts: {
        foods: foodCount,
        foodLogs: foodLogCount,
        recipes: recipeCount,
        mealPlans: mealPlanCount,
        workoutSessions: workoutSessionCount,
        setLogs: setLogCount,
        weightLogs: weightLogCount,
        wellbeings: wellbeingCount,
        pantryItems: pantryCount,
        shoppingListItems: shoppingCount,
        openFoodFactsCache: cacheCount,
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptimeSeconds: Math.round(process.uptime()),
        memoryRssMb: Math.round(memory.rss / (1024 * 1024)),
      },
    });
  } catch (error: any) {
    console.error("Diagnostics error:", error);
    return NextResponse.json(
      { status: "error", error: error.message || "Tanılama verileri alınamadı" },
      { status: 500 }
    );
  }
}

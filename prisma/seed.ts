import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { runMigrations } from "../src/lib/db/migrate";
import { getPrismaDatabaseUrl } from "../src/lib/storage-paths";

// DATABASE_URL verilmişse onu (testler/E2E), yoksa uygulamanın kendi veritabanını kullan.
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL || getPrismaDatabaseUrl() });

async function main() {
  await runMigrations(prisma, { migrationsDir: path.join(__dirname, "migrations") });
  console.log("🌱 RutinFit başlangıç verileri yükleniyor...");

  // 1. Kullanıcı Profili (Brief'teki başlangıç değerleri)
  await prisma.userProfile.upsert({
    where: { id: "default-user" },
    update: {},
    create: {
      id: "default-user",
      heightCm: 181,
      age: 25,
      sex: "male",
      currentWeightKg: 112,
      calorieTarget: 2080,
      calorieCeiling: 2100,
      proteinTargetG: 165,
      fatTargetG: 60,
      carbTargetG: 220,
      wakeTime: "06:00",
      workdayHomeTime: "19:30",
      isOnboarded: true,
    },
  });

  // 2. AI Ayarları
  await prisma.aISettings.upsert({
    where: { id: "default-ai" },
    update: {},
    create: {
      id: "default-ai",
      providerType: "ollama",
      baseUrl: "http://127.0.0.1:11434/v1",
      modelName: "llama3.2",
      connectionStatus: "untested",
    },
  });

  // 3. Besin Kataloğu
  const foods = [
    {
      name: "Tavuk Göğsü (çiğ)",
      category: "Kasap & Balık",
      calories: 120,
      proteinG: 23.0,
      carbsG: 0.0,
      fatG: 2.5,
      source: "USDA/TÜRKOMP",
      confidence: "Yüksek",
    },
    {
      name: "Yumurta (büyük boy, adet ~50g)",
      category: "Süt Ürünleri & Yumurta",
      calories: 143,
      proteinG: 12.6,
      carbsG: 0.7,
      fatG: 9.5,
      source: "USDA",
      confidence: "Yüksek",
    },
    {
      name: "Lor Peyniri (az yağlı)",
      category: "Süt Ürünleri & Yumurta",
      calories: 85,
      proteinG: 17.0,
      carbsG: 3.0,
      fatG: 0.5,
      source: "TÜRKOMP",
      confidence: "Yüksek",
    },
    {
      name: "Yoğurt (%1.5 az yağlı)",
      category: "Süt Ürünleri & Yumurta",
      calories: 56,
      proteinG: 4.0,
      carbsG: 5.0,
      fatG: 1.5,
      source: "TÜRKOMP",
      confidence: "Yüksek",
    },
    {
      name: "Süt (%1.5 yarım yağlı)",
      category: "Süt Ürünleri & Yumurta",
      calories: 46,
      proteinG: 3.2,
      carbsG: 4.8,
      fatG: 1.5,
      source: "TÜRKOMP",
      confidence: "Yüksek",
    },
    {
      name: "Yulaf Ezmesi",
      category: "Kuru Gıda & Tahıllar",
      calories: 370,
      proteinG: 13.0,
      carbsG: 62.0,
      fatG: 7.0,
      source: "USDA",
      confidence: "Yüksek",
    },
    {
      name: "Pilavlık Bulgur (çiğ)",
      category: "Kuru Gıda & Tahıllar",
      calories: 340,
      proteinG: 12.0,
      carbsG: 68.0,
      fatG: 1.5,
      source: "TÜRKOMP",
      confidence: "Yüksek",
    },
    {
      name: "Pirinç (baldo/basmati)",
      category: "Kuru Gıda & Tahıllar",
      calories: 350,
      proteinG: 7.0,
      carbsG: 78.0,
      fatG: 0.8,
      source: "USDA",
      confidence: "Yüksek",
    },
    {
      name: "Tam Buğday Ekmeği",
      category: "Kuru Gıda & Tahıllar",
      calories: 245,
      proteinG: 10.0,
      carbsG: 44.0,
      fatG: 2.5,
      source: "TÜRKOMP",
      confidence: "Yüksek",
    },
    {
      name: "Patates (çiğ)",
      category: "Manav (Sebze & Meyve)",
      calories: 77,
      proteinG: 2.0,
      carbsG: 17.5,
      fatG: 0.1,
      source: "USDA",
      confidence: "Yüksek",
    },
    {
      name: "Muz",
      category: "Manav (Sebze & Meyve)",
      calories: 89,
      proteinG: 1.1,
      carbsG: 22.8,
      fatG: 0.3,
      source: "USDA",
      confidence: "Yüksek",
    },
    {
      name: "Elma",
      category: "Manav (Sebze & Meyve)",
      calories: 52,
      proteinG: 0.3,
      carbsG: 13.8,
      fatG: 0.2,
      source: "USDA",
      confidence: "Yüksek",
    },
    {
      name: "Zeytinyağı",
      category: "Yağlar & Soslar",
      calories: 884,
      proteinG: 0.0,
      carbsG: 0.0,
      fatG: 100.0,
      source: "USDA",
      confidence: "Yüksek",
    },
    {
      name: "Ton Balığı (süzülmüş, su bazlı)",
      category: "Kasap & Balık",
      calories: 110,
      proteinG: 25.0,
      carbsG: 0.0,
      fatG: 0.8,
      source: "USDA",
      confidence: "Yüksek",
    },
    {
      name: "Kırmızı Mercimek (çiğ)",
      category: "Bakliyatlar",
      calories: 340,
      proteinG: 24.0,
      carbsG: 57.0,
      fatG: 1.2,
      source: "TÜRKOMP",
      confidence: "Yüksek",
    },
    {
      name: "Ceviz İçi",
      category: "Kuru Gıda & Tahıllar",
      calories: 654,
      proteinG: 15.2,
      carbsG: 13.7,
      fatG: 65.2,
      source: "USDA",
      confidence: "Yüksek",
    },
    {
      name: "Salatalık",
      category: "Manav (Sebze & Meyve)",
      calories: 15,
      proteinG: 0.7,
      carbsG: 3.6,
      fatG: 0.1,
      source: "USDA",
      confidence: "Yüksek",
    },
    {
      name: "Domates",
      category: "Manav (Sebze & Meyve)",
      calories: 18,
      proteinG: 0.9,
      carbsG: 3.9,
      fatG: 0.2,
      source: "USDA",
      confidence: "Yüksek",
    },
  ];

  const createdFoods: Record<string, string> = {};
  for (const item of foods) {
    const existing = await prisma.foodItem.findFirst({
      where: { name: item.name },
    });
    if (!existing) {
      const created = await prisma.foodItem.create({
        data: { ...item, basisGrams: 100 },
      });
      createdFoods[item.name] = created.id;
    } else {
      createdFoods[item.name] = existing.id;
    }
  }

  // 4. Örnek Başlangıç Tarifleri (2.080 kcal ve 165g protein dağılımı ile)
  // Kahvaltı: ~430 kcal, ~35g protein
  const existingBreakfast = await prisma.recipe.findFirst({
    where: { name: "Yulaflı Lorlu Fit Omlet" },
  });
  if (!existingBreakfast) {
    await prisma.recipe.create({
      data: {
        name: "Yulaflı Lorlu Fit Omlet",
        instructions:
          "2 tam yumurtayı çırpın, 100g lor peyniri ve 40g yulaf ezmesiyle karıştırıp hafif yağlanmış tavada pişirin.",
        prepMinutes: 10,
        servings: 1,
        tags: JSON.stringify(["kahvaltı", "yüksek protein"]),
        ingredients: {
          create: [
            { foodItemId: createdFoods["Yumurta (büyük boy, adet ~50g)"], grams: 100 },
            { foodItemId: createdFoods["Lor Peyniri (az yağlı)"], grams: 100 },
            { foodItemId: createdFoods["Yulaf Ezmesi"], grams: 40 },
            { foodItemId: createdFoods["Zeytinyağı"], grams: 5 },
          ],
        },
      },
    });
  }

  // Öğle: ~620 kcal, ~45g protein
  const existingLunch = await prisma.recipe.findFirst({
    where: { name: "Izgara Tavuklu Bulgur Pilavı" },
  });
  if (!existingLunch) {
    await prisma.recipe.create({
      data: {
        name: "Izgara Tavuklu Bulgur Pilavı",
        instructions:
          "150g tavuk göğsünü ızgarada pişirin. 70g çiğ bulguru haşlayıp pilav yapın. Yanında 100g yoğurt ile servis edin.",
        prepMinutes: 20,
        servings: 1,
        tags: JSON.stringify(["öğle", "dengeli"]),
        ingredients: {
          create: [
            { foodItemId: createdFoods["Tavuk Göğsü (çiğ)"], grams: 150 },
            { foodItemId: createdFoods["Pilavlık Bulgur (çiğ)"], grams: 70 },
            { foodItemId: createdFoods["Yoğurt (%1.5 az yağlı)"], grams: 100 },
            { foodItemId: createdFoods["Zeytinyağı"], grams: 5 },
          ],
        },
      },
    });
  }

  // İş Çıkışı Ara Öğünü: ~280 kcal, ~20g protein
  const existingSnack = await prisma.recipe.findFirst({
    where: { name: "Muzlu Yoğurt & Lor Kasesi" },
  });
  if (!existingSnack) {
    await prisma.recipe.create({
      data: {
        name: "Muzlu Yoğurt & Lor Kasesi",
        instructions:
          "İşe götürülebilir kapta: 150g yoğurt, 50g lor ve 1 orta boy muz (100g) karıştırılır.",
        prepMinutes: 5,
        servings: 1,
        tags: JSON.stringify(["ara öğün", "pratik"]),
        ingredients: {
          create: [
            { foodItemId: createdFoods["Yoğurt (%1.5 az yağlı)"], grams: 150 },
            { foodItemId: createdFoods["Lor Peyniri (az yağlı)"], grams: 50 },
            { foodItemId: createdFoods["Muz"], grams: 100 },
          ],
        },
      },
    });
  }

  // Akşam Yemeği: ~750 kcal, ~65g protein
  const existingDinner = await prisma.recipe.findFirst({
    where: { name: "Fırın Tavuk Göğsü & Patates" },
  });
  if (!existingDinner) {
    await prisma.recipe.create({
      data: {
        name: "Fırın Tavuk Göğsü & Patates",
        instructions:
          "220g tavuk göğsü ve 300g elma dilim patatesi zeytinyağı ve baharatlarla harmanlayıp fırında 200 derecede 30 dk pişirin.",
        prepMinutes: 35,
        servings: 1,
        tags: JSON.stringify(["akşam", "tok tutucu"]),
        ingredients: {
          create: [
            { foodItemId: createdFoods["Tavuk Göğsü (çiğ)"], grams: 220 },
            { foodItemId: createdFoods["Patates (çiğ)"], grams: 300 },
            { foodItemId: createdFoods["Yoğurt (%1.5 az yağlı)"], grams: 150 },
            { foodItemId: createdFoods["Zeytinyağı"], grams: 10 },
          ],
        },
      },
    });
  }

  // 5. Haftalık Antrenman Şablonları (3 Ağırlık + 2 Kolay Koşu + 2 Dinlenme)
  const templates = [
    {
      name: "Ağırlık A (Alt & Üst Vücut)",
      type: "strength",
      dayOfWeek: 1, // Pazartesi
      targetDurationMinutes: 40,
      notes: "İş çıkışı 19:40 başlangıç. Kontrollü tempo.",
      exercises: [
        { exerciseName: "Squat", targetSets: 3, repMin: 8, repMax: 10, restSeconds: 120, orderIndex: 1 },
        { exerciseName: "Bench Press", targetSets: 3, repMin: 8, repMax: 10, restSeconds: 90, orderIndex: 2 },
        { exerciseName: "Lat Pulldown", targetSets: 3, repMin: 10, repMax: 12, restSeconds: 90, orderIndex: 3 },
        { exerciseName: "Lateral Raise", targetSets: 3, repMin: 12, repMax: 15, restSeconds: 60, orderIndex: 4 },
        { exerciseName: "Crunch", targetSets: 3, repMin: 15, repMax: 20, restSeconds: 60, orderIndex: 5 },
      ],
    },
    {
      name: "Kolay Koşu (Konuşma Temposu)",
      type: "easy_run",
      dayOfWeek: 2, // Salı
      targetDurationMinutes: 30,
      notes: "Konuşabilecek tempoda, toparlanma odaklı 25-35 dakika koşu.",
      exercises: [],
    },
    {
      name: "Ağırlık B (Zincir & İtiş-Çekiş)",
      type: "strength",
      dayOfWeek: 3, // Çarşamba
      targetDurationMinutes: 40,
      notes: "Hafta ortası dengeli seans.",
      exercises: [
        { exerciseName: "Romanian Deadlift (RDL)", targetSets: 3, repMin: 8, repMax: 10, restSeconds: 120, orderIndex: 1 },
        { exerciseName: "Overhead Press", targetSets: 3, repMin: 8, repMax: 10, restSeconds: 90, orderIndex: 2 },
        { exerciseName: "Seated Cable Row", targetSets: 3, repMin: 10, repMax: 12, restSeconds: 90, orderIndex: 3 },
        { exerciseName: "Cable Pushdown", targetSets: 3, repMin: 10, repMax: 12, restSeconds: 60, orderIndex: 4 },
        { exerciseName: "Plank", targetSets: 3, repMin: 45, repMax: 60, restSeconds: 60, orderIndex: 5 },
      ],
    },
    {
      name: "Dinlenme & Hafif Yürüyüş",
      type: "rest",
      dayOfWeek: 4, // Perşembe
      targetDurationMinutes: 20,
      notes: "İsteğe bağlı hafif yürüyüş ve esneme. 7+ saat uykuya odaklan.",
      exercises: [],
    },
    {
      name: "Ağırlık C (Çekiş & Hacim)",
      type: "strength",
      dayOfWeek: 5, // Cuma
      targetDurationMinutes: 40,
      notes: "Hafta kapanışı, kontrollü efor.",
      exercises: [
        { exerciseName: "Barbell Row", targetSets: 3, repMin: 8, repMax: 10, restSeconds: 90, orderIndex: 1 },
        { exerciseName: "Dumbbell Chest Fly", targetSets: 3, repMin: 10, repMax: 12, restSeconds: 60, orderIndex: 2 },
        { exerciseName: "Tek bacak dambıllı RDL", targetSets: 3, repMin: 10, repMax: 12, restSeconds: 90, orderIndex: 3 },
        { exerciseName: "Face Pull", targetSets: 3, repMin: 12, repMax: 15, restSeconds: 60, orderIndex: 4 },
        { exerciseName: "Cable Curl", targetSets: 3, repMin: 10, repMax: 12, restSeconds: 60, orderIndex: 5 },
        { exerciseName: "Leg Raise", targetSets: 3, repMin: 12, repMax: 15, restSeconds: 60, orderIndex: 6 },
      ],
    },
    {
      name: "Kolay Koşu (Hafta Sonu)",
      type: "easy_run",
      dayOfWeek: 6, // Cumartesi
      targetDurationMinutes: 30,
      notes: "25-35 dakika sakin açık hava koşusu.",
      exercises: [],
    },
    {
      name: "Dinlenme & Haftalık Hazırlık",
      type: "rest",
      dayOfWeek: 7, // Pazar
      targetDurationMinutes: 0,
      notes: "Haftalık meal-prep ve toparlanma günü.",
      exercises: [],
    },
  ];

  for (const t of templates) {
    const existing = await prisma.workoutTemplate.findFirst({
      where: { name: t.name },
    });
    if (!existing) {
      await prisma.workoutTemplate.create({
        data: {
          name: t.name,
          type: t.type,
          dayOfWeek: t.dayOfWeek,
          targetDurationMinutes: t.targetDurationMinutes,
          notes: t.notes,
          exercises: {
            create: t.exercises,
          },
        },
      });
    }
  }

  console.log("✅ Başlangıç verileri başarıyla yüklendi!");
}

main()
  .catch((e) => {
    console.error("❌ Seed hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

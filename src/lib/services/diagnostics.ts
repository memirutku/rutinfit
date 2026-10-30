/**
 * B38: Sistem tanılama. Bütün tabloların kayıt sayısı (yeni tablo BACKUP_TABLES'a girince
 * kendiliğinden eklenir), tam yollar, iki yedek klasöründeki yedek sayısı, sürüm ve masaüstü
 * kabuğunun günlük dosyası.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../prisma";
import { getStoragePaths } from "../storage-paths";
import { BACKUP_TABLES, EXCLUDED_TABLES, delegateKey } from "./backup";
import { getAutoBackupSettings } from "./auto-backup";
import { desktopLogFile } from "./local-files";
import packageJson from "../../../package.json";
import { formatDecimalTr } from "../format";

export const TABLE_LABELS: Record<string, string> = {
  UserProfile: "Profil",
  FoodItem: "Besinler",
  FoodMeasure: "Besin ölçüleri",
  Recipe: "Tarifler",
  RecipeIngredient: "Tarif malzemeleri",
  MealPlan: "Yemek planı günleri",
  PlannedMeal: "Planlı öğünler",
  FoodLog: "Öğün kayıtları",
  DrinkLog: "İçecek kayıtları",
  SavedMeal: "Kayıtlı öğünler",
  SavedMealItem: "Kayıtlı öğün kalemleri",
  CustomExercise: "Özel hareketler",
  WorkoutTemplate: "Antrenman şablonları",
  WorkoutExercise: "Şablon hareketleri",
  WorkoutSession: "Antrenmanlar",
  SetLog: "Set kayıtları",
  CardioLog: "Kardiyo kayıtları",
  WeightLog: "Tartı kayıtları",
  BodyMeasurement: "Vücut ölçüleri",
  DailyWellbeing: "Günlük durum kayıtları",
  SupplementLog: "Takviye kayıtları",
  ShoppingListItem: "Alışveriş listesi",
  PantryItem: "Kiler ürünleri",
  AISettings: "Yapay zekâ ayarları",
  AIConversation: "Koç sohbetleri",
  UploadedFile: "Yüklenen dosyalar",
  ExtractedArtifact: "Dosyalardan çıkarılanlar",
  ActionDraft: "Koç önerileri (onay bekleyen)",
  AIMessage: "Koç mesajları",
  AuditEvent: "İşlem günlüğü",
  WeeklyCheckin: "Haftalık değerlendirmeler",
  Supplement: "Takviyeler",
  Reminder: "Hatırlatmalar",
  FastingSession: "Oruç kayıtları",
  HealthRecord: "Apple Sağlık kayıtları",
  OpenFoodFactsCache: "Paketli gıda önbelleği",
  AutoBackupSettings: "Otomatik yedek ayarı",
  ProgressPhoto: "İlerleme fotoğrafları",
};

/** Bir modelin okunur adı; listede yoksa "Tablo: Model". */
export const tableLabel = (model: string) => TABLE_LABELS[model] ?? `Tablo: ${model}`;

const countFiles = (dir: string | null, test: (name: string) => boolean): number => {
  if (!dir) return 0;
  try {
    return fs.readdirSync(/*turbopackIgnore: true*/ dir).filter(test).length;
  } catch {
    return 0;
  }
};

export async function buildDiagnostics() {
  // turbopackIgnore: kullanıcı veri klasörü; derleyici bu yolları izleyip pakete katmasın.
  const paths = getStoragePaths();
  let dbSizeBytes = 0;
  let dbExists = false;
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ paths.dbPath)) {
      dbSizeBytes = fs.statSync(/*turbopackIgnore: true*/ paths.dbPath).size;
      dbExists = true;
    }
  } catch {
    // yok sayılır
  }

  const auto = await getAutoBackupSettings();
  const models = [...BACKUP_TABLES, ...EXCLUDED_TABLES] as string[];
  const counts = await Promise.all(models.map((m) => (prisma as unknown as Record<string, { count: () => Promise<number> }>)[delegateKey(m)].count()));
  const tables = models.map((model, i) => ({ model, label: tableLabel(model), count: counts[i] }));
  const countOf = (model: string) => tables.find((t) => t.model === model)?.count ?? 0;
  const logFile = desktopLogFile();
  const memory = process.memoryUsage();

  return {
    status: "healthy" as const,
    generatedAt: new Date().toISOString(),
    storage: {
      dataDir: paths.dataDir,
      dbPath: paths.dbPath,
      dbExists,
      dbSizeFormatted: `${formatDecimalTr(dbSizeBytes / (1024 * 1024), 2)} MB`,
      dbSizeBytes,
      backupsDir: paths.backupsDir,
      backupCount: countFiles(paths.backupsDir, (f) => f.endsWith(".db.bak") || f.endsWith(".json")),
      exportsDir: path.join(/*turbopackIgnore: true*/ paths.dataDir, "exports"),
      uploadsDir: paths.uploadsDir,
      autoBackupFolder: auto.folderPath,
      autoBackupCount: countFiles(auto.folderPath, (f) => f.startsWith("rutinfit-otomatik-yedek-") && f.endsWith(".json")),
      isCustomPath: paths.isCustomPath,
    },
    // Eski alanlar (geri uyumluluk): yeni ekranda `tables` kullanılır.
    counts: {
      foods: countOf("FoodItem"),
      foodLogs: countOf("FoodLog"),
      recipes: countOf("Recipe"),
      mealPlans: countOf("MealPlan"),
      workoutSessions: countOf("WorkoutSession"),
      setLogs: countOf("SetLog"),
      weightLogs: countOf("WeightLog"),
      wellbeings: countOf("DailyWellbeing"),
      pantryItems: countOf("PantryItem"),
      shoppingListItems: countOf("ShoppingListItem"),
      openFoodFactsCache: countOf("OpenFoodFactsCache"),
    },
    tables,
    system: {
      appVersion: packageJson.version,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptimeSeconds: Math.round(process.uptime()),
      memoryRssMb: Math.round(memory.rss / (1024 * 1024)),
      logFile,
      logFileExists: fs.existsSync(/*turbopackIgnore: true*/ logFile),
    },
  };
}

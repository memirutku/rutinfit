import fs from "fs";
import path from "path";
import os from "os";

export interface StoragePaths {
  dataDir: string;
  dbPath: string;
  backupsDir: string;
  uploadsDir: string;
  isCustomPath: boolean;
}

/**
 * İşletim sistemine uygun güvenli uygulama veri dizinlerini belirler.
 *
 * Buradaki yollar kullanıcı verisidir: `turbopackIgnore` yorumları derleyicinin dosya izleyicisinin
 * bu klasörleri (dev.db, yedekler, yüklemeler) takip edip standalone pakete katmasını engeller.
 * Yorum olmadan dinamik yollar "tüm projeyi izle" kalıbına dönüşür.
 * macOS: ~/Library/Application Support/RutinFit
 * Windows: %APPDATA%\RutinFit
 * Linux: ~/.local/share/rutinfit
 */
export function getStoragePaths(): StoragePaths {
  // Eğer RUTINFIT_DATA_DIR çevre değişkeni verilmişse (test veya özel kurulum)
  if (process.env.RUTINFIT_DATA_DIR) {
    const customDir = path.resolve(/*turbopackIgnore: true*/ process.env.RUTINFIT_DATA_DIR);
    ensureDir(customDir);
    const backupsDir = path.join(/*turbopackIgnore: true*/ customDir, "backups");
    const uploadsDir = path.join(/*turbopackIgnore: true*/ customDir, "uploads");
    ensureDir(backupsDir);
    ensureDir(uploadsDir);

    return {
      dataDir: customDir,
      dbPath: path.join(/*turbopackIgnore: true*/ customDir, "rutinfit.db"),
      backupsDir,
      uploadsDir,
      isCustomPath: true,
    };
  }

  // Testler yalnız kendilerine ayrılmış geçici klasörde çalışır (tests/setup/per-file-db.ts).
  // Bu koruma, testlerin geliştirici veya kullanıcı veritabanına yazmasını engeller.
  if (process.env.NODE_ENV === "test") {
    throw new Error(
      "[RutinFit Storage] Test ortamında RUTINFIT_DATA_DIR zorunludur; gerçek veritabanına yazılmaz."
    );
  }

  // Next.js dev ortamında isteğe bağlı proje içi dev.db
  if (process.env.RUTINFIT_LOCAL_DEV === "true") {
    const devDbPath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "prisma", "dev.db");
    const devBackupsDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "backups");
    const devUploadsDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "uploads");
    ensureDir(devBackupsDir);
    ensureDir(devUploadsDir);

    return {
      dataDir: path.resolve(/*turbopackIgnore: true*/ process.cwd(), "prisma"),
      dbPath: devDbPath,
      backupsDir: devBackupsDir,
      uploadsDir: devUploadsDir,
      isCustomPath: false,
    };
  }

  // OS Standart Konumu
  let baseDataDir: string;
  const platform = os.platform();

  if (platform === "darwin") {
    baseDataDir = path.join(/*turbopackIgnore: true*/ os.homedir(), "Library", "Application Support", "RutinFit");
  } else if (platform === "win32") {
    baseDataDir = path.join(
      /*turbopackIgnore: true*/ process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
      "RutinFit"
    );
  } else {
    baseDataDir = path.join(
      /*turbopackIgnore: true*/ process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"),
      "rutinfit"
    );
  }

  ensureDir(baseDataDir);
  const backupsDir = path.join(/*turbopackIgnore: true*/ baseDataDir, "backups");
  const uploadsDir = path.join(/*turbopackIgnore: true*/ baseDataDir, "uploads");
  ensureDir(backupsDir);
  ensureDir(uploadsDir);

  const targetDbPath = path.join(/*turbopackIgnore: true*/ baseDataDir, "rutinfit.db");

  // Eğer hedef veritabanı yoksa ve proje kökündeki dev.db mevcutsa, güvenli taşıma ve yedekleme yap
  const legacyDevDb = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "prisma", "dev.db");
  if (!fs.existsSync(/*turbopackIgnore: true*/ targetDbPath) && fs.existsSync(/*turbopackIgnore: true*/ legacyDevDb)) {
    try {
      fs.copyFileSync(/*turbopackIgnore: true*/ legacyDevDb, targetDbPath);
      // İlk taşıma yedeğini al
      const initialBackup = path.join(/*turbopackIgnore: true*/ backupsDir, `rutinfit_migrated_${Date.now()}.db.bak`);
      fs.copyFileSync(/*turbopackIgnore: true*/ legacyDevDb, initialBackup);
      console.log(`[RutinFit Storage] dev.db başarıyla taşındı -> ${targetDbPath}`);
    } catch (err) {
      console.error("[RutinFit Storage] Otomatik veritabanı taşıma hatası:", err);
    }
  }

  return {
    dataDir: baseDataDir,
    dbPath: targetDbPath,
    backupsDir,
    uploadsDir,
    isCustomPath: false,
  };
}

/**
 * Prisma için kullanılabilir SQLite bağlantı URL'sini döndürür.
 */
export function getPrismaDatabaseUrl(): string {
  // Tek doğruluk kaynağı getStoragePaths(); DATABASE_URL yalnız Prisma CLI içindir.
  const paths = getStoragePaths();
  return `file:${paths.dbPath}`;
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(/*turbopackIgnore: true*/ dirPath)) {
    fs.mkdirSync(/*turbopackIgnore: true*/ dirPath, { recursive: true });
  }
}

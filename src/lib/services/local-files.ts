/**
 * B36: Dosyayı Finder'da gösterme ve yerel klasör seçme penceresi.
 *
 * Komutlar kabuksuz (`execFile`, argüman dizisi) çalışır; kullanıcıdan gelen metin hiçbir zaman
 * komut ya da betik metnine eklenmez. Gösterilecek yol yalnız izinli köklerin içindeyse kabul
 * edilir: uygulama veri klasörü (yedekler, dışa aktarmalar, fotoğraflar), seçilen otomatik yedek
 * klasörü, İndirilenler ve masaüstü kabuğunun günlük klasörü. Sembolik bağlantılar çözülerek
 * denetlenir; `open -R` dosyayı açmaz, yalnız Finder'da seçili gösterir.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HttpError } from "../api-error";
import { getStoragePaths } from "../storage-paths";
import { getAutoBackupSettings } from "./auto-backup";

/** Masaüstü kabuğunun (Tauri) paket kimliği; günlük klasörü buna göre adlanır. */
const BUNDLE_ID = "com.rutinfit.desktop";
const REVEAL_TIMEOUT_MS = 10_000;
const PICK_TIMEOUT_MS = 5 * 60_000;

export const downloadsDir = () => path.join(os.homedir(), "Downloads");

/** Tauri günlük eklentisinin (LogDir, dosya adı "rutinfit") yazdığı dosya. */
export function desktopLogFile(platform: NodeJS.Platform = process.platform): string {
  const home = os.homedir();
  if (platform === "darwin") return path.join(home, "Library", "Logs", BUNDLE_ID, "rutinfit.log");
  if (platform === "win32") return path.join(process.env.LOCALAPPDATA || path.join(home, "AppData", "Local"), BUNDLE_ID, "logs", "rutinfit.log");
  return path.join(process.env.XDG_DATA_HOME || path.join(home, ".local", "share"), BUNDLE_ID, "logs", "rutinfit.log");
}

function run(cmd: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stderr: String(stderr ?? "") }));
      else resolve(String(stdout ?? ""));
    });
  });
}

const realOrNull = (p: string) => {
  try {
    return fs.realpathSync(/*turbopackIgnore: true*/ p);
  } catch {
    return null;
  }
};

const inside = (child: string, root: string) => {
  const rel = path.relative(root, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

export async function revealRoots(): Promise<string[]> {
  const paths = getStoragePaths();
  const auto = await getAutoBackupSettings().catch(() => null);
  const candidates = [paths.dataDir, paths.backupsDir, paths.uploadsDir, auto?.folderPath ?? null, downloadsDir(), path.dirname(desktopLogFile())];
  return [...new Set(candidates.filter((p): p is string => !!p).map(realOrNull).filter((p): p is string => !!p))];
}

export type RevealInput = { path: string } | { download: string };

/** Gösterilecek gerçek yolu bulur; izinli köklerin dışındaysa 403, yoksa 404. */
export async function resolveRevealTarget(input: RevealInput): Promise<string> {
  if ("download" in input) {
    const name = input.download;
    if (!name || name !== path.basename(name) || name === "." || name === ".." || /[\\/]/.test(name)) {
      throw new HttpError("Geçersiz dosya adı.", 400);
    }
    // İndirme başka ada düştüyse ya da silindiyse İndirilenler klasörü gösterilir.
    return realOrNull(path.join(downloadsDir(), name)) ?? realOrNull(downloadsDir()) ?? (() => {
      throw new HttpError("İndirilenler klasörü bulunamadı.", 404);
    })();
  }
  if (!path.isAbsolute(input.path)) throw new HttpError("Tam yol gerekli.", 400);
  const target = realOrNull(path.resolve(/*turbopackIgnore: true*/ input.path));
  if (!target) throw new HttpError("Dosya ya da klasör bulunamadı.", 404);
  const roots = await revealRoots();
  if (!roots.some((root) => inside(target, root))) {
    throw new HttpError("Yalnız uygulama, yedek ve İndirilenler klasörlerindeki dosyalar gösterilebilir.", 403);
  }
  return target;
}

/** Dosyayı (ya da klasörü) işletim sisteminin dosya yöneticisinde seçili gösterir. */
export async function revealInFileManager(target: string): Promise<void> {
  const platform = process.platform;
  try {
    if (platform === "darwin") await run("/usr/bin/open", ["-R", target], REVEAL_TIMEOUT_MS);
    else if (platform === "win32") await run("explorer.exe", [`/select,${target}`], REVEAL_TIMEOUT_MS);
    else await run("xdg-open", [fs.statSync(/*turbopackIgnore: true*/ target).isDirectory() ? target : path.dirname(target)], REVEAL_TIMEOUT_MS);
  } catch (error) {
    // Windows Gezgini başarıda da 1 ile çıkar.
    if (platform === "win32" && (error as { code?: number }).code === 1) return;
    console.error("[reveal]", error);
    throw new HttpError("Dosya Finder'da gösterilemedi.", 500);
  }
}

/**
 * macOS'un kendi klasör seçme penceresi (AppleScript `choose folder`). İstem ve başlangıç klasörü
 * betik metnine gömülmez; `on run argv` ile argüman olarak geçer. Vazgeçilirse null.
 */
const CHOOSE_FOLDER_SCRIPT = [
  "on run argv",
  "activate",
  "set promptText to item 1 of argv",
  "set startFolder to missing value",
  "try",
  "set startFolder to (POSIX file (item 2 of argv)) as alias",
  "end try",
  "if startFolder is missing value then",
  "return POSIX path of (choose folder with prompt promptText)",
  "end if",
  "return POSIX path of (choose folder with prompt promptText default location startFolder)",
  "end run",
];

let picking = false;

export async function chooseFolder(prompt: string, startFolder: string): Promise<string | null> {
  if (process.platform !== "darwin") {
    throw new HttpError("Klasör seçme penceresi yalnız macOS'ta açılır; klasör yolunu elle yaz.", 501);
  }
  if (picking) throw new HttpError("Klasör seçme penceresi zaten açık.", 409);
  picking = true;
  try {
    const args = CHOOSE_FOLDER_SCRIPT.flatMap((line) => ["-e", line]);
    const out = (await run("/usr/bin/osascript", [...args, "--", prompt, startFolder], PICK_TIMEOUT_MS)).trim();
    if (!out) return null;
    return out.length > 1 ? out.replace(/\/+$/, "") : out;
  } catch (error) {
    if (/-128/.test((error as { stderr?: string }).stderr ?? "")) return null; // Kullanıcı vazgeçti.
    console.error("[choose-folder]", error);
    throw new HttpError("Klasör seçme penceresi açılamadı; klasör yolunu elle yazabilirsin.", 500);
  } finally {
    picking = false;
  }
}

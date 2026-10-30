import fs from "node:fs";
import path from "node:path";
import { getStoragePaths } from "../storage-paths";

/**
 * Masaüstü görünümünde indirme engellense bile dosya kaybolmasın: uygulama klasöründeki
 * `exports` altına bir kopya yazılır. Yazılamazsa null döner (indirme yine çalışır).
 */
export function saveExportCopy(content: string | Buffer, fileName: string): string | null {
  try {
    // turbopackIgnore: kullanıcı veri klasörü; derleyici bu yolu izleyip pakete katmasın.
    const dir = path.join(/*turbopackIgnore: true*/ getStoragePaths().dataDir, "exports");
    fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
    const file = path.join(/*turbopackIgnore: true*/ dir, path.basename(fileName));
    fs.writeFileSync(file, content);
    return file;
  } catch (error) {
    console.error("Export local copy error:", error);
    return null;
  }
}

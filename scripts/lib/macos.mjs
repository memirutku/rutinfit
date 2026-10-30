/**
 * macOS imza yardımcıları (prepare-desktop, desktop-build, notarize-macos, verify-desktop ortak kullanır).
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Tek ve çok mimarili Mach-O başlıkları (her iki bayt sırası). */
const THIN_MAGICS = new Set([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe]);
const FAT_MAGICS = new Set([0xcafebabe, 0xcafebabf]);

/** Dosya bir Mach-O ikilisi mi (çalıştırılabilir, dylib, .node eklentisi)? Uzantıya değil içeriğe bakar. */
export function isMachO(file) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const head = Buffer.alloc(8);
    if (fs.readSync(fd, head, 0, 8, 0) < 8) return false;
    const magic = head.readUInt32BE(0);
    if (THIN_MAGICS.has(magic)) return true;
    // Java .class dosyaları da 0xcafebabe ile başlar; evrensel ikilide ardından küçük bir mimari sayısı gelir.
    if (FAT_MAGICS.has(magic)) {
      const archCount = head.readUInt32BE(4);
      return archCount > 0 && archCount < 20;
    }
    return false;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** Klasör altındaki tüm Mach-O dosyaları (sembolik linkler izlenmez). */
export function findMachO(dir) {
  const found = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && isMachO(full)) found.push(full);
    }
  };
  walk(dir);
  return found.sort();
}

/** Ad-hoc dışında gerçek bir imza kimliği mi? ("-" ad-hoc demektir.) */
export function isRealIdentity(identity) {
  return Boolean(identity && identity.trim() && identity.trim() !== "-");
}

/** Anahtar zincirinde kullanılabilir kod imzalama kimlikleri (yalnız ad + parmak izi; gizli değer içermez). */
export function codesigningIdentities() {
  const out = spawnSync("security", ["find-identity", "-v", "-p", "codesigning"], { encoding: "utf8" }).stdout || "";
  return [...out.matchAll(/^\s*\d+\)\s+([0-9A-F]{40})\s+"(.+)"$/gm)].map((m) => ({ hash: m[1], name: m[2] }));
}

/** `codesign -dvv` çıktısını alanlara ayırır. İmzasızsa { signed: false }. */
export function signatureInfo(file) {
  const res = spawnSync("codesign", ["-dvv", file], { encoding: "utf8" });
  const text = `${res.stdout || ""}${res.stderr || ""}`;
  if (res.status !== 0) return { signed: false, raw: text.trim() };
  const field = (name) => text.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() ?? null;
  const flags = text.match(/flags=0x[0-9a-f]+\(([^)]*)\)/)?.[1]?.split(",") ?? [];
  return {
    signed: true,
    adhoc: field("Signature") === "adhoc" || flags.includes("adhoc"),
    authority: field("Authority"),
    teamId: field("TeamIdentifier"),
    timestamp: field("Timestamp"),
    runtime: flags.includes("runtime"),
    flags,
    raw: text.trim(),
  };
}

/** İmzaya gömülü entitlements sözlüğü ({} = yok). */
export function entitlementsOf(file) {
  const xml = spawnSync("codesign", ["-d", "--entitlements", "-", "--xml", file], { encoding: "utf8" }).stdout || "";
  if (!xml.trim()) return {};
  const json = execFileSync("plutil", ["-convert", "json", "-o", "-", "-"], { input: xml, encoding: "utf8" });
  return JSON.parse(json);
}

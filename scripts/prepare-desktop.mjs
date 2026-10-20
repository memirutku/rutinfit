#!/usr/bin/env node
/**
 * Masaüstü paketi hazırlığı (tauri.conf.json → beforeBuildCommand, `next build` sonrası):
 *
 * 1. .next/standalone sunucusunu src-tauri/resources/server klasörüne kopyalar
 *    (statik dosyalar dahil, sembolik linkler çözülmüş).
 * 2. Pakette kullanıcı verisi veya gizli dosya OLMADIĞINI doğrular; varsa derlemeyi durdurur.
 * 3. Gömülü Node çalışma zamanını (sabit sürüm + sabit SHA-256) indirip
 *    src-tauri/binaries/node-<hedef> olarak yerleştirir (Tauri sidecar adlandırması).
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const standalone = path.join(root, ".next", "standalone");
const serverOut = path.join(root, "src-tauri", "resources", "server");
const binariesDir = path.join(root, "src-tauri", "binaries");

const NODE_VERSION = "22.23.3";
const NODE_SHA256 = {
  "aarch64-apple-darwin": { file: `node-v${NODE_VERSION}-darwin-arm64.tar.gz`, sha256: "23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53" },
  "x86_64-apple-darwin": { file: `node-v${NODE_VERSION}-darwin-x64.tar.gz`, sha256: "8a677b0219178efd6eb0e475457c4afb452b521a92f6e67845a73bd85727f2a8" },
};

/**
 * Standalone çıktının pakete alınabilecek üst düzey girdileri. Derleyicinin dosya izleyicisi
 * dinamik yollar yüzünden proje dosyalarını (notlar, yedekler, yüklemeler) standalone'a
 * katabilir; bu listede olmayan her şey atlanır ve doğrulamada hata sayılır.
 */
const ALLOWED_TOP_LEVEL = new Set(["server.js", "package.json", ".next", "node_modules", "prisma"]);
const ALLOWED_IN_PRISMA = new Set(["migrations"]);
/** prepare-desktop'ın kendisinin eklediği girdiler. */
const ADDED_TOP_LEVEL = new Set(["desktop-entry.cjs", "public"]);

function outsideAllowlist(rel) {
  const [top, second] = rel.split("/");
  if (!ALLOWED_TOP_LEVEL.has(top)) return true;
  return top === "prisma" && second !== undefined && !ALLOWED_IN_PRISMA.has(second);
}

/** Pakete asla girmemesi gereken yollar (kullanıcı verisi, gizli anahtarlar, ortam dosyaları). */
const FORBIDDEN = [
  { test: (rel) => /(^|\/)\.env(\.|$)/.test(rel), why: "ortam değişkeni dosyası" },
  { test: (rel) => /\.(db|db-journal|sqlite|bak)$/i.test(rel), why: "veritabanı/yedek" },
  { test: (rel) => /^(backups|uploads|opengym)(\/|$)/.test(rel), why: "kullanıcı veri klasörü" },
  { test: (rel) => /(^|\/)(secret|vapid\.json|.*\.pem)$/.test(rel), why: "gizli anahtar" },
];

function log(msg) {
  console.log(`[prepare-desktop] ${msg}`);
}

function hostTarget() {
  try {
    const out = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
    const m = out.match(/^host: (.+)$/m);
    if (m) return m[1].trim();
  } catch {
    // rustc yoksa işlemci mimarisinden çıkar
  }
  return os.arch() === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
}

function copyServer() {
  if (!fs.existsSync(path.join(standalone, "server.js"))) {
    throw new Error(".next/standalone bulunamadı. Önce `pnpm build` çalıştırın (next.config: output 'standalone').");
  }
  fs.rmSync(serverOut, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(serverOut), { recursive: true });

  const skipped = [];
  fs.cpSync(standalone, serverOut, {
    recursive: true,
    dereference: true,
    filter: (src) => {
      const rel = path.relative(standalone, src).split(path.sep).join("/");
      if (rel && outsideAllowlist(rel)) {
        skipped.push(`${rel} (izin listesi dışında)`);
        return false;
      }
      const hit = rel && FORBIDDEN.find((f) => f.test(rel));
      if (hit) skipped.push(`${rel} (${hit.why})`);
      return !hit;
    },
  });
  fs.cpSync(path.join(root, ".next", "static"), path.join(serverOut, ".next", "static"), { recursive: true });
  if (fs.existsSync(path.join(root, "public"))) {
    fs.cpSync(path.join(root, "public"), path.join(serverOut, "public"), { recursive: true });
  }
  fs.copyFileSync(path.join(root, "src-tauri", "desktop-entry.cjs"), path.join(serverOut, "desktop-entry.cjs"));
  if (skipped.length) log(`Pakete alınmadı: ${skipped.join(", ")}`);
}

function verifyServer() {
  const violations = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(serverOut, full).split(path.sep).join("/");
      if (entry.isSymbolicLink()) violations.push(`${rel} (sembolik link)`);
      const hit = FORBIDDEN.find((f) => f.test(rel));
      if (hit) violations.push(`${rel} (${hit.why})`);
      if (entry.isDirectory()) walk(full);
    }
  };
  walk(serverOut);
  for (const entry of fs.readdirSync(serverOut)) {
    if (!ALLOWED_TOP_LEVEL.has(entry) && !ADDED_TOP_LEVEL.has(entry)) violations.push(`${entry} (izin listesi dışında)`);
  }
  const prismaDir = path.join(serverOut, "prisma");
  for (const entry of fs.existsSync(prismaDir) ? fs.readdirSync(prismaDir) : []) {
    if (!ALLOWED_IN_PRISMA.has(entry)) violations.push(`prisma/${entry} (izin listesi dışında)`);
  }
  for (const required of ["server.js", "desktop-entry.cjs", ".next/static", "prisma/migrations/0001_init/migration.sql"]) {
    if (!fs.existsSync(path.join(serverOut, required))) violations.push(`${required} eksik`);
  }
  if (violations.length) {
    throw new Error(`Masaüstü paketi güvenli değil:\n  - ${violations.join("\n  - ")}`);
  }
  const engine = fs.readdirSync(path.join(serverOut, "node_modules", ".prisma", "client")).find((f) => f.startsWith("libquery_engine"));
  if (!engine) throw new Error("Prisma sorgu motoru pakette yok.");
  log(`Sunucu hazır: ${path.relative(root, serverOut)} (Prisma motoru: ${engine})`);
}

async function ensureNode() {
  const target = hostTarget();
  const spec = NODE_SHA256[target];
  if (!spec) throw new Error(`Desteklenmeyen hedef: ${target} (şimdilik yalnız macOS).`);
  const dest = path.join(binariesDir, `node-${target}`);
  const marker = `${dest}.version`;
  if (fs.existsSync(dest) && fs.existsSync(marker) && fs.readFileSync(marker, "utf8").trim() === NODE_VERSION) {
    log(`Node ${NODE_VERSION} zaten hazır (${path.relative(root, dest)})`);
    return;
  }

  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${spec.file}`;
  log(`İndiriliyor: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Node indirilemedi: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const actual = crypto.createHash("sha256").update(buf).digest("hex");
  if (actual !== spec.sha256) {
    throw new Error(`SHA-256 uyuşmuyor! beklenen ${spec.sha256}, gelen ${actual}. Dosya kullanılmadı.`);
  }
  log("SHA-256 doğrulandı.");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-node-"));
  try {
    const tarball = path.join(tmp, spec.file);
    fs.writeFileSync(tarball, buf);
    const member = `${spec.file.replace(/\.tar\.gz$/, "")}/bin/node`;
    execFileSync("tar", ["-xzf", tarball, "-C", tmp, member]);
    fs.mkdirSync(binariesDir, { recursive: true });
    fs.copyFileSync(path.join(tmp, member), dest);
    fs.chmodSync(dest, 0o755);
    fs.writeFileSync(marker, NODE_VERSION);
    log(`Node ${NODE_VERSION} yerleştirildi: ${path.relative(root, dest)}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

try {
  copyServer();
  verifyServer();
  await ensureNode();
} catch (err) {
  console.error(`[prepare-desktop] HATA: ${err.message}`);
  process.exit(1);
}

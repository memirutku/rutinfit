#!/usr/bin/env node
/**
 * Apple notarization + bilet zımbalama (stapling).
 *
 * Kullanım: node scripts/notarize-macos.mjs <RutinFit.app | RutinFit_*.dmg> [...]
 *   .dmg doğrudan gönderilir; .app önce ditto ile zip'lenir. Kabul edilince bilet dosyaya zımbalanır,
 *   böylece Gatekeeper ilk açılışta internete çıkmadan doğrular.
 *
 * Kimlik bilgisi (ilk bulunan kullanılır; değerler asla yazdırılmaz):
 *   1. NOTARYTOOL_PROFILE=<ad>  → `xcrun notarytool store-credentials <ad>` ile anahtar zincirine
 *      kaydedilmiş profil. Yerel makine için önerilir: parola hiçbir dosyaya veya kabuk geçmişine düşmez.
 *   2. APPLE_API_KEY + APPLE_API_ISSUER [+ APPLE_API_KEY_PATH] → App Store Connect API anahtarı (.p8).
 *      Yol verilmezse Tauri'nin baktığı yerlerde AuthKey_<id>.p8 aranır. CI için önerilir.
 *   3. APPLE_ID + APPLE_PASSWORD (uygulamaya özel parola) + APPLE_TEAM_ID.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function log(msg) {
  console.log(`[notarize] ${msg}`);
}

function fail(msg) {
  console.error(`[notarize] HATA: ${msg}`);
  process.exit(1);
}

function env(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function findApiKey(keyId) {
  const name = `AuthKey_${keyId}.p8`;
  const dirs = [path.resolve("private_keys"), path.join(os.homedir(), "private_keys"), path.join(os.homedir(), ".private_keys"), path.join(os.homedir(), ".appstoreconnect", "private_keys")];
  return dirs.map((d) => path.join(d, name)).find((p) => fs.existsSync(p)) ?? null;
}

function credentials() {
  const profile = env("NOTARYTOOL_PROFILE");
  if (profile) return { label: `anahtar zinciri profili "${profile}"`, args: ["--keychain-profile", profile] };

  const keyId = env("APPLE_API_KEY");
  const issuer = env("APPLE_API_ISSUER");
  if (keyId && issuer) {
    const keyPath = env("APPLE_API_KEY_PATH") ?? findApiKey(keyId);
    if (!keyPath || !fs.existsSync(keyPath)) fail(`AuthKey_${keyId}.p8 bulunamadı; APPLE_API_KEY_PATH verin.`);
    return { label: "App Store Connect API anahtarı", args: ["--key", keyPath, "--key-id", keyId, "--issuer", issuer] };
  }

  const appleId = env("APPLE_ID");
  const password = env("APPLE_PASSWORD");
  const teamId = env("APPLE_TEAM_ID");
  if (appleId && password && teamId) {
    return { label: "Apple ID + uygulamaya özel parola", args: ["--apple-id", appleId, "--password", password, "--team-id", teamId] };
  }
  if (appleId && password) fail("APPLE_TEAM_ID eksik.");
  fail("Notarization bilgisi yok: NOTARYTOOL_PROFILE, APPLE_API_KEY + APPLE_API_ISSUER veya APPLE_ID + APPLE_PASSWORD + APPLE_TEAM_ID verin.");
}

function notarize(target, auth) {
  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) fail(`${target} yok.`);
  const isApp = abs.endsWith(".app");
  if (!isApp && !abs.endsWith(".dmg")) fail(`Desteklenmeyen tür: ${target} (.app veya .dmg)`);

  let upload = abs;
  let tmp = null;
  if (isApp) {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-notarize-"));
    upload = path.join(tmp, `${path.basename(abs, ".app")}.zip`);
    execFileSync("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", abs, upload]);
  }

  try {
    log(`Gönderiliyor: ${path.basename(abs)} (${auth.label}); Apple'ın yanıtı birkaç dakika sürebilir…`);
    const res = spawnSync("xcrun", ["notarytool", "submit", upload, ...auth.args, "--wait", "--timeout", "45m", "--output-format", "json"], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    let result = {};
    try {
      result = JSON.parse(res.stdout);
    } catch {
      fail(`notarytool yanıtı okunamadı (çıkış ${res.status}): ${(res.stderr || res.stdout || "").trim()}`);
    }
    log(`Gönderim ${result.id ?? "?"}: ${result.status ?? "bilinmiyor"}`);
    if (result.status !== "Accepted") {
      if (result.id) {
        const details = spawnSync("xcrun", ["notarytool", "log", result.id, ...auth.args], { encoding: "utf8" });
        console.error(details.stdout || details.stderr);
      }
      fail(`${path.basename(abs)} notarization'dan geçmedi (${result.status ?? res.stderr?.trim()}).`);
    }
  } finally {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }

  execFileSync("xcrun", ["stapler", "staple", abs], { stdio: "inherit" });
  execFileSync("xcrun", ["stapler", "validate", abs], { stdio: "inherit" });
  log(`Notarize edildi ve zımbalandı: ${path.basename(abs)}`);
}

if (process.platform !== "darwin") fail("Notarization yalnız macOS'ta çalışır.");
const targets = process.argv.slice(2);
if (!targets.length) fail("Kullanım: node scripts/notarize-macos.mjs <RutinFit.app | RutinFit_*.dmg> [...]");
const auth = credentials();
for (const target of targets) notarize(target, auth);

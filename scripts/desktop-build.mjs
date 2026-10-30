#!/usr/bin/env node
/**
 * `pnpm desktop:build`: Tauri masaüstü paketini üretir (macOS: .app + .dmg).
 *
 * macOS'ta iki kip vardır:
 *  - Dağıtım: APPLE_SIGNING_IDENTITY="Developer ID Application: Ad (TAKIMID)" verilmişse Developer ID imzası,
 *    hardened runtime ve src-tauri/entitlements.plist kullanılır. Notarization bilgisi de verilmişse
 *    (APPLE_API_KEY + APPLE_API_ISSUER [+ APPLE_API_KEY_PATH] ya da APPLE_ID + APPLE_PASSWORD + APPLE_TEAM_ID)
 *    Tauri .app'i notarize edip bileti zımbalar. .dmg'nin kendisi için: node scripts/notarize-macos.mjs
 *  - Yerel: kimlik yoksa ad-hoc imza ve hardened runtime KAPALI. Paket yalnız derlendiği Mac'te açılır,
 *    Gatekeeper'dan geçmez. (Ad-hoc imza + hardened runtime altında kütüphane doğrulaması Prisma motorunu
 *    yükletmez: "mapping process and mapped file (non-platform) have different Team IDs" — ölçüldü.)
 *
 * Ek argümanlar `tauri build`e aktarılır, ör. `pnpm desktop:build --bundles app`.
 * Ayrıntı: docs/RELEASING.md
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { codesigningIdentities, isRealIdentity } from "./lib/macos.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const APPLE_ENV = [
  "APPLE_SIGNING_IDENTITY",
  "APPLE_CERTIFICATE",
  "APPLE_CERTIFICATE_PASSWORD",
  "APPLE_ID",
  "APPLE_PASSWORD",
  "APPLE_TEAM_ID",
  "APPLE_API_KEY",
  "APPLE_API_ISSUER",
  "APPLE_API_KEY_PATH",
];

function log(msg) {
  console.log(`[desktop-build] ${msg}`);
}

function fail(msg) {
  console.error(`[desktop-build] HATA: ${msg}`);
  process.exit(1);
}

// GitHub Actions'ta tanımlanmamış sır boş dize olarak gelir. Tauri boş değişkeni "verilmiş" sayar ve
// notarization'ı boş kimlik bilgisiyle dener; boşları hiç verilmemiş gibi kaldırıyoruz.
for (const key of APPLE_ENV) {
  if (process.env[key] !== undefined && process.env[key].trim() === "") delete process.env[key];
}

const args = ["build", "--ci", ...process.argv.slice(2)];

if (process.platform === "darwin") {
  const identity = process.env.APPLE_SIGNING_IDENTITY;
  if (isRealIdentity(identity)) {
    const wanted = identity.trim();
    const match = codesigningIdentities().find((id) => id.name.includes(wanted) || id.hash === wanted.toUpperCase());
    if (!match) {
      fail(
        `"${wanted}" kimliği anahtar zincirinde yok. Native modüller Tauri'den ÖNCE imzalandığı için sertifika ` +
          "derlemeden önce anahtar zincirinde olmalı (APPLE_CERTIFICATE ile Tauri'nin içe aktarması yetmez). " +
          "Kontrol: security find-identity -v -p codesigning"
      );
    }
    if (!match.name.startsWith("Developer ID Application:")) {
      log(`UYARI: "${match.name}" bir Developer ID Application kimliği değil; paket notarize edilemez.`);
    }
    // Sertifika zaten anahtar zincirinde; Tauri'nin ikinci bir geçici zincire tekrar içe aktarmasına gerek yok.
    delete process.env.APPLE_CERTIFICATE;
    delete process.env.APPLE_CERTIFICATE_PASSWORD;

    const env = process.env;
    const notarization =
      env.APPLE_API_KEY && env.APPLE_API_ISSUER
        ? "App Store Connect API anahtarı"
        : env.APPLE_ID && env.APPLE_PASSWORD && env.APPLE_TEAM_ID
          ? "Apple ID + uygulamaya özel parola"
          : null;
    log(`Dağıtım kipi: ${match.name} · hardened runtime · src-tauri/entitlements.plist`);
    log(
      notarization
        ? `.app notarization: ${notarization} (Tauri notarize edip zımbalar)`
        : ".app notarization bilgisi yok: paket imzalı ama notarize edilmemiş olacak (bkz. scripts/notarize-macos.mjs)."
    );
  } else {
    // Ad-hoc paket notarize edilemez; APPLE_CERTIFICATE ise native modüller imzalanmadan kabuğu imzalatırdı.
    const ignored = APPLE_ENV.filter((key) => key !== "APPLE_SIGNING_IDENTITY" && process.env[key] !== undefined);
    for (const key of ignored) delete process.env[key];
    if (ignored.length) log(`Yerel kipte yok sayıldı: ${ignored.join(", ")}`);
    log("Yerel kip: APPLE_SIGNING_IDENTITY yok → ad-hoc imza, hardened runtime kapalı (yalnız bu Mac'te açılır).");
    args.push("--config", JSON.stringify({ bundle: { macOS: { signingIdentity: "-", hardenedRuntime: false } } }));
  }
}

const tauri = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "tauri.cmd" : "tauri");
const res = spawnSync(tauri, args, { stdio: "inherit", cwd: root, shell: process.platform === "win32" });
if (res.error) fail(res.error.message);
process.exit(res.status ?? 1);

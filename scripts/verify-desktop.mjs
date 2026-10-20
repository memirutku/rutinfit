#!/usr/bin/env node
/**
 * macOS masaüstü paketini doğrular: imza zinciri, hardened runtime, entitlements, Gatekeeper ve
 * paketlenmiş sunucunun gerçekten açıldığı bir duman testi.
 *
 * Kullanım: node scripts/verify-desktop.mjs [--app <RutinFit.app>] [--dmg <RutinFit_*.dmg>] [--distribution] [--no-smoke]
 *   Varsayılan yollar: src-tauri/target/release/bundle/{macos/RutinFit.app, dmg/*.dmg}
 *   .dmg varsa içindeki .app salt okunur bağlanıp denetlenir (kullanıcıya giden kopya odur).
 *   --distribution: Developer ID + notarization zorunlu (spctl kabul etmeli, .dmg zımbalı olmalı).
 *   Ad-hoc yerel pakette yalnız imza bütünlüğü ve duman testi koşar.
 *
 * Duman testi kullanıcı verisine dokunmaz: RUTINFIT_DATA_DIR geçici bir klasördür.
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { entitlementsOf, findMachO, signatureInfo } from "./lib/macos.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const bundleDir = path.join(root, "src-tauri", "target", "release", "bundle");

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const distribution = argv.includes("--distribution");
const smoke = !argv.includes("--no-smoke");

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => {
  failures += 1;
  console.log(`  ✗ ${msg}`);
};
const warn = (msg) => console.log(`  ! ${msg}`);
const check = (cond, okMsg, badMsg = okMsg) => (cond ? ok(okMsg) : bad(badMsg));

function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: "utf8" });
  return { code: res.status, out: `${res.stdout || ""}${res.stderr || ""}`.trim() };
}

function defaultDmg() {
  const dir = path.join(bundleDir, "dmg");
  if (!fs.existsSync(dir)) return null;
  const dmgs = fs.readdirSync(dir).filter((f) => f.endsWith(".dmg"));
  if (dmgs.length > 1) throw new Error(`Birden çok .dmg var (${dmgs.join(", ")}); --dmg ile seçin.`);
  return dmgs.length ? path.join(dir, dmgs[0]) : null;
}

// ------------------------------------------------------------------ imza

function verifyApp(app) {
  console.log(`\n▸ ${app}`);
  const deep = run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);
  check(deep.code === 0, "codesign --verify --deep --strict temiz", `codesign --verify --deep --strict: ${deep.out}`);

  const main = signatureInfo(app);
  if (!main.signed) return bad(`paket imzasız: ${main.raw}`);
  const developerId = !main.adhoc;
  console.log(`    imza: ${developerId ? `${main.authority} · takım ${main.teamId}` : "ad-hoc (yalnız bu Mac)"}`);
  if (distribution) {
    check(developerId && main.authority?.startsWith("Developer ID Application:"), "Developer ID Application imzası", "dağıtım için Developer ID imzası gerekli");
  }
  if (developerId) {
    check(main.runtime, "paket hardened runtime ile imzalı", "paket hardened runtime'sız imzalı");
    check(Boolean(main.timestamp), `güvenli zaman damgası (${main.timestamp})`, "paket imzasında zaman damgası yok");
  }

  const machO = findMachO(path.join(app, "Contents"));
  const rel = (f) => path.relative(path.join(app, "Contents"), f);
  for (const file of machO) {
    const info = signatureInfo(file);
    const problems = [];
    if (!info.signed) problems.push("imzasız");
    else if (developerId) {
      if (info.adhoc) problems.push("ad-hoc");
      if (info.teamId !== main.teamId) problems.push(`takım ${info.teamId ?? "yok"} ≠ ${main.teamId}`);
      if (!info.runtime) problems.push("hardened runtime yok");
      if (!info.timestamp) problems.push("zaman damgası yok");
    }
    const strict = run("codesign", ["--verify", "--strict", file]);
    if (strict.code !== 0) problems.push(strict.out);
    check(!problems.length, `${rel(file)}`, `${rel(file)}: ${problems.join("; ")}`);
  }

  const node = path.join(app, "Contents", "MacOS", "node");
  check(fs.existsSync(node), "gömülü Node mevcut (Contents/MacOS/node)");
  for (const exe of machO.filter((f) => path.dirname(f) === path.join(app, "Contents", "MacOS"))) {
    const ent = entitlementsOf(exe);
    const keys = Object.keys(ent).filter((k) => ent[k] === true);
    console.log(`    ${path.basename(exe)} entitlements: ${keys.length ? keys.join(", ") : "yok"}`);
    if (developerId) {
      check(!ent["com.apple.security.get-task-allow"], `${path.basename(exe)}: get-task-allow yok`, `${path.basename(exe)}: get-task-allow notarization'ı reddettirir`);
    }
    if (distribution) {
      for (const risky of ["com.apple.security.cs.disable-library-validation", "com.apple.security.cs.allow-dyld-environment-variables"]) {
        check(!ent[risky], `${path.basename(exe)}: ${risky.split(".").pop()} yok`, `${path.basename(exe)}: gereksiz gevşetme ${risky}`);
      }
    }
  }
  const nodeInfo = fs.existsSync(node) ? signatureInfo(node) : null;
  if (nodeInfo?.runtime) {
    check(entitlementsOf(node)["com.apple.security.cs.allow-jit"] === true, "Node: allow-jit (V8 JIT için gerekli)", "Node hardened runtime altında allow-jit olmadan açılmaz");
  }

  if (distribution) {
    const gk = run("spctl", ["--assess", "--type", "execute", "-vv", app]);
    check(gk.code === 0 && /source=Notarized Developer ID/.test(gk.out), "Gatekeeper (spctl): accepted · Notarized Developer ID", `Gatekeeper reddetti: ${gk.out}`);
    const staple = run("xcrun", ["stapler", "validate", app]);
    if (staple.code === 0) ok(".app bileti zımbalı");
    else warn(".app'e bilet zımbalanmamış (çevrimiçi doğrulanır; .dmg zımbalıysa yeterli)");
  }
  return node;
}

function verifyDmg(dmg) {
  console.log(`\n▸ ${dmg}`);
  const info = signatureInfo(dmg);
  if (distribution) {
    check(info.signed && !info.adhoc, `.dmg imzalı (${info.authority ?? "?"})`, ".dmg Developer ID ile imzalı değil");
    const strict = run("codesign", ["--verify", "--strict", dmg]);
    check(strict.code === 0, ".dmg imzası geçerli", `.dmg imzası: ${strict.out}`);
    const gk = run("spctl", ["--assess", "--type", "open", "--context", "context:primary-signature", "-vv", dmg]);
    check(gk.code === 0 && /source=Notarized Developer ID/.test(gk.out), "Gatekeeper (.dmg): accepted · Notarized Developer ID", `Gatekeeper .dmg'yi reddetti: ${gk.out}`);
    const staple = run("xcrun", ["stapler", "validate", dmg]);
    check(staple.code === 0, ".dmg bileti zımbalı", `.dmg zımbalı değil: ${staple.out}`);
  } else {
    console.log(`    imza: ${info.signed ? (info.adhoc ? "ad-hoc" : info.authority) : "imzasız (yerel paket)"}`);
  }
}

// ------------------------------------------------------------------ duman testi

const PROBE = `
const path = require("node:path");
const server = process.argv[1];
(async () => {
  let s = 0; for (let i = 0; i < 3e7; i++) s += i % 7;
  const wasm = new Uint8Array([0,97,115,109,1,0,0,0,1,7,1,96,2,127,127,1,127,3,2,1,0,7,7,1,3,97,100,100,0,0,10,9,1,7,0,32,0,32,1,106,11]);
  const { instance } = await WebAssembly.instantiate(wasm);
  if (instance.exports.add(2, 3) !== 5) throw new Error("WebAssembly");
  const { PrismaClient } = require(path.join(server, "node_modules/@prisma/client"));
  const db = new PrismaClient({ datasourceUrl: "file:" + path.join(process.env.PROBE_DIR, "probe.db") });
  await db.$queryRawUnsafe("SELECT 1");
  await db.$disconnect();
  const sharp = require(path.join(server, "node_modules/sharp"));
  await sharp({ create: { width: 2, height: 2, channels: 3, background: "#000" } }).png().toBuffer();
  console.log("PROBE_OK " + process.arch);
})().catch((e) => { console.log("PROBE_FAIL " + e.message); process.exit(2); });
`;

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function smokeTest(app) {
  const hardened = signatureInfo(path.join(app, "Contents", "MacOS", "node")).runtime;
  console.log("\n▸ Duman testi (gömülü Node + paketlenmiş sunucu, geçici veri klasörü)");
  const node = path.join(app, "Contents", "MacOS", "node");
  const serverDir = path.join(app, "Contents", "Resources", "server");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-smoke-"));
  const env = { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", RUTINFIT_DATA_DIR: path.join(tmp, "data"), OPENGYM_DATA_DIR: path.join(tmp, "opengym") };
  delete env.DATABASE_URL;
  delete env.RUTINFIT_LOCAL_DEV;
  let server = null;
  try {
    const probe = spawnSync(node, ["-e", PROBE, serverDir], { encoding: "utf8", env: { ...env, PROBE_DIR: tmp }, timeout: 120_000 });
    const probeOut = `${probe.stdout || ""}${probe.stderr || ""}`.trim();
    check(
      probe.status === 0 && probeOut.includes("PROBE_OK"),
      `JIT · WebAssembly · Prisma motoru · sharp çalışıyor (${probeOut.match(/PROBE_OK (\w+)/)?.[1] ?? "?"}, hardened runtime ${hardened ? "açık" : "kapalı"})`,
      `Node yoklaması başarısız (çıkış ${probe.status ?? probe.signal}): ${probeOut.slice(0, 500) || "çıktı yok (büyük olasılıkla entitlement eksik)"}`
    );

    const port = await freePort();
    const nonce = crypto.randomBytes(16).toString("hex");
    const token = crypto.randomBytes(24).toString("hex");
    let logs = "";
    server = spawn(node, [path.join(serverDir, "desktop-entry.cjs")], {
      cwd: serverDir,
      env: { ...env, PORT: String(port), HOSTNAME: "127.0.0.1", RUTINFIT_INSTANCE_NONCE: nonce, RUTINFIT_LAUNCH_TOKEN: token },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (d) => (logs += d));
    server.stderr.on("data", (d) => (logs += d));

    const base = `http://127.0.0.1:${port}`;
    let healthy = false;
    const alive = () => server.exitCode === null && server.signalCode === null;
    for (let i = 0; i < 120 && alive() && !healthy; i++) {
      try {
        const res = await fetch(`${base}/api/health`);
        healthy = res.ok && (await res.json()).nonce === nonce;
      } catch {
        // sunucu henüz dinlemiyor
      }
      if (!healthy) await new Promise((r) => setTimeout(r, 500));
    }
    check(healthy, "sunucu açıldı, /api/health bu örneğin nonce'unu döndürdü", `sunucu sağlıklı açılmadı (çıkış ${server.exitCode}): ${logs.slice(-800)}`);

    if (healthy) {
      const boot = await fetch(`${base}/?launch=${token}`, { redirect: "manual" });
      const cookie = boot.headers.get("set-cookie")?.split(";")[0];
      const page = cookie ? await fetch(new URL(boot.headers.get("location") || "/", base), { headers: { cookie } }) : null;
      check(page?.status === 200, "açılış anahtarı → çerez → ana sayfa 200 (veritabanı migration'ları uygulandı)", `ana sayfa açılmadı (açılış ${boot.status}, sayfa ${page?.status ?? "-"}): ${logs.slice(-800)}`);
      check(fs.existsSync(path.join(env.RUTINFIT_DATA_DIR, "rutinfit.db")), "veritabanı yalnız geçici klasörde oluştu");
    }
    if (/EROFS|read-only file system/i.test(logs)) warn(`sunucu salt okunur paket içine yazmaya çalıştı: ${logs.match(/.*(EROFS|read-only file system).*/i)?.[0]}`);
  } finally {
    if (server && server.exitCode === null && server.signalCode === null) {
      const exited = new Promise((r) => server.once("exit", r));
      server.kill("SIGTERM");
      await exited;
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ akış

if (process.platform !== "darwin") {
  console.error("verify-desktop yalnız macOS paketini denetler.");
  process.exit(1);
}

const dmg = opt("--dmg") ?? defaultDmg();
let app = opt("--app") ?? (dmg ? null : path.join(bundleDir, "macos", "RutinFit.app"));
let mount = null;

try {
  if (dmg) {
    verifyDmg(dmg);
    mount = fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-dmg-"));
    execFileSync("hdiutil", ["attach", dmg, "-readonly", "-nobrowse", "-noautoopen", "-mountpoint", mount], { stdio: "ignore" });
    const inside = fs.readdirSync(mount).find((f) => f.endsWith(".app"));
    if (!inside) throw new Error(".dmg içinde .app yok");
    app = path.join(mount, inside);
  }
  if (!app || !fs.existsSync(app)) throw new Error(`Paket bulunamadı: ${app}. Önce pnpm desktop:build çalıştırın.`);
  verifyApp(app);
  if (smoke) await smokeTest(app);
} catch (err) {
  bad(err.message);
} finally {
  if (mount) {
    // Bağlama noktası asla özyinelemeli silinmez: ayırma başarısızsa içindeki paket silinmesin.
    const detached = spawnSync("hdiutil", ["detach", mount, "-quiet"]).status === 0 || spawnSync("hdiutil", ["detach", mount, "-force", "-quiet"]).status === 0;
    if (detached) fs.rmdirSync(mount);
    else warn(`.dmg ayrılamadı: ${mount}`);
  }
}

console.log(failures ? `\n✗ ${failures} denetim başarısız.` : "\n✓ Tüm denetimler geçti.");
process.exit(failures ? 1 : 0);

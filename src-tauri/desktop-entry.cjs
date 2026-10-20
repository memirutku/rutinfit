// RutinFit masaüstü sunucu giriş noktası.
// Tauri kabuğu bu dosyayı gömülü Node ile başlatır (bkz. src-tauri/src/lib.rs).
"use strict";

const path = require("node:path");

const parentPid = Number(process.env.RUTINFIT_PARENT_PID || 0);

function parentAlive() {
  if (process.ppid === 1) return false; // launchd'ye devredildi: kabuk öldü
  if (!parentPid) return true;
  try {
    process.kill(parentPid, 0);
    return true;
  } catch {
    return false;
  }
}

// Kabuk çökerse veya zorla kapatılırsa sunucu sahipsiz kalmasın.
setInterval(() => {
  if (!parentAlive()) process.exit(0);
}, 2000).unref();

// İkinci güvence: kabuk ölünce stdin borusu kapanır.
if (process.env.RUTINFIT_WATCH_STDIN === "1") {
  process.stdin.on("end", () => process.exit(0));
  process.stdin.on("error", () => process.exit(0));
  process.stdin.resume();
}

process.chdir(__dirname);
process.env.NODE_ENV = "production";
process.env.RUTINFIT_MIGRATIONS_DIR = process.env.RUTINFIT_MIGRATIONS_DIR || path.join(__dirname, "prisma", "migrations");

require("./server.js");

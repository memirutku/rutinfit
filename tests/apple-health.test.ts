import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { parseAttributes, readAppleHealthExport } from "@/lib/apple-health";

/** Testler için en küçük zip yazıcı (yerel başlık + merkezi dizin + EOCD). */
function makeZip(files: Array<{ name: string; text: string; store?: boolean }>): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const raw = Buffer.from(f.text, "utf8");
    const data = f.store ? raw : zlib.deflateRawSync(raw);
    const name = Buffer.from(f.name, "utf8");
    const crc = zlib.crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(f.store ? 0 : 8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(f.store ? 0 : 8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, eocd]));
}

const rec = (type: string, source: string, start: string, value: number | string, unit: string) =>
  ` <Record type="HKQuantityTypeIdentifier${type}" sourceName="${source}" unit="${unit}" creationDate="${start}" startDate="${start}" endDate="${start}" value="${value}"/>`;

const XML = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<HealthData locale="tr_TR">`,
  // Aynı gün iki cihaz: telefon 3000 + 2000, saat 6200 → saatin toplamı alınır (çift sayım yok).
  rec("StepCount", "iPhone", "2026-10-01 08:00:00 +0300", 3000, "count"),
  rec("StepCount", "iPhone", "2026-10-01 18:00:00 +0300", 2000, "count"),
  rec("StepCount", "Ali&apos;s Apple Watch", "2026-10-01 08:00:00 +0300", 6200, "count"),
  rec("StepCount", "iPhone", "2026-10-02 09:00:00 +0300", 4000, "count"),
  rec("ActiveEnergyBurned", "Ali&apos;s Apple Watch", "2026-10-01 10:00:00 +0300", 418.4, "kJ"),
  rec("ActiveEnergyBurned", "Ali&apos;s Apple Watch", "2026-10-01 12:00:00 +0300", 250, "kcal"),
  rec("RestingHeartRate", "Ali&apos;s Apple Watch", "2026-10-01 07:00:00 +0300", 60, "count/min"),
  rec("RestingHeartRate", "Ali&apos;s Apple Watch", "2026-10-01 23:00:00 +0300", 63, "count/min"),
  rec("BodyMass", "Tartı", "2026-10-01 07:00:00 +0300", 220, "lb"),
  rec("BodyMass", "Tartı", "2026-10-01 21:00:00 +0300", 221, "lb"),
  rec("HeartRate", "Ali&apos;s Apple Watch", "2026-10-01 07:00:00 +0300", 72, "count/min"), // alınmaz
  ` <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-10-03 09:00:00 +0300" endDate="2026-10-03 09:10:00 +0300" value="500">`,
  `  <MetadataEntry key="HKWasUserEntered" value="1"/>`,
  ` </Record>`,
  // Eski biçim: toplamlar özniteliklerde.
  ` <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30.5" durationUnit="min" totalDistance="3.1" totalDistanceUnit="mi" totalEnergyBurned="320" totalEnergyBurnedUnit="kcal" sourceName="Ali&apos;s Apple Watch" startDate="2026-10-01 19:00:00 +0300" endDate="2026-10-01 19:30:30 +0300">`,
  ` </Workout>`,
  // Aynı antrenman başka kaynaktan: tek sayılır.
  ` <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30.5" durationUnit="min" sourceName="Strava" startDate="2026-10-01 19:00:00 +0300" endDate="2026-10-01 19:30:30 +0300"/>`,
  // Yeni biçim: toplamlar alt öğelerde.
  ` <Workout workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining" duration="3000" durationUnit="s" sourceName="Ali&apos;s Apple Watch" startDate="2026-10-02 18:00:00 +0300" endDate="2026-10-02 18:50:00 +0300">`,
  `  <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" startDate="x" endDate="y" sum="280" unit="kcal"/>`,
  ` </Workout>`,
  `</HealthData>`,
].join("\n");

describe("F62: Apple Sağlık dışa aktarımı", () => {
  it("öznitelikleri XML kaçışlarıyla çözer", () => {
    expect(parseAttributes(`<Record sourceName="Ali&apos;s &amp; &#252;" value="1"/>`)).toEqual({ sourceName: "Ali's & ü", value: "1" });
  });

  it("zip içindeki export.xml'i akışla okur; cihazlar arası çift sayımı önler; birimleri çevirir", async () => {
    const zip = makeZip([
      { name: "apple_health_export/export_cda.xml", text: "<ClinicalDocument/>" },
      { name: "apple_health_export/export.xml", text: XML },
    ]);
    const progress: number[] = [];
    const { records, stats } = await readAppleHealthExport(new Blob([zip as BlobPart]), (read) => progress.push(read));
    const byKey = Object.fromEntries(records.map((r) => [r.key, r]));

    expect(byKey["steps:2026-10-01"]).toMatchObject({ value: 6200, source: "Ali's Apple Watch", unit: "count" });
    expect(byKey["steps:2026-10-02"]).toMatchObject({ value: 4000, source: "iPhone" });
    expect(byKey["steps:2026-10-03"]).toMatchObject({ value: 500 });
    expect(byKey["active_kcal:2026-10-01"].value).toBe(350);
    expect(byKey["resting_hr:2026-10-01"].value).toBe(62);
    expect(byKey["weight_kg:2026-10-01"].value).toBeCloseTo(100.24, 2);

    const workouts = records.filter((r) => r.type === "workout");
    expect(workouts).toHaveLength(2);
    expect(workouts[0]).toMatchObject({ date: "2026-10-01", value: 30.5, unit: "min" });
    expect(workouts[0].detail).toEqual({ activity: "Koşu", durationMin: 30.5, distanceKm: 4.99, kcal: 320 });
    expect(workouts[1].detail).toEqual({ activity: "Ağırlık antrenmanı", durationMin: 50, distanceKm: null, kcal: 280 });

    expect(stats).toMatchObject({ skipped: 1 });
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]).toBe(zip.length);
  });

  it("sıkıştırılmamış zip ve doğrudan export.xml de okunur; tanınmayan dosya hata verir", async () => {
    const stored = await readAppleHealthExport(new Blob([makeZip([{ name: "export.xml", text: XML, store: true }]) as BlobPart]));
    expect(stored.records.find((r) => r.key === "steps:2026-10-01")?.value).toBe(6200);
    const plain = await readAppleHealthExport(new Blob([XML]));
    expect(plain.records).toHaveLength(stored.records.length);
    await expect(readAppleHealthExport(new Blob([makeZip([{ name: "notlar.txt", text: "x" }]) as BlobPart]))).rejects.toThrow(/export.xml/);
    await expect(readAppleHealthExport(new Blob(["merhaba"]))).rejects.toThrow(/Apple Sağlık/);
  });

});

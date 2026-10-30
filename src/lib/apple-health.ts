/**
 * F62: Apple Sağlık dışa aktarımı (export.zip ya da export.xml). Tarayıcıda çalışır:
 * zip'in sonundaki merkezi dizinden yalnız export.xml bulunur, sıkıştırılmış veri akışla açılır
 * ve satır satır okunur; dosya belleğe ya da sunucuya yüklenmez. Sunucuya yalnız günlük
 * özetler gider.
 *
 * Çift sayım önlemi: adım ve aktif enerji her gün için kaynak başına toplanır ve en yüksek
 * toplamı veren tek kaynak alınır (telefon ve saat aynı yürüyüşü ayrı ayrı sayar). Aynı başlangıç
 * ve türdeki antrenman bir kez sayılır. Kayıtlar kullanıcının kendi kilo ve kardiyo kayıtlarına
 * eklenmez; ayrı ve salt okunur durur.
 */

export const HEALTH_TYPES = ["steps", "active_kcal", "resting_hr", "weight_kg", "workout"] as const;
export type HealthType = (typeof HEALTH_TYPES)[number];

export interface WorkoutDetail {
  activity: string;
  durationMin: number;
  distanceKm: number | null;
  kcal: number | null;
}

export interface HealthRecordInput {
  key: string;
  type: HealthType;
  date: string;
  value: number;
  unit: string;
  source: string;
  detail?: WorkoutDetail | null;
}

const QUANTITY: Record<string, HealthType> = {
  HKQuantityTypeIdentifierStepCount: "steps",
  HKQuantityTypeIdentifierActiveEnergyBurned: "active_kcal",
  HKQuantityTypeIdentifierRestingHeartRate: "resting_hr",
  HKQuantityTypeIdentifierBodyMass: "weight_kg",
};

const ACTIVITY_TR: Record<string, string> = {
  Running: "Koşu",
  Walking: "Yürüyüş",
  Cycling: "Bisiklet",
  Swimming: "Yüzme",
  Hiking: "Doğa yürüyüşü",
  TraditionalStrengthTraining: "Ağırlık antrenmanı",
  FunctionalStrengthTraining: "Fonksiyonel kuvvet",
  HighIntensityIntervalTraining: "HIIT",
  Yoga: "Yoga",
  Pilates: "Pilates",
  Elliptical: "Eliptik",
  Rowing: "Kürek",
  StairClimbing: "Merdiven",
  Dance: "Dans",
  CoreTraining: "Karın/core",
  Soccer: "Futbol",
  Basketball: "Basketbol",
  Tennis: "Tenis",
  MixedCardio: "Karma kardiyo",
  Other: "Diğer",
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()]
  );

export function parseAttributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([A-Za-z_][\w.-]*)="([^"]*)"/g)) out[m[1]] = decode(m[2]);
  return out;
}

const num = (v: string | undefined) => {
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

function toKcal(v: number, unit: string | undefined) {
  return unit === "kJ" ? v / 4.184 : unit === "Cal" || unit === "kcal" || !unit ? v : null;
}
function toKg(v: number, unit: string | undefined) {
  return unit === "lb" ? v * 0.45359237 : unit === "g" ? v / 1000 : unit === "kg" || !unit ? v : null;
}
function toKm(v: number, unit: string | undefined) {
  return unit === "mi" ? v * 1.609344 : unit === "m" ? v / 1000 : unit === "km" || !unit ? v : null;
}
function toMin(v: number, unit: string | undefined) {
  return unit === "s" ? v / 60 : unit === "hr" || unit === "h" ? v * 60 : v;
}

interface OpenWorkout {
  start: string;
  activityKey: string;
  source: string;
  durationMin: number;
  distanceKm: number | null;
  kcal: number | null;
}

/** Satırları sırayla alır ve günlük özetleri çıkarır. */
export class HealthAggregator {
  private sums = new Map<string, number>(); // type|date|source → toplam
  private hr = new Map<string, { sum: number; n: number; source: string }>();
  private weight = new Map<string, { value: number; at: string; source: string }>();
  private workouts = new Map<string, HealthRecordInput>();
  private open: OpenWorkout | null = null;
  readonly stats = { lines: 0, records: 0, skipped: 0, workouts: 0 };

  push(rawLine: string) {
    this.stats.lines++;
    const line = rawLine.trim();
    if (line.startsWith("<Record ")) return this.record(parseAttributes(line));
    if (line.startsWith("<Workout ")) {
      this.closeWorkout();
      const a = parseAttributes(line);
      const activityKey = (a.workoutActivityType ?? "HKWorkoutActivityTypeOther").replace("HKWorkoutActivityType", "");
      const total = num(a.totalDistance);
      const energy = num(a.totalEnergyBurned);
      this.open = {
        start: a.startDate ?? "",
        activityKey,
        source: a.sourceName ?? "Apple Sağlık",
        durationMin: toMin(num(a.duration) ?? 0, a.durationUnit),
        distanceKm: total !== null ? toKm(total, a.totalDistanceUnit) : null,
        kcal: energy !== null ? toKcal(energy, a.totalEnergyBurnedUnit) : null,
      };
      if (line.endsWith("/>")) this.closeWorkout();
      return;
    }
    if (this.open && line.startsWith("<WorkoutStatistics ")) {
      const a = parseAttributes(line);
      const sum = num(a.sum);
      if (sum === null) return;
      if (/Distance/.test(a.type ?? "") && this.open.distanceKm === null) this.open.distanceKm = toKm(sum, a.unit);
      if (a.type === "HKQuantityTypeIdentifierActiveEnergyBurned" && this.open.kcal === null) this.open.kcal = toKcal(sum, a.unit);
      return;
    }
    if (line.startsWith("</Workout>")) this.closeWorkout();
  }

  private record(a: Record<string, string>) {
    const type = QUANTITY[a.type ?? ""];
    const value = num(a.value);
    const date = (a.startDate ?? "").slice(0, 10);
    if (!type || value === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      this.stats.skipped++;
      return;
    }
    this.stats.records++;
    const source = a.sourceName ?? "Apple Sağlık";
    if (type === "steps" || type === "active_kcal") {
      const v = type === "active_kcal" ? toKcal(value, a.unit) : value;
      if (v === null) return;
      const k = `${type}|${date}|${source}`;
      this.sums.set(k, (this.sums.get(k) ?? 0) + v);
    } else if (type === "resting_hr") {
      const cur = this.hr.get(date) ?? { sum: 0, n: 0, source };
      this.hr.set(date, { sum: cur.sum + value, n: cur.n + 1, source: cur.source });
    } else if (type === "weight_kg") {
      const kg = toKg(value, a.unit);
      const at = a.startDate ?? "";
      const cur = this.weight.get(date);
      if (kg !== null && (!cur || at >= cur.at)) this.weight.set(date, { value: kg, at, source });
    }
  }

  private closeWorkout() {
    const w = this.open;
    this.open = null;
    if (!w) return;
    const date = w.start.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(w.durationMin > 0)) return;
    const key = `workout:${w.start}:${w.activityKey}`;
    if (this.workouts.has(key)) return; // başka kaynaktan aynı antrenman
    this.stats.workouts++;
    const durationMin = r2(w.durationMin);
    this.workouts.set(key, {
      key,
      type: "workout",
      date,
      value: durationMin,
      unit: "min",
      source: w.source,
      detail: {
        activity: ACTIVITY_TR[w.activityKey] ?? w.activityKey,
        durationMin,
        distanceKm: w.distanceKm !== null ? r2(w.distanceKm) : null,
        kcal: w.kcal !== null ? Math.round(w.kcal) : null,
      },
    });
  }

  result(): HealthRecordInput[] {
    this.closeWorkout();
    const out: HealthRecordInput[] = [];
    // Gün başına en yüksek toplamı veren kaynak.
    const best = new Map<string, { value: number; source: string }>();
    for (const [k, v] of this.sums) {
      const [type, date, source] = k.split("|");
      const id = `${type}:${date}`;
      if (!best.has(id) || v > best.get(id)!.value) best.set(id, { value: v, source });
    }
    for (const [id, b] of best) {
      const [type, date] = id.split(":") as [HealthType, string];
      out.push({ key: id, type, date, value: Math.round(b.value), unit: type === "steps" ? "count" : "kcal", source: b.source });
    }
    for (const [date, h] of this.hr) out.push({ key: `resting_hr:${date}`, type: "resting_hr", date, value: Math.round(h.sum / h.n), unit: "bpm", source: h.source });
    for (const [date, w] of this.weight) out.push({ key: `weight_kg:${date}`, type: "weight_kg", date, value: r2(w.value), unit: "kg", source: w.source });
    out.push(...this.workouts.values());
    return out.sort((a, b) => (a.date === b.date ? a.key.localeCompare(b.key) : a.date.localeCompare(b.date)));
  }
}

/* ------------------------------------------------------------------ */
/* Zip okuma (yalnız gereken kayıt; dosya belleğe alınmaz)             */
/* ------------------------------------------------------------------ */

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

async function bytes(blob: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await blob.slice(start, end).arrayBuffer());
}

const u64 = (v: DataView, o: number) => Number(v.getBigUint64(o, true));

export async function listZipEntries(blob: Blob): Promise<ZipEntry[]> {
  const tailStart = Math.max(0, blob.size - (65535 + 22));
  const tail = await bytes(blob, tailStart, blob.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Zip dosyası okunamadı (merkezi dizin bulunamadı).");
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOffset = tail.getUint32(eocd + 16, true);
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    // Zip64: konumlayıcı EOCD'nin hemen önündedir.
    const loc = eocd - 20;
    if (loc < 0 || tail.getUint32(loc, true) !== 0x07064b50) throw new Error("Zip64 dizini okunamadı.");
    const z64Offset = u64(tail, loc + 8);
    const z64 = await bytes(blob, z64Offset, z64Offset + 56);
    cdSize = u64(z64, 40);
    cdOffset = u64(z64, 48);
  }
  const cd = await bytes(blob, cdOffset, cdOffset + cdSize);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();
  let p = 0;
  while (p + 46 <= cd.byteLength && cd.getUint32(p, true) === 0x02014b50) {
    const method = cd.getUint16(p + 10, true);
    let compressedSize = cd.getUint32(p + 20, true);
    let uncompressed = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    let localHeaderOffset = cd.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    // Zip64 ek alanı: yalnız 0xFFFFFFFF olan alanlar sırasıyla yer alır.
    let e = p + 46 + nameLen;
    const extraEnd = e + extraLen;
    while (e + 4 <= extraEnd) {
      const id = cd.getUint16(e, true);
      const size = cd.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (uncompressed === 0xffffffff) {
          uncompressed = u64(cd, q);
          q += 8;
        }
        if (compressedSize === 0xffffffff) {
          compressedSize = u64(cd, q);
          q += 8;
        }
        if (localHeaderOffset === 0xffffffff) localHeaderOffset = u64(cd, q);
      }
      e += 4 + size;
    }
    entries.push({ name, method, compressedSize, localHeaderOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function entryStream(blob: Blob, entry: ZipEntry, onBytes: (n: number) => void): Promise<ReadableStream<Uint8Array>> {
  const header = await bytes(blob, entry.localHeaderOffset, entry.localHeaderOffset + 30);
  if (header.getUint32(0, true) !== 0x04034b50) throw new Error("Zip kaydı bozuk.");
  const dataStart = entry.localHeaderOffset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
  const counted = blob
    .slice(dataStart, dataStart + entry.compressedSize)
    .stream()
    .pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctrl) {
          onBytes(chunk.byteLength);
          ctrl.enqueue(chunk);
        },
      })
    );
  if (entry.method === 0) return counted;
  if (entry.method === 8) return counted.pipeThrough(new DecompressionStream("deflate-raw") as unknown as TransformStream<Uint8Array, Uint8Array>);
  throw new Error("Desteklenmeyen zip sıkıştırma yöntemi.");
}

async function forEachLine(stream: ReadableStream<Uint8Array>, onLine: (line: string) => void) {
  const reader = stream.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>).getReader();
  let rest = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const parts = (rest + value).split("\n");
    rest = parts.pop() ?? "";
    for (const line of parts) onLine(line);
  }
  if (rest) onLine(rest);
}

/**
 * export.zip ya da export.xml'i okur. `onProgress(okunan, toplam)` bayt cinsindendir
 * (zip'te sıkıştırılmış bayt).
 */
export async function readAppleHealthExport(
  file: Blob,
  onProgress?: (read: number, total: number) => void
): Promise<{ records: HealthRecordInput[]; stats: HealthAggregator["stats"] }> {
  const head = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  const agg = new HealthAggregator();
  let read = 0;
  const tick = (n: number) => {
    read += n;
    onProgress?.(read, file.size);
  };

  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) {
    const entries = await listZipEntries(file);
    const entry = entries.find((e) => /(^|\/)export\.xml$/.test(e.name));
    if (!entry) throw new Error("Zip içinde export.xml bulunamadı. Apple Sağlık › profil › Tüm sağlık verilerini dışa aktar ile oluşan dosyayı seç.");
    await forEachLine(await entryStream(file, entry, tick), (l) => agg.push(l));
    onProgress?.(file.size, file.size);
  } else {
    const text = new TextDecoder().decode(head);
    if (!text.includes("<?xml") && !text.includes("<HealthData")) throw new Error("Dosya bir Apple Sağlık dışa aktarımı değil (export.zip ya da export.xml).");
    const counted = file.stream().pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctrl) {
          tick(chunk.byteLength);
          ctrl.enqueue(chunk);
        },
      })
    );
    await forEachLine(counted, (l) => agg.push(l));
  }
  return { records: agg.result(), stats: agg.stats };
}

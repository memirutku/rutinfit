/**
 * F25: Yerleşik egzersiz kütüphanesi (videosuz; metin ipuçları). Adlar İngilizce kanonik
 * adlardır (Strong/Hevy içe aktarımı ve şablonlarla eşleşir); `nameTr` arayüzde gösterilir.
 * Kas kimlikleri src/lib/muscles.ts ile aynıdır. Kullanıcının eklediği özel egzersizler
 * veritabanında (CustomExercise) tutulur ve bu listeyle birleştirilir.
 */
import { MUSCLE_GROUPS, type MuscleGroup } from "./muscles";
import { normalizeName } from "./text";
import { foldTr } from "./food-search";
import { compareTr } from "./text";

export const EQUIPMENT_LABELS = {
  barbell: "Halter",
  dumbbell: "Dambıl",
  machine: "Makine",
  cable: "Kablo",
  bodyweight: "Vücut ağırlığı",
  kettlebell: "Kettlebell",
  band: "Direnç bandı",
} as const;
export type Equipment = keyof typeof EQUIPMENT_LABELS;
export const EQUIPMENT_KEYS = Object.keys(EQUIPMENT_LABELS) as [Equipment, ...Equipment[]];

export interface LibraryExercise {
  id: string;
  name: string;
  nameTr: string;
  primary: string;
  secondary: string[];
  equipment: Equipment;
  cues: string[];
  isCustom?: boolean;
}

const ex = (
  id: string,
  name: string,
  nameTr: string,
  primary: string,
  secondary: string[],
  equipment: Equipment,
  cues: string[]
): LibraryExercise => ({ id, name, nameTr, primary, secondary, equipment, cues });

export const EXERCISE_LIBRARY: LibraryExercise[] = [
  // Göğüs
  ex("bench-press", "Bench Press", "Düz bench press", "chest", ["triceps", "front_delts"], "barbell", [
    "Kürek kemiklerini geriye ve aşağı sıkıştır.",
    "Barı göğsün alt kısmına kontrollü indir.",
    "Ayaklar yere bassın, kalça sehpadan kalkmasın.",
  ]),
  ex("dumbbell-press", "Dumbbell Press", "Dambıl göğüs presi", "chest", ["triceps", "front_delts"], "dumbbell", [
    "Dambılları göğüs hizasında başlat, dirsekler 45 derece.",
    "Yukarıda dambılları birbirine çarptırma.",
  ]),
  ex("incline-dumbbell-press", "Incline Dumbbell Press", "Eğimli dambıl press", "chest", ["front_delts", "triceps"], "dumbbell", [
    "Sehpa 30–45 derece olsun.",
    "Üst göğse doğru it, omuzları kulaklardan uzak tut.",
  ]),
  ex("machine-chest-press", "Machine Chest Press", "Makine göğüs presi", "chest", ["triceps", "front_delts"], "machine", [
    "Tutamaçlar göğüs ortası hizasında olsun.",
    "Kollar tam kilitlenmeden geri dön.",
  ]),
  ex("dumbbell-chest-fly", "Dumbbell Chest Fly", "Dambıl fly", "chest", ["front_delts"], "dumbbell", [
    "Dirsekleri hafif bükük sabit tut.",
    "Göğüste gerilmeyi hissedene kadar aç, zorlama.",
  ]),
  ex("cable-fly", "Cable Fly", "Kablo fly", "chest", ["front_delts"], "cable", [
    "Bir adım öne çık, gövdeyi hafif öne eğ.",
    "Elleri göğüs önünde yay çizerek birleştir.",
  ]),
  ex("pushup", "Pushup", "Şınav", "chest", ["triceps", "front_delts", "abs"], "bodyweight", [
    "Baştan topuğa düz bir çizgi koru.",
    "Zor gelirse elleri bir sehpaya koyarak başla.",
  ]),
  ex("dips", "Dips", "Paralel bar dips", "triceps", ["chest", "front_delts"], "bodyweight", [
    "Omuz ağrısı varsa derine inme.",
    "Gövde dik kalırsa arka kol, öne eğilirsen göğüs çalışır.",
  ]),
  // Omuz
  ex("overhead-press", "Overhead Press", "Ayakta omuz presi", "front_delts", ["triceps", "side_delts"], "barbell", [
    "Karın ve kalçayı sık, belini çukurlaştırma.",
    "Bar yüzünün önünden dik bir çizgide yükselsin.",
  ]),
  ex("dumbbell-shoulder-press", "Dumbbell Shoulder Press", "Dambıl omuz presi", "front_delts", ["triceps", "side_delts"], "dumbbell", [
    "Oturarak yaparsan sırtını sehpaya daya.",
    "Dambılları kulak hizasından yukarı it.",
  ]),
  ex("pike-pushup", "Pike Pushup", "Pike şınav", "front_delts", ["triceps"], "bodyweight", [
    "Kalçayı yukarı kaldır, ters V pozisyonu al.",
    "Başı ellerin arasına doğru indir.",
  ]),
  ex("lateral-raise", "Lateral Raise", "Yana açış", "side_delts", ["traps"], "dumbbell", [
    "Hafif ağırlık seç, sallanma.",
    "Dirsekler bileklerden biraz yüksekte omuz hizasına kadar kaldır.",
  ]),
  ex("cable-lateral-raise", "Cable Lateral Raise", "Kablo yana açış", "side_delts", [], "cable", [
    "Makaranın ters tarafında dur, tek kolla çalış.",
    "Hareketin altında da gerilimi koru.",
  ]),
  ex("front-raise", "Front Raise", "Öne kaldırış", "front_delts", [], "dumbbell", ["Omuz hizasını geçme.", "Gövdeyi sabit tut."]),
  ex("face-pull", "Face Pull", "Face pull", "rear_delts", ["traps"], "cable", [
    "İpi yüzüne doğru çekerken elleri dışa aç.",
    "Dirsekler omuz hizasında kalsın.",
  ]),
  ex("rear-delt-fly", "Rear Delt Fly", "Arka omuz açış", "rear_delts", ["traps"], "dumbbell", [
    "Öne eğil, sırtı düz tut.",
    "Kolları yana açarken kürek kemiklerini fazla sıkıştırma.",
  ]),
  ex("upright-row", "Upright Row", "Dik çekiş", "side_delts", ["traps"], "barbell", [
    "Tutuşu omuz genişliğinde tut.",
    "Dirsekleri omuz hizasından fazla kaldırma.",
  ]),
  ex("shrug", "Shrug", "Omuz silkme", "traps", ["forearms"], "dumbbell", ["Omuzları kulaklara doğru dik kaldır, döndürme.", "Yukarıda bir saniye bekle."]),
  // Sırt
  ex("deadlift", "Deadlift", "Deadlift", "lower_back", ["glutes", "hamstrings", "traps", "forearms", "lats"], "barbell", [
    "Bar ayak ortasının üzerinde, kaval kemiklerine yakın dursun.",
    "Sırt düz; kalça ve göğüs aynı anda yükselsin.",
    "Barı vücuda yakın tut.",
  ]),
  ex("romanian-deadlift", "RDL (Romanian Deadlift)", "Romen deadlift", "hamstrings", ["glutes", "lower_back"], "barbell", [
    "Dizler hafif bükük, kalçayı geriye it.",
    "Arka bacakta gerilme hissedince yukarı dön.",
  ]),
  ex("single-leg-rdl", "Single Leg RDL", "Tek bacak RDL", "hamstrings", ["glutes", "lower_back"], "dumbbell", [
    "Destek bacağının dizi hafif bükük.",
    "Kalçayı yere paralel tut, dönme.",
  ]),
  ex("barbell-row", "Barbell Row", "Halterle eğilerek çekiş", "lats", ["rear_delts", "biceps", "lower_back"], "barbell", [
    "Gövde yere yaklaşık 45 derece, sırt düz.",
    "Barı göbeğe doğru çek.",
  ]),
  ex("dumbbell-row", "Dumbbell Row", "Tek kol dambıl çekiş", "lats", ["rear_delts", "biceps"], "dumbbell", [
    "Bir el ve diz sehpada, sırt düz.",
    "Dirseği kalçaya doğru çek.",
  ]),
  ex("lat-pulldown", "Lat Pulldown", "Lat pulldown", "lats", ["biceps", "rear_delts"], "cable", [
    "Barı göğsün üst kısmına çek, enseye değil.",
    "Gövdeyi az geriye yasla, sallanma.",
  ]),
  ex("seated-cable-row", "Seated Cable Row", "Oturarak kablo çekiş", "lats", ["rear_delts", "biceps"], "cable", [
    "Göğüs dik, omuzları öne düşürme.",
    "Tutamacı karına çekip kürek kemiklerini sık.",
  ]),
  ex("pull-up", "Pull-up", "Barfiks", "lats", ["biceps", "rear_delts"], "bodyweight", [
    "Tam asılı başla, çene barı geçsin.",
    "Zorsa direnç bandıyla ya da negatif tekrarlarla başla.",
  ]),
  ex("chin-up", "Chin-up", "Ters tutuş barfiks", "biceps", ["lats"], "bodyweight", ["Avuç içleri sana baksın.", "Kontrollü in."]),
  ex("inverted-row", "Inverted Row", "Ters kürek", "lats", ["rear_delts", "biceps"], "bodyweight", [
    "Bel hizasında bir bar ya da masa kenarı kullan.",
    "Vücudu düz tutup göğsü bara çek.",
  ]),
  ex("back-extension", "Back Extension", "Sırt ekstansiyonu", "lower_back", ["glutes", "hamstrings"], "bodyweight", [
    "Belini aşırı geriye bükme; gövde bacaklarla aynı hizaya gelince dur.",
  ]),
  ex("band-pull-apart", "Band Pull Apart", "Bant açış", "rear_delts", ["traps"], "band", ["Kolları düz tut, bandı göğüs hizasında aç."]),
  // Bacak
  ex("squat", "Squat", "Halter squat", "quads", ["glutes", "hamstrings", "lower_back"], "barbell", [
    "Ayaklar omuz genişliğinde, dizler ayak uçlarıyla aynı yöne.",
    "Kalça diz hizasına inene kadar otur, topuklar yerde kalsın.",
    "Göğüs dik, karın sıkı.",
  ]),
  ex("goblet-squat", "Goblet Squat", "Goblet squat", "quads", ["glutes"], "dumbbell", [
    "Dambılı göğsünde dik tut.",
    "Dirsekler dizlerin içinden geçecek kadar derin otur.",
  ]),
  ex("bodyweight-squat", "Bodyweight Squat", "Vücut ağırlığıyla squat", "quads", ["glutes"], "bodyweight", [
    "Kolları öne uzatarak dengeyi koru.",
    "Sandalyeye oturur gibi kalçayı geri it.",
  ]),
  ex("leg-press", "Leg Press", "Leg press", "quads", ["glutes"], "machine", [
    "Bel minderden kalkacak kadar derine inme.",
    "Dizleri tam kilitleme.",
  ]),
  ex("bulgarian-split-squat", "Bulgarian Split Squat", "Bulgar squat", "quads", ["glutes"], "dumbbell", [
    "Arka ayak sehpada, ön ayak yeterince önde.",
    "Gövde dik, ön diz ayak ucunu çok geçmesin.",
  ]),
  ex("lunge", "Lunge", "Hamle (lunge)", "quads", ["glutes", "hamstrings"], "dumbbell", [
    "Arka diz yere yaklaşana kadar in.",
    "Ön topuktan iterek kalk.",
  ]),
  ex("step-up", "Step-up", "Basamak çıkış", "quads", ["glutes"], "dumbbell", ["Sağlam bir basamak seç.", "Öndeki bacakla it, arkadakiyle zıplama."]),
  ex("leg-extension", "Leg Extension", "Bacak ekstansiyonu", "quads", [], "machine", ["Dizin dönme ekseni makinenin ekseniyle hizalı olsun.", "Yukarıda bir saniye sık."]),
  ex("leg-curl", "Leg Curl", "Bacak bükme", "hamstrings", [], "machine", ["Kalçayı minderden kaldırma.", "İnişi yavaş yap."]),
  ex("hip-thrust", "Hip Thrust", "Hip thrust", "glutes", ["hamstrings"], "barbell", [
    "Kürek kemikleri sehpada, çene göğse yakın.",
    "Yukarıda kalçayı sık, beli bükme.",
  ]),
  ex("glute-bridge", "Glute Bridge", "Kalça köprüsü", "glutes", ["hamstrings"], "bodyweight", ["Topuklardan it.", "Yukarıda kalçayı iki saniye sık."]),
  ex("kettlebell-swing", "Kettlebell Swing", "Kettlebell salınım", "glutes", ["hamstrings", "lower_back"], "kettlebell", [
    "Hareket kalçadan gelir, kollardan değil.",
    "Kettlebell göğüs hizasını geçmesin.",
  ]),
  ex("standing-calf-raise", "Standing Calf Raise", "Ayakta baldır kaldırma", "calves_back", [], "machine", ["Topukları aşağıya tam indir.", "Yukarıda bir saniye bekle."]),
  ex("seated-calf-raise", "Seated Calf Raise", "Oturarak baldır kaldırma", "calves_back", [], "machine", ["Hareketi yavaş ve tam açıklıkta yap."]),
  // Kol
  ex("bicep-curl", "Bicep Curl", "Dambıl biceps curl", "biceps", ["forearms"], "dumbbell", ["Dirsekleri gövdeye sabitle.", "Sallanmadan kaldır."]),
  ex("hammer-curl", "Hammer Curl", "Çekiç curl", "biceps", ["forearms"], "dumbbell", ["Avuç içleri birbirine baksın.", "Kontrollü in."]),
  ex("cable-curl", "Cable Curl", "Kablo curl", "biceps", ["forearms"], "cable", ["Dirsekler sabit, gerilimi hareketin altında da koru."]),
  ex("tricep-pushdown", "Tricep Pushdown", "Triceps pushdown", "triceps", [], "cable", ["Dirsekleri gövdeye yapıştır.", "Aşağıda kolları tam aç."]),
  ex("cable-pushdown", "Cable Pushdown", "İp ile pushdown", "triceps", [], "cable", ["İpi aşağıda iki yana aç.", "Omuzları hareket ettirme."]),
  ex("skull-crusher", "Skull Crusher", "Skull crusher", "triceps", [], "barbell", ["Dirsekleri tavana sabit tut.", "Barı alnının biraz arkasına indir."]),
  ex("close-grip-bench", "Close Grip Bench", "Dar tutuş bench press", "triceps", ["chest"], "barbell", ["Tutuş omuz genişliğinde.", "Dirsekler gövdeye yakın."]),
  ex("farmers-walk", "Farmer's Walk", "Çiftçi yürüyüşü", "forearms", ["traps", "abs"], "dumbbell", ["Dik dur, omuzları düşürme.", "Kısa adımlarla yürü."]),
  // Karın
  ex("plank", "Plank", "Plank", "abs", ["obliques"], "bodyweight", ["Kalçayı düşürme ya da kaldırma.", "Karnı ve kalçayı sık, nefesi tutma."]),
  ex("side-plank", "Side Plank", "Yan plank", "obliques", ["abs"], "bodyweight", ["Dirsek omzun altında.", "Kalçayı yukarıda tut."]),
  ex("crunch", "Crunch", "Mekik (crunch)", "abs", [], "bodyweight", ["Boynu çekme, gözler tavana.", "Yalnız kürek kemiklerini kaldır."]),
  ex("cable-crunch", "Cable Crunch", "Kablo crunch", "abs", [], "cable", ["Kalçayı sabit tut, gövdeyi kıvır."]),
  ex("leg-raise", "Leg Raise", "Bacak kaldırma", "abs", [], "bodyweight", ["Bel yere bassın.", "Bacakları kontrollü indir."]),
  ex("hanging-leg-raise", "Hanging Leg Raise", "Asılı bacak kaldırma", "abs", ["obliques"], "bodyweight", ["Sallanmadan kaldır.", "Zorsa dizleri bükerek başla."]),
  ex("russian-twist", "Russian Twist", "Rus dönüşü", "obliques", ["abs"], "bodyweight", ["Gövdeyi hafif geriye yasla.", "Omuzlarla dön, yalnız kollarla değil."]),
];

/** Özel egzersizler dahil, verilen ada karşılık gelen kayıt (yazım farklarına toleranslı). */
export function findExercise(name: string, library: LibraryExercise[] = EXERCISE_LIBRARY): LibraryExercise | undefined {
  const key = normalizeName(name);
  return (
    library.find((e) => normalizeName(e.name) === key || normalizeName(e.nameTr) === key) ??
    // "Bench Press (Barbell)" → "Bench Press": en uzun eşleşen kanonik ad.
    [...library]
      .filter((e) => key.includes(normalizeName(e.name)))
      .sort((a, b) => b.name.length - a.name.length)[0]
  );
}

/**
 * "Benzeriyle değiştir": aynı ana kası çalıştıran diğer egzersizler. Ortak yardımcı kası çok
 * olan ve (verilirse) eldeki ekipmanla yapılabilen önce gelir.
 */
export function alternativesFor(
  exercise: LibraryExercise,
  library: LibraryExercise[] = EXERCISE_LIBRARY,
  equipment?: Equipment[]
): LibraryExercise[] {
  const shared = (e: LibraryExercise) => e.secondary.filter((m) => exercise.secondary.includes(m)).length;
  return library
    .filter((e) => e.id !== exercise.id && e.primary === exercise.primary)
    .filter((e) => !equipment?.length || equipment.includes(e.equipment))
    .sort((a, b) => shared(b) - shared(a) || compareTr(a.nameTr, b.nameTr));
}

/** Arama: Türkçe karakter gerektirmez; ad, Türkçe ad ve kas adında arar. */
export function searchExercises(
  library: LibraryExercise[],
  opts: { search?: string; muscle?: string; equipment?: string } = {}
): LibraryExercise[] {
  const q = foldTr(opts.search);
  const muscleName = (id: string) => MUSCLE_GROUPS.find((m) => m.muscleId === id)?.nameTr ?? "";
  return library
    .filter((e) => !opts.muscle || e.primary === opts.muscle || e.secondary.includes(opts.muscle))
    .filter((e) => !opts.equipment || e.equipment === opts.equipment)
    .filter((e) => !q || [e.name, e.nameTr, muscleName(e.primary)].some((t) => foldTr(t).includes(q)))
    .sort((a, b) => compareTr(a.nameTr, b.nameTr));
}

/**
 * Kas haritası ve haftalık hacim için kas grupları: temel listelere kütüphanedeki (ve özel)
 * egzersizler eklenir; şablonlardaki "Cable Pushdown" gibi adlar da doğru kasa sayılır.
 */
export function muscleGroupsWithLibrary(library: LibraryExercise[] = EXERCISE_LIBRARY): MuscleGroup[] {
  return MUSCLE_GROUPS.map((g) => ({
    ...g,
    exercises: [
      ...new Set([
        ...g.exercises,
        ...library.filter((e) => e.primary === g.muscleId || e.secondary.includes(g.muscleId)).map((e) => e.name),
      ]),
    ],
  }));
}

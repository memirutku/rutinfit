/**
 * F76: İnternetsiz imsak ve iftar (akşam) vakti hesabı.
 *
 * Yöntem: NOAA güneş konumu formülleri (deklinasyon ve zaman denklemi). İmsak, Diyanet'in
 * kullandığı gibi Güneş ufkun 18° altındayken; akşam, Güneş'in üst kenarı ufuktan battığında
 * (−0,833°). Diyanet takvimine yaklaşmak için temkin dakikaları eklenir; 2026 İstanbul ve Ankara
 * imsakiyeleriyle ±2 dakika içinde tutarlıdır. Saatler Türkiye saatiyle (UTC+3) verilir.
 * Kesin vakit için Diyanet takvimi esastır; kullanıcı farkı ayarlardan dakika olarak düzeltebilir.
 */

export interface Province {
  name: string;
  lat: number;
  lon: number;
}

/** 81 il merkezinin yaklaşık koordinatları. */
export const PROVINCES: Province[] = [
  ["Adana", 37.0, 35.32], ["Adıyaman", 37.76, 38.28], ["Afyonkarahisar", 38.76, 30.54], ["Ağrı", 39.72, 43.05],
  ["Aksaray", 38.37, 34.03], ["Amasya", 40.65, 35.83], ["Ankara", 39.93, 32.86], ["Antalya", 36.89, 30.71],
  ["Ardahan", 41.11, 42.7], ["Artvin", 41.18, 41.82], ["Aydın", 37.85, 27.85], ["Balıkesir", 39.65, 27.88],
  ["Bartın", 41.63, 32.34], ["Batman", 37.89, 41.13], ["Bayburt", 40.26, 40.23], ["Bilecik", 40.14, 29.98],
  ["Bingöl", 38.88, 40.5], ["Bitlis", 38.4, 42.11], ["Bolu", 40.74, 31.61], ["Burdur", 37.72, 30.29],
  ["Bursa", 40.19, 29.06], ["Çanakkale", 40.15, 26.41], ["Çankırı", 40.6, 33.62], ["Çorum", 40.55, 34.95],
  ["Denizli", 37.78, 29.09], ["Diyarbakır", 37.91, 40.24], ["Düzce", 40.84, 31.16], ["Edirne", 41.68, 26.56],
  ["Elazığ", 38.67, 39.22], ["Erzincan", 39.75, 39.49], ["Erzurum", 39.9, 41.27], ["Eskişehir", 39.78, 30.52],
  ["Gaziantep", 37.07, 37.38], ["Giresun", 40.91, 38.39], ["Gümüşhane", 40.46, 39.48], ["Hakkari", 37.58, 43.74],
  ["Hatay", 36.2, 36.16], ["Iğdır", 39.92, 44.04], ["Isparta", 37.76, 30.55], ["İstanbul", 41.01, 28.98],
  ["İzmir", 38.42, 27.14], ["Kahramanmaraş", 37.58, 36.94], ["Karabük", 41.2, 32.62], ["Karaman", 37.18, 33.22],
  ["Kars", 40.6, 43.1], ["Kastamonu", 41.38, 33.78], ["Kayseri", 38.73, 35.49], ["Kilis", 36.72, 37.12],
  ["Kırıkkale", 39.85, 33.51], ["Kırklareli", 41.73, 27.23], ["Kırşehir", 39.15, 34.16], ["Kocaeli", 40.77, 29.92],
  ["Konya", 37.87, 32.48], ["Kütahya", 39.42, 29.98], ["Malatya", 38.35, 38.31], ["Manisa", 38.61, 27.43],
  ["Mardin", 37.31, 40.74], ["Mersin", 36.8, 34.64], ["Muğla", 37.22, 28.36], ["Muş", 38.75, 41.51],
  ["Nevşehir", 38.62, 34.71], ["Niğde", 37.97, 34.68], ["Ordu", 40.98, 37.88], ["Osmaniye", 37.07, 36.25],
  ["Rize", 41.02, 40.52], ["Sakarya", 40.78, 30.4], ["Samsun", 41.29, 36.33], ["Siirt", 37.93, 41.94],
  ["Sinop", 42.03, 35.15], ["Sivas", 39.75, 37.02], ["Şanlıurfa", 37.16, 38.8], ["Şırnak", 37.52, 42.46],
  ["Tekirdağ", 40.98, 27.51], ["Tokat", 40.31, 36.55], ["Trabzon", 41.0, 39.72], ["Tunceli", 39.11, 39.55],
  ["Uşak", 38.68, 29.41], ["Van", 38.49, 43.38], ["Yalova", 40.65, 29.27], ["Yozgat", 39.82, 34.81],
  ["Zonguldak", 41.45, 31.79],
].map(([name, lat, lon]) => ({ name: name as string, lat: lat as number, lon: lon as number }));

export const findProvince = (name: string) => PROVINCES.find((p) => p.name === name);

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Yılın günü için güneş deklinasyonu (°) ve zaman denklemi (dakika) — NOAA. */
function solar(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = Date.UTC(y, 0, 1);
  const dayOfYear = Math.round((Date.UTC(y, m - 1, d) - start) / 86400000) + 1;
  const daysInYear = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  const g = ((2 * Math.PI) / daysInYear) * (dayOfYear - 1 + 0.5); // öğle civarı
  const eqTime =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  return { declDeg: deg(decl), eqTime };
}

/** Güneş verilen yükseklikteyken öğleden uzaklık (dakika). */
function hourAngleMinutes(latDeg: number, declDeg: number, altitudeDeg: number): number | null {
  const cosH = (Math.sin(rad(altitudeDeg)) - Math.sin(rad(latDeg)) * Math.sin(rad(declDeg))) / (Math.cos(rad(latDeg)) * Math.cos(rad(declDeg)));
  if (cosH < -1 || cosH > 1) return null;
  return 4 * deg(Math.acos(cosH));
}

/** Diyanet takvimine yaklaştıran düzeltmeler (dakika). */
export const TEMKIN = { imsak: 0, aksam: 7 };
const TR_OFFSET_MIN = 180; // Türkiye saati UTC+3 (yaz saati yok)

const fmt = (minutesOfDay: number) => {
  const m = ((Math.round(minutesOfDay) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export interface FastingTimes {
  date: string;
  imsak: string;
  iftar: string;
  /** Oruç süresi (dakika). */
  fastMinutes: number;
}

export function fastingTimes(province: Province, dateStr: string, adjust: { imsak?: number; iftar?: number } = {}): FastingTimes {
  const { declDeg, eqTime } = solar(dateStr);
  const noonUtc = 720 - 4 * province.lon - eqTime;
  const fajr = hourAngleMinutes(province.lat, declDeg, -18) ?? 0;
  const sunset = hourAngleMinutes(province.lat, declDeg, -0.833) ?? 0;
  const imsakMin = noonUtc - fajr + TR_OFFSET_MIN + TEMKIN.imsak + (adjust.imsak ?? 0);
  const iftarMin = noonUtc + sunset + TR_OFFSET_MIN + TEMKIN.aksam + (adjust.iftar ?? 0);
  return { date: dateStr, imsak: fmt(imsakMin), iftar: fmt(iftarMin), fastMinutes: Math.round(iftarMin) - Math.round(imsakMin) };
}

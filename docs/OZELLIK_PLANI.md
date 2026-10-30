# RutinFit özellik uygulama planı

Seçim listesi: [OZELLIK_SECIMI.md](OZELLIK_SECIMI.md). Bu plan oradaki **4 hata ve 44 özelliği**
bağımlılık sırasına göre dört dalgaya böler. Beşinci adım hayali kullanıcı testleri ve eksik raporudur.

## Çalışma kuralları

1. **Test önce.** Her madde için önce başarısız olan test yazılır (Vitest `unit`/`db`/`ui` ya da
   Playwright), sonra kod. Test yeşil olmadan commit atılmaz.
2. **Madde başına bir commit.** Mesaj maddenin kodunu taşır, örnek: `feat(workouts): F20 set başına RPE`.
3. **Her dalga ayrı dal ve PR.** Dal adı `ozellik/dalga-N`. Bir sonraki dalga öncekinin üstünden
   açılır. PR'ların main'e birleştirilmesi kullanıcının onayıyla yapılır.
4. **Şema değişikliği** yalnız `pnpm db:new-migration <ad>` ile yapılır. Her yeni tablo
   `src/lib/services/backup.ts` içindeki `BACKUP_TABLES` listesine eklenir ve yedek gidiş-dönüş testi
   genişletilir.
5. **API:** zod şeması `src/lib/schemas/` altında, hata yanıtı `apiError()` ile, istemci çağrısı
   `src/lib/client/` katmanından.
6. **F56 güvenlik kuralları** hedef üreten her yolda zorunludur (F09 sihirbazı, F10 adaptif TDEE,
   AI `nutrition_targets` taslağı). Kural tek modülde durur: `src/lib/safety.ts`.
7. **Dalga sonu kapısı:** `tsc`, `eslint`, Vitest + coverage eşiği, Playwright (Chromium + WebKit),
   `pnpm audit --audit-level high --prod`. Masaüstünü etkileyen dalgada `pnpm desktop:build` ve
   `verify-desktop` da koşulur.
8. Daraltılmış maddelerde yalnız seçim dosyasındaki kapsam notu yapılır.

## Dalga 1 — Hatalar, temel ve hızlı kazanımlar

Dal: `ozellik/dalga-1`

| Sıra | Madde | Ne yapılır | Şema |
| --- | --- | --- | --- |
| 1 | F20 | Set başına RPE (yarım puanlı; RIR = 10 − RPE olduğundan ayrı alan yok); kayıt ekranında seçim | `SetLog.rpe` |
| 2 | H1, H3, H4 | CSV başlıklarında birim ekleri ve lbs→kg; RPE `SetLog`'a yazılır; "hedef tuttu" şablonun tekrar aralığından | — |
| 3 | H2 | Atlanan sütunlar içe aktarma özetinde listelenir; notlar ve süre seansa yazılır | — |
| 4 | F80 | Virgüllü ondalık girişi, gg.aa.yyyy gösterimi, `tr-TR` arama ve sıralama tek yardımcıdan | — |
| 5 | F56 | Kalori tabanı, azami kilo kaybı hızı, "sayıları gizle" modu, kırmızı bayrakta profesyonele yönlendirme | `UserProfile.hideNumbers` |
| 6 | F09 | Kurulum sihirbazı: Mifflin-St Jeor + aktivite, hedef, hız, tahmini varış tarihi | `UserProfile` hedef alanları |
| 7 | F58, F67 | AI etiketi, koçu aç/kapa, ton; ayarlarda "cihazdan ne çıkar" tablosu, uç nokta göstergesi, OpenAI uyarısı, sürüm SHA-256 | `AISettings.enabled`, `tone` |
| 8 | F13 | Su, kafein ve alkol takibi; panoda kart | `DrinkLog` |
| 9 | F01, F79 | Kayıtlı öğünler, öğün ve gün kopyalama; çay (küp şekerle), Türk kahvesi, simit, ekmek dilimi hızlı ekleme | `SavedMeal`, `SavedMealItem` |
| 10 | F03 | Barkod OFF'ta yoksa barkodu dolu yerel ürün formu | — |
| 11 | F02 | Arama sıralaması: Türkçe normalizasyon + kullanım sıklığı + yakınlık + güvenilirlik | — |
| 12 | F22 | Isınma seti hesaplayıcısı (plaka hesaplayıcısının yanında) | — |
| 13 | F23, F24 | PR ve e1RM trendi, egzersiz geçmişi grafiği; kas grubu başına haftalık set grafiği ve hedef aralığı | — |
| 14 | F60 | CSV dışa aktarma: besin günlüğü, Strong/Hevy uyumlu antrenman, vücut metrikleri; RutinFit'e geri içe aktarılabilir | — |
| 15 | F61 | Seçilen klasöre zamanlanmış otomatik yedek, saklama sayısıyla | `BackupSchedule` |
| 16 | F78 | Diyetisyen planında öğün başına uygulandı / kısmen / atlandı ve uyum yüzdesi | `PlannedMeal.adherence` |

## Dalga 2 — Antrenman derinliği

Dal: `ozellik/dalga-2`

| Sıra | Madde | Ne yapılır | Şema |
| --- | --- | --- | --- |
| 1 | F25 | Egzersiz kütüphanesi: kaslar, ekipman, metin ipuçları, özel egzersiz, "benzeriyle değiştir". Yerleşik liste kodda; mevcut veriler isimle bağlı kaldığı için özel egzersizler ayrı tabloda | `CustomExercise` |
| 2 | F17 | Şablon/program editörü: oluştur, düzenle, sırala, tekrar aralığı, dinlenme (egzersizler isimle, kütüphaneden seçilir) | — |
| 3 | F19 | Set tipi (ısınma, normal, drop, tükeniş); içe aktarmada ısınma setleri artık gelir (H2'nin kalanı) | `SetLog.setType` |
| 4 | F21 | Egzersiz başına artış miktarı ve durağanlık uyarısı | `WorkoutExercise.incrementKg` |
| 5 | F18 | 3–5 başlangıç ve ev programı, editörde "programı ekle" | seed verisi |
| 6 | F28 | Metinden antrenman ayrıştırma ("squat 3x8 80 kg") → onaylı seans | — |
| 7 | F27 | Koşu, kardiyo ve yürüyüş elle kaydı | `CardioLog` |
| 8 | F51 | Hazır olma skoru: günlük durum girdilerinden skor, bant, düşük bantta kısaltılmış antrenman önerisi | `DailyWellbeing.soreness`, `mood` |

## Dalga 3 — Türk mutfağı ve beslenme zekâsı

Dal: `ozellik/dalga-3`

| Sıra | Madde | Ne yapılır | Şema |
| --- | --- | --- | --- |
| 1 | F73 | Gıda başına ev ölçüleri (kaşık, bardak, kepçe, kase, dilim, adet, avuç) ve gram karşılıkları | `FoodMeasure` |
| 2 | F74 | Türk ev yemekleri kataloğu; değerler RutinFit tariflerinden hesaplanır | seed verisi |
| 3 | F06 | Doğal dille kayıt → katalog eşleme → onay; sayılar katalogdan, kaynak gösterilir | — |
| 4 | F33 | Tarif URL içe aktarma: schema.org Recipe → malzeme ayrıştırma → onaylı katalog eşleme | — |
| 5 | F30 | Haftalık plan editörü: ekle, taşı, kopyala, sil | — |
| 6 | F31 | Serbest porsiyon ölçekleme ve hane büyüklüğü (alışveriş listesine yansır) | `UserProfile.householdSize` |
| 7 | F10 | Adaptif TDEE: düzeltilmiş kilo trendi + alınan enerji | — |
| 8 | F57 | Açıklanabilirlik bileşeni: öneri yanında girdiler, sayılar, küçük grafik | — |
| 9 | F49 | Haftalık check-in: uyum, kilo trendi, hacim, tek öneri; hedef değişikliği onaylı taslakla | `WeeklyCheckin` |
| 10 | F50 | Geçmiş üzerinde soru-cevap: 5–10 sabit tipli sorgu aracı | — |
| 11 | F52 | Ayarlarda "Koça notlar" alanı, sistem istemine eklenir | `UserProfile.coachNotes` |

## Dalga 4 — Platform, Türkiye ve sağlık verisi

Dal: `ozellik/dalga-4`

| Sıra | Madde | Ne yapılır | Şema |
| --- | --- | --- | --- |
| 1 | F83 | Uygulama açıkken sistem bildirimleri (öğün, su, tartılma, takviye); Tauri bildirim eklentisi | `Reminder` |
| 2 | F15 | Birden çok takviye ve hatırlatma | `Supplement` |
| 3 | F76, F14 | Ramazan modu (il bazlı çevrimdışı imsak/iftar, Sahur/İftar öğünleri, su hedefi) ve aralıklı oruç zamanlayıcısı | `UserProfile` ayarları |
| 4 | F16 | Vücut ölçüleri, sağlık metrikleri, yerelde saklanan ilerleme fotoğrafları | `BodyMeasurement` genişler, `ProgressPhoto` |
| 5 | F62 | Apple Health export.zip içe aktarma: akışlı ayrıştırma, salt okunur kayıtlar, çift sayım önleme | `HealthRecord` |
| 6 | F77 | Diyetisyene haftalık/aylık rapor (yazdırılabilir sayfa → PDF, XLSX) | — |
| 7 | F82 | İsteğe bağlı adet döngüsü notu | `DailyWellbeing.cycleNote` |

## Dalga 5 — Hayali kullanıcı testleri ve eksik raporu

1. 5–6 kişilik persona seti: örneğin kilo vermeye başlayan masa başı çalışanı, deneyimli halterci,
   diyetisyenle çalışan kullanıcı, Ramazan'da oruç tutan kullanıcı, gizlilik hassasiyeti yüksek teknik
   kullanıcı, telefon alışkanlığı güçlü genç kullanıcı.
2. Her persona için gerçekçi bir haftalık senaryo; tarayıcıda (paketlenmiş sunucuya karşı) baştan sona
   uygulanır, her sürtünme noktası ekran görüntüsüyle kaydedilir.
3. Bulgular `reports/` altında eksik raporuna yazılır: önem, persona, adım, öneri.
4. Bulgular seçime sunulur; seçilenler yeni bir plana girer.

## Kapsam dışı

Seçim dosyasının 2., 3. ve 4. bölümleri (sonraya bırakılanlar, belki, hayır).

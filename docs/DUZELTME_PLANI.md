# RutinFit dalga 6: persona bulgularının düzeltme planı

Kaynak: [Hayali kullanıcı testi](<../reports/Hayali kullanıcı testi.md>). Altı persona paketlenmiş uygulamayı ilk
kurulumdan başlayarak kullandı ve 43 bulgu çıktı. Kullanıcı 30 Ekim 2026'da **43 bulgunun hepsini "Evet"** olarak
işaretledi. Bu plan o 43 maddeyi altı alana böler.

Dal: `ozellik/dalga-6` (`ozellik/dalga-5`'in üstünden). Alanlar paralel yürür. Her alan kendi dalında çalışır,
sonra bu dala birleştirilir.

## Çalışma kuralları

1. **Test önce.**
   - Her madde için önce hatayı gösteren test yazılır: Vitest `node`/`ui` ya da Playwright. Sonra kod düzeltilir.
   - Kritik ve yüksek maddelerin her biri en az bir Playwright akışıyla kilitlenir. Dosya adı:
     `e2e/wave6-<alan>.spec.ts`.
2. **Madde başına bir commit.** Mesaj bulgunun kodunu taşır, örnek: `fix(workouts): B17 yalnız tamamlanan setler kaydedilir`.
3. **Dosya sahipliği.**
   - Her alan yalnız kendi dosyalarını değiştirir; liste aşağıda.
   - Başka alanın dosyasında değişiklik gerekiyorsa en küçük hâliyle yapılır ve raporda belirtilir.
   - Pano sayfası (`src/app/page.tsx`) ve `Navigation.tsx` A alanınındır.
4. **Şema.**
   - Değişiklik yalnız `pnpm db:new-migration <ad>` ile yapılır.
   - Paralel dallarda migration numaraları çakışır. Birleştirmede sırayla yeniden numaralanır ve
     `drift_check` ile doğrulanır.
   - Yeni tablo eklenirse `BACKUP_TABLES` listesine girer.
5. **Yeni bağımlılık.**
   - Yalnız gerekiyorsa eklenir.
   - En az iki hafta önce yayımlanmış bir sürüme sabitlenir.
   - Gerekçesi PR'da yazılır.
6. **Kişisel varsayılan yok.** Kodda hiçbir yerde kullanıcıya ait sabit sayı (2.080 kcal, 112 kg, 19:30) ya da sabit
   rutin kalmaz. Gösterilen sayılar profilden ve kayıtlardan üretilir. Veri yoksa "—" ve boş durum gösterilir.
7. **Sayı biçimi.** Gösterilen her sayı `src/lib/format.ts` içindeki Türkçe biçimlendiriciden geçer.
8. **Dalga sonu kapısı.**
   - `tsc` ve `eslint`.
   - Vitest ve coverage eşiği (eşik düşürülmez).
   - Playwright (Chromium ve WebKit).
   - `pnpm audit --audit-level high --prod`.
   - `pnpm desktop:build` ve `verify-desktop`.
   - **Persona yolculuklarının yeniden koşusu.**

## Alanlar

### A. İlk kurulum, pano ve gezinme

Dosyalar: `src/app/page.tsx`, `src/components/dashboard/` (SupplementsCard, QuickAddModal, NaturalLogModal ve
TodayWorkoutCard hariç), `src/components/onboarding/`, `Navigation.tsx`, profil varsayılanları, fasting/rhythm.

| Sıra | Bulgu | Önem | Ne yapılır |
| --- | --- | --- | --- |
| 1 | B32 | Kritik | Dar ekran alt menüsüne "Daha fazla" sekmesi: İlerleme, Ayarlar, Kiler, openGym, Rapor |
| 2 | B02 | Yüksek | Nötr varsayılanlar. Sihirbaz atlanınca hedefler "tahmini" diye gösterilir ve kalıcı "Profilini tamamla" şeridi çıkar. Rutin bandı yalnız kullanıcı saat tanımladıysa görünür. Yeni kurulumda takviye listesi boştur. |
| 3 | B04 | Yüksek | Veri yoksa "—" ve "Henüz kayıt yok" gösterilir. Günlük durum alanları boş başlar; yalnız dokunulan alanlar kaydedilir. |
| 4 | B25 | Yüksek | Ramazan modunda ritim kartı imsak ve iftara göre üretilir. Ramazan kartı en üste çıkar, alkol satırı gizlenir. |
| 5 | B05 | Orta | Sihirbazda cinsiyet "Seçin" ile başlar. Hatalar alandan çıkınca ya da "İleri"ye basınca görünür. |
| 6 | B06 | Orta | Sihirbaz sonunda "başlarken" adımı: başlangıç programı, oruç ve gün düzeni (ofis, okul, vardiya). |
| 7 | B07 | Orta | Panoda "Kilo hedefim" kartı: güncel kilo, hedef, verilen ve kalan kg, tahmini varış. |
| 8 | B26 | Orta | Ramazan dışında sayaç yerine "Ramazan'a X gün" yazar. Mod açılınca sahur ve iftar hatırlatmaları tek tıkla önerilir. (Katalog kalemleri B alanında.) |

### B. Besin kaydı ve katalog

Dosyalar: `src/components/foods/`, `QuickAddModal`, `NaturalLogModal`, `SupplementsCard`,
`src/components/settings/SupplementsSection.tsx`, `natural-log.ts`, `quick-foods.ts`, `turkish-catalog.ts`,
`measures.ts`, supplements servisi, seed ve katalog kurulumu.

| Sıra | Bulgu | Önem | Ne yapılır |
| --- | --- | --- | --- |
| 1 | B01 | Kritik | İlk açılışta temel katalog, Türk ev yemekleri ve hızlı kalemler kurulur. Katalog boşken hızlı eklemede, yazarak eklemede ve katalog sekmesinde "yükle / yeni besin ekle" çıkar. |
| 2 | B10 | Yüksek | Bulunamayan satıra "yeni besin olarak ekle" ve "yaklaşık kalori gir" seçenekleri konur. Hızlı kalemler eşlemeye girer. Ramazan modunda Sahur ve İftar adları kullanılır. |
| 3 | B11 | Yüksek | "1 kase" tarif porsiyonundan hesaplanır. Tarif kartında porsiyon kalorisi öne çıkar. |
| 4 | B12 | Yüksek | Takviye isteğe bağlı olarak bir besine bağlanır; işaretlenince günlüğe yazılır. Kartta her zaman "+ Takviye / Düzenle" bağlantısı olur. |
| 5 | B13 | Orta | Kayıtta öğün rozetine dokunarak öğün değiştirilebilir. Saat sınırdaysa "Hangi öğün?" diye sorulur. |
| 6 | B14 | Orta | Yeni besinde kategori varsayılanı "Genel", güven varsayılanı "Kullanıcı" olur. |
| 7 | B26 | Orta | Türk paketine Ramazan kalemleri eklenir: pide, hurma, güllaç ve benzerleri. |

### C. Plan, alışveriş ve rapor

Dosyalar: `src/app/nutrition/`, `src/components/nutrition/`, `ProfileTargetsSection.tsx` (yalnız makro
dağılımı), `shopping-*`, `dietitian-report.ts`, `src/components/report/`.

| Sıra | Bulgu | Önem | Ne yapılır |
| --- | --- | --- | --- |
| 1 | B08 | Kritik | Günlük plan, girilen planlı öğünleri gösterir. Plan yoksa boş durum ve "Hafta'dan ekle" bağlantısı çıkar. Sabit örnek öğünler kaldırılır. |
| 2 | B03 | Yüksek | Yemek Planı başlığı hedefi profilden alır. "Sayıları gizle" ayarına uyar. |
| 3 | B09 | Yüksek | Tarifsiz plan öğünü "kalori girerek kaydet" ya da katalog eşleme ile kaydedilir. Alışveriş listesinde boşluğun nedeni yazar ve elle kalem eklenebilir. |
| 4 | B43 | Yüksek | Rapora ölçü tablosu, haftalık uyum yüzdesi ve öğün bazında plan–gerçekleşen eklenir. Hedeften sapma renkle gösterilir. Öğün günlüğü güne göre gruplanır. |
| 5 | B15 | Orta | Kalori hedefi değişince makrolar oranla yeniden dağıtılabilir. Toplam uyuşmazsa uyarı çıkar. |
| 6 | B16 | Orta | Haftalık editörde uzun adlar sarılır. Gün kcal toplamı ve bugün vurgusu eklenir, hafta okları konur. |

### D. Antrenman

Dosyalar: `src/app/workouts/`, `src/components/workouts/`, `TodayWorkoutCard`, `PlateCalculator.tsx`,
`StrengthSection`, `VolumeSection`, `programs.ts`, `warmup.ts`, `workout-text.ts`, `format.ts` (B23).

| Sıra | Bulgu | Önem | Ne yapılır |
| --- | --- | --- | --- |
| 1 | B17 | Kritik | Yalnız tamamlanan setler kaydedilir. Bitirirken "X set tamamlanmadı: at / tamamlandı say" diye sorulur. Ağırlık alanı boş başlar. |
| 2 | B18 | Yüksek | Seans şablondaki set sayısıyla açılır. Her harekete "+ Set" ve set silme eklenir. |
| 3 | B19 | Yüksek | Metinden eklemeye tarih seçici gelir. Tarihli seans geçmişi eklenir: görme, düzenleme, silme. |
| 4 | B20 | Yüksek | "Tamamlandı" durumu yapılan şablona göre belirlenir. Bugünün kartı vurgulanır, gün açıklaması şablondan gelir. |
| 5 | B21 | Orta | %1RM'e bağlı yüklemeyle 5/3/1 programı. |
| 6 | B22 | Orta | Seansta ana harekete "Isınma setleri ekle". |
| 7 | B23 | Orta | Tek Türkçe sayı biçimi. Plaka ve ağırlıkta en fazla iki ondalık gösterilir (1,25). |
| 8 | B24 | Düşük | Güç bölümüne kısayol. Antrenman kaydı yoksa güç bölümleri gizlenir, terimler sadeleşir. |

### E. AI koç

Dosyalar: `src/app/coach/`, `src/components/coach/`, `AIProviderSection.tsx`, `history-qa.ts`, koç servisleri.

| Sıra | Bulgu | Önem | Ne yapılır |
| --- | --- | --- | --- |
| 1 | B27 | Yüksek | Koç sayfası 1366 px'te taşmaz (`min-w-0`, şerit sınırı). Yatay kaydırmanın olmadığını bir E2E testi doğrular. |
| 2 | B03 | Yüksek | Karşılama mesajı ve hazır sorular hedefi profilden alır. |
| 3 | B28 | Orta | Sayfa açılınca bağlantı denetlenir. Model yoksa "Koç kapalı" satırı, kurulum adımları ve "Ayarlar'da test et" düğmesi çıkar. Rozet gerçek durumu gösterir. |
| 4 | B29 | Orta | Öneri JSON'u metinden çıkarılır. Onaydan sonra rozet "Onaylandı" olur. Eksik malzemede "Hesaplandı" yazmaz. |
| 5 | B30 | Orta | Mesaj "Bağlantı başarılı ve kaydedildi" olur. Algılanan modeller seçilebilir. |
| 6 | B31 | Orta | Koşu sorusu türe göre filtrelenir. Karta "kayıtlarından hesaplandı" yazılır. |
| 7 | B33 | Orta | Gönder düğmesine erişilebilir ad verilir. |
| 8 | B42 | Düşük | Model yokken kalan kalori ve makroya göre kayıtlı öğün ve tariflerden kural tabanlı öneri gösterilir. |

### F. Ayarlar, gizlilik ve veri

Dosyalar: `src/app/settings/`, `src/components/settings/` (yukarıda başka alana verilenler hariç),
`src/components/progress/AppleHealthSection.tsx`, `CheckinCard.tsx`, `weekly-checkin.ts`, `export-files.ts`,
`src/components/ui/` (yeni dosya seçici).

| Sıra | Bulgu | Önem | Ne yapılır |
| --- | --- | --- | --- |
| 1 | B34 | Orta | Ayarlara bölüm sekmeleri ya da içindekiler eklenir. Teknik bölümler "Gelişmiş" altında katlanır. Anahtarlar dokununca kaydeder. |
| 2 | B36 | Orta | "Finder'da göster" ve "Yolu kopyala" düğmeleri. Dışa aktarma kopyası kapatılabilir. Klasör seçme penceresi, yerel saatli dosya adları. |
| 3 | B37 | Orta | Apple Sağlık sonucunda hangi kaynağın alındığı ve kaynak dökümü gösterilir. |
| 4 | B38 | Orta | Tanılama kendini yeniler. Tüm tablolar, sürüm ve günlük yolu görünür; "Tanılamayı kopyala" düğmesi eklenir. |
| 5 | B41 | Orta | Hatırlatmalar .ics takvim dosyası olarak dışa aktarılır. |
| 6 | B35 | Düşük | Türkçe dosya seçici bileşeni. Dar ekranda tablolar karta dönüşür, karışık ifadeler sadeleşir. |
| 7 | B39 | Düşük | Sunucu yoksa "kontrol yapılmadı" yazar. Yerel ve bulut satırları aynı veri listesini kullanır. iCloud önerisine şifresiz yedek uyarısı eklenir. |
| 8 | B40 | Düşük | Öneri yalnız kutuda yazar. Özete hedefle karşılaştırma girer, etiket "Otomatik özet" olur. |

## Birleştirme ve doğrulama

1. Alan dalları `ozellik/dalga-6`'ya tek tek birleştirilir. Çakışmalar elle çözülür, migration'lar yeniden numaralanır.
2. Tam kapı koşulur (kural 8).
3. Persona senaryoları yeni davranışa göre güncellenir, paketlenmiş uygulamaya karşı yeniden koşulur. Kritik ve
   yüksek bulguların kapandığı ekran görüntüleriyle doğrulanır.
4. Sonuç, "önce / sonra" tablosuyla rapora eklenir. PR açılır; birleştirme kullanıcının onayıyla yapılır.

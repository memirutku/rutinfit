# RutinFit — Açık Kaynak Repolar, Entegrasyon Yöntemleri ve Lisans Kılavuzu

> **Belge Sürümü:** 1.0  
> **Tarih:** 18 Ekim 2026  
> **Kapsam:** 8 Açık Kaynak Projenin Teknik Röntgeni, Entegrasyon Sınırları ve Lisans İzolasyonu

Bu belge; RutinFit Desktop geliştirme sürecinde incelenen, örnek alınan, API olarak bağlanan veya kod yapısı uyarlanan **8 açık kaynak projenin** her birini tek tek ele almaktadır. 

Her proje için:
* Depo künyesi ve doğrulanmış lisansı,
* RutinFit içindeki gerçek kullanım durumu (`adapted`, `external API`, `adopted`, `reference only`, `deferred`),
* **Hangi parçaların alındığı**,
* **Hangi parçaların BİLEREK ALINMADIĞI ve gerekçeleri**,
* Hukuki ve teknik izolasyon sınırları,
* RutinFit kod tabanındaki karşılık gelen dosya yolları detaylandırılmıştır.

---

## 1. Genel Entegrasyon ve Lisans Matrisi

```
┌──────────────────┬─────────────────┬───────────────────┬─────────────────────────────────────────────────┐
│ Proje / Kaynak   │ Lisans          │ Kullanım Durumu   │ RutinFit'teki Rolü ve Uygulama Şekli            │
├──────────────────┼─────────────────┼───────────────────┼─────────────────────────────────────────────────┤
│ openGym          │ AGPL-3.0        │ adapted           │ Antrenman şeması ve set/RPE mantığı uyarlandı;  │
│                  │ (Gym Visual Tel)│                   │ Web arayüzü ve telifli medyalar KOPYALANMADI.   │
├──────────────────┼─────────────────┼───────────────────┼─────────────────────────────────────────────────┤
│ Open Food Facts  │ AGPL (Sunucu)   │ external API /    │ REST API istemcisi; ODbL atfı ve yerel SQLite   │
│                  │ ODbL (Veritaban)│ data source       │ önbelleği eklendi. Sunucu kodu kopyalanmadı.    │
├──────────────────┼─────────────────┼───────────────────┼─────────────────────────────────────────────────┤
│ Tally            │ MIT             │ adapted           │ Porsiyon çarpanları (0.5x/1x/1.5x) ve anlık     │
│                  │                 │                   │ makro geri bildirim UX kalıpları uyarlandı.     │
├──────────────────┼─────────────────┼───────────────────┼─────────────────────────────────────────────────┤
│ Pantry Host      │ MIT             │ adapted           │ Kiler envanteri ve net alışveriş çıkarma kodu   │
│                  │                 │                   │ uyarlandı; Anthropic bulut çağrısı çıkarıldı.   │
├──────────────────┼─────────────────┼───────────────────┼─────────────────────────────────────────────────┤
│ Diet App         │ AGPL-3.0        │ reference only    │ Çok günlük menü ve malzeme tekrarı mantığı      │
│                  │                 │                   │ temiz oda yaklaşımıyla incelendi; kod alınmadı. │
├──────────────────┼─────────────────┼───────────────────┼─────────────────────────────────────────────────┤
│ Meals (YAMP)     │ AGPL-3.0        │ deferred /        │ AI araç/MCP konsepti incelendi; RutinFit'in     │
│                  │                 │ reference only    │ kendi 2-aşamalı onaylı motoru tercih edildi.    │
├──────────────────┼─────────────────┼───────────────────┼─────────────────────────────────────────────────┤
│ MuscleMapJS      │ MIT             │ adopted           │ Ön/arka SVG kas anatomisi koordinatları         │
│                  │                 │                   │ doğrudan yerel React bileşeni olarak taşındı.   │
├──────────────────┼─────────────────┼───────────────────┼─────────────────────────────────────────────────┤
│ MuscleMap SwiftUI│ MIT             │ reference only    │ MuscleMapJS'in upstream kaynağı; anatomik atıf  │
│                  │                 │                   │ ve gruplama referansı olarak korundu.           │
└──────────────────┴─────────────────┴───────────────────┴─────────────────────────────────────────────────┘
```

---

## 2. Proje Bazında Derinlemesine Teknik Analiz

### 2.1 openGym
* **Geliştirici:** Duarte Santos
* **Kaynak Depoları:** 
  * Gitea (Ana Kaynak): `https://gitea.com/DuarteSantos/openGym`
  * GitHub Mirror: `https://github.com/DuarteSantos8/openGym`
* **Doğrulanmış Lisans:** GNU Affero General Public License v3.0 (**AGPL-3.0**)
* **Medya Telif Uyarısı:** Egzersiz animasyonları ve çizimleri **Gym Visual** (`https://gymvisual.com`) telifindedir.
* **Kullanım Durumu:** **`adapted`** (Veri Modelleri ve Egzersiz Mantığı)

#### Alınan ve Uyarlanan Kısımlar:
1. **Antrenman Veri Şeması:** Egzersiz seansı, set numarası, ağırlık, tekrar, RPE (Zorluk Derecesi 1-10) ve ısınma seti hiyerarşisi (`src/lib/opengym-client.ts`, `prisma/schema.prisma`).
2. **Kilo ve Seans Senkronizasyon Formatı:** openGym yerel JSON dosyalarını (`state-*.json`) ve HTTP API'sini RutinFit SQLite formatına dönüştüren adaptör fonksiyonları (`mapOpenGymWorkoutToRutinFit`, `mapRutinFitWeightsToOpenGym`).

#### BİLEREK ALINMAYAN Kısımlar ve Gerekçeleri:
1. **SvelteKit Web Arayüzü ve PocketBase Backend'i ALINMADI:**
   * *Hukuki Gerekçe:* OpenGym'in kaynak kodlarının doğrudan kopyalanması, RutinFit'in tüm kaynak kodunun da AGPL-3.0 ile lisanslanmasını zorunlu kılar (copyleft bulaşması).
   * *Teknik Gerekçe:* OpenGym'in çalışması Docker veya Node/PocketBase arka plan sunucusu gerektirir. Masaüstü son kullanıcısının Docker kurmak zorunda bırakılmaması için bu bileşenler RutinFit paketine gömülmemiştir.
2. **Gym Visual Telifli Görselleri ALINMADI:**
   * OpenGym deposundaki 5.600+ GIF ve çizim Gym Visual ticari telifine tabidir. İzin alınmadan bir masaüstü uygulamasıyla dağıtılması telif ihlali riski taşır.
* **İlgili RutinFit Dosyaları:**
  * [`src/lib/opengym-client.ts`](file:///Users/memir/Projects/fitness/src/lib/opengym-client.ts)
  * [`src/app/opengym/page.tsx`](file:///Users/memir/Projects/fitness/src/app/opengym/page.tsx)
  * [`src/app/api/opengym/status/route.ts`](file:///Users/memir/Projects/fitness/src/app/api/opengym/status/route.ts)
  * [`src/app/api/opengym/sync/route.ts`](file:///Users/memir/Projects/fitness/src/app/api/opengym/sync/route.ts)

---

### 2.2 Open Food Facts (OFF)
* **Geliştirici:** Open Food Facts Topluluğu
* **Kaynak Depoları:** 
  * Sunucu Deposu: `https://github.com/openfoodfacts/openfoodfacts-server`
  * API Dokümantasyonu: `https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/`
* **Lisanslar:**
  * Sunucu Yazılımı: AGPL-3.0
  * Veritabanı: **Open Database License (ODbL) 1.0**
  * Veritabanı İçeriği: Database Contents License (DbCL) 1.0
  * Ürün Fotoğrafları: Creative Commons Attribution-ShareAlike (CC BY-SA)
* **Kullanım Durumu:** **`external API/data source`** (Harici REST API İstemcisi)

#### Alınan ve Uyarlanan Kısımlar:
1. **Resmi REST API v2 ve v3 Entegrasyonu:** Barkod (`/api/v3/product/[barcode].json`) ve arama uç noktaları üzerinden paketli gıdaların kalori, protein, karbonhidrat, yağ ve porsiyon verilerinin çekilmesi.
2. **Deterministik Normalizasyon:** OFF veritabanındaki eksik kalori durumlarında 4-4-9 kuralı ($4 \times \text{protein} + 4 \times \text{karb} + 9 \times \text{yağ}$) ile deterministik hesaplama ve kullanıcıya "Tahmini" güven etiketi sunma.
3. **SQLite Önbellekleme (`OpenFoodFactsCache`):** Aynı barkod veya arama teriminin tekrar internete gitmesini önlemek için 24 saatlik yerel önbellek katmanı.
4. **Yasal Atıf:** Arayüzde "Veriler Open Food Facts veritabanından ODbL 1.0 lisansı ile alınmaktadır" uyarısı ve ürün fotoğraflarında kaynak linki gösterimi.

#### BİLEREK ALINMAYAN Kısımlar ve Gerekçeleri:
* **Perl/CGI Sunucu Yazılımı ALINMADI:** RutinFit yalnızca API istemcisidir; sunucu yazılımı (`openfoodfacts-server`) kopyalanmamış, sunucunun AGPL lisansı RutinFit'e bulaştırılmamıştır.
* **İlgili RutinFit Dosyaları:**
  * [`src/lib/openfoodfacts-client.ts`](file:///Users/memir/Projects/fitness/src/lib/openfoodfacts-client.ts)
  * [`src/app/api/foods/barcode/route.ts`](file:///Users/memir/Projects/fitness/src/app/api/foods/barcode/route.ts)
  * [`src/app/foods/page.tsx`](file:///Users/memir/Projects/fitness/src/app/foods/page.tsx)
  * [`tests/openfoodfacts.test.ts`](file:///Users/memir/Projects/fitness/tests/openfoodfacts.test.ts)

---

### 2.3 Tally
* **Geliştirici:** Gene Arnold
* **Kaynak Deposu:** `https://github.com/GeneArnold/tally`
* **Doğrulanmış Lisans:** **MIT License** (Copyright 2026 Gene Arnold)
* **Kullanım Durumu:** **`adapted`** (UX ve Arayüz Kalıpları)

#### Alınan ve Uyarlanan Kısımlar:
1. **Porsiyon Çarpanı Butonları:** Kullanıcının öğün kaydederken veya yerken tek tıkla `0.5x` (yarım porsiyon), `1.0x` (standart) veya `1.5x` (büyük porsiyon) seçebilmesi ve makroların anında güncellenmesi.
2. **Anlık Makro Geri Bildirimi:** Arama yaparken veya miktar girerken sayfa yenilenmeden kalori ve protein çubuklarının dinamik dolması.

#### BİLEREK ALINMAYAN Kısımlar ve Gerekçeleri:
* Tally'nin kendi veritabanı altyapısı, paralel frontend'i veya uzak AI entegrasyonu alınmamıştır. Var olan RutinFit SQLite şeması ve yerel AI katmanı kullanılmıştır.
* **İlgili RutinFit Dosyaları:**
  * [`src/app/nutrition/page.tsx`](file:///Users/memir/Projects/fitness/src/app/nutrition/page.tsx)
  * [`src/app/foods/page.tsx`](file:///Users/memir/Projects/fitness/src/app/foods/page.tsx)

---

### 2.4 Pantry Host
* **Geliştirici:** JP de Vries
* **Kaynak Deposu:** `https://github.com/jpdevries/pantry-host`
* **Doğrulanmış Lisans:** **MIT License** (Copyright 2026 JP de Vries)
* **Kullanım Durumu:** **`adapted`** (Veri Modelleri ve Stok Düşme Algoritması)

#### Alınan ve Uyarlanan Kısımlar:
1. **Kiler Envanteri Veri Modeli (`PantryItem`):** Evdeki malzemelerin adı, miktarı, birimi (g, ml, adet), kategorisi ve son kullanma tarihi takibi.
2. **Net Alışveriş Listesi Hesabı:** Haftalık yemek planında gereken malzemelerden evde bulunan kiler stoklarının otomatik olarak düşülmesi formülü:
   $$\text{Net İhtiyaç} = \max(0, \text{Gereken Miktar} - \text{Mevcut Stok})$$

#### BİLEREK ALINMAYAN Kısımlar ve Gerekçeleri:
1. **Anthropic Bulut API Çağrıları ÇIKARILDI:** Pantry Host varsayılan olarak malzeme listesini Anthropic Claude API'sine göndermektedir. RutinFit'in gizlilik ve yerel-first ilkesi gereğince tüm AI tarif ve kiler işlemleri yerel Ollama/LM Studio modellerine bağlanmıştır.
2. **PGlite Veritabanı ALINMADI:** İkinci bir veritabanı açılmamış, RutinFit'in mevcut SQLite şemasına `PantryItem` tablosu eklenmiştir.
* **İlgili RutinFit Dosyaları:**
  * [`src/lib/pantry-service.ts`](file:///Users/memir/Projects/fitness/src/lib/pantry-service.ts)
  * [`src/app/pantry/page.tsx`](file:///Users/memir/Projects/fitness/src/app/pantry/page.tsx)
  * [`src/app/api/pantry/route.ts`](file:///Users/memir/Projects/fitness/src/app/api/pantry/route.ts)
  * [`tests/pantry.test.ts`](file:///Users/memir/Projects/fitness/tests/pantry.test.ts)

---

### 2.5 Diet App
* **Geliştirici:** whiteravens20
* **Kaynak Deposu:** `https://github.com/whiteravens20/diet-app`
* **Doğrulanmış Lisans:** **AGPL-3.0** *(Önceki taslaklarda bahsedilen PolyForm Noncommercial lisansı güncel depoda geçersizdir)*.
* **Kullanım Durumu:** **`reference only`** (Yalnızca Kavramsal Referans)

#### Neden Hiçbir Kodu Alınmadı?
1. **AGPL-3.0 Lisans Riski:** Kod kopyalanması durumunda tüm projenin lisanslanma zorunluluğu doğar.
2. **Erken Aşama / Kararsız Kod:** Proje README'sinde geliştiricinin "early development, not production-ready" uyarısı yer almaktadır.
3. **Temiz Oda (Clean-Room) Yaklaşımı:** Çok günlük menü planlama, hedef kaloriye göre porsiyon ölçekleme ve malzeme tekrar kullanımı mantığı depodaki kodlara bakılmaksızın bağımsız olarak [`src/lib/nutrition-calculator.ts`](file:///Users/memir/Projects/fitness/src/lib/nutrition-calculator.ts) içinde sıfırdan yazılmıştır.

---

### 2.6 Meals (YAMP)
* **Geliştirici:** marco308
* **Kaynak Deposu:** `https://github.com/marco308/meals`
* **Doğrulanmış Lisans:** Çekirdek: **AGPL-3.0**; `ios/` klasörü: Özel Şartlar.
* **Kullanım Durumu:** **`deferred / reference only`** (Ertelendi)

#### Neden Entegre Edilmedi?
* Meals projesinin sunduğu araç (tool) ve MCP (Model Context Protocol) fikirleri incelenmiştir. Ancak RutinFit'in önceden geliştirdiği iki aşamalı onay (`ActionDraft`, `approvalTokenHash`, `AuditEvent`) mekanizması, Meals'ın doğrudan yürütme mantığına kıyasla kullanıcı güvenliği açısından çok daha üstün bulunmuştur. AGPL kodu kopyalama ihtiyacı doğmamıştır.

---

### 2.7 MuscleMapJS & MuscleMap SwiftUI SDK
* **Geliştiriciler:** abdofallah (JS/TS Portu), Melih Çolpan (Orijinal SwiftUI SDK)
* **Kaynak Depoları:**
  * MuscleMapJS: `https://github.com/abdofallah/MuscleMapJS`
  * MuscleMap SwiftUI SDK: `https://github.com/MuscleMap/MuscleMap`
* **Doğrulanmış Lisans:** **MIT License** (Her iki projede de MIT)
* **Kullanım Durumu:** **`adopted`** (Gömülebilir Arayüz Bileşeni)

#### Alınan ve Uyarlanan Kısımlar:
1. **Anatomik SVG Vektörleri:** Ön ve arka insan vücudundaki 36 kas grubunun (Pektoralis, Deltoid, Biceps, Triceps, Latissimus, Trapez, Quadriceps, Hamstrings, Glutes, Calves vb.) anatomik sınır koordinatları.
2. **Sıfır Bağımlılıklı React Bileşeni:** Orijinal kütüphanenin Canvas bağımlılığı, Retina ekranlarda pürüzsüz vektör ölçekleme sağlayan saf bir React/SVG bileşenine dönüştürülmüştür (`<MuscleHeatmap />`).
3. **Yorgunluk Skalası:** Kullanıcının son 7 gündeki set hacmine göre kaslar dinamik renklendirilir; kas üzerine tıklandığında toparlanma önerisi gösterilir.
4. **Lisans Atfı:** Melih Çolpan ve abdofallah telif bildirimleri [`THIRD_PARTY_NOTICES.md`](file:///Users/memir/Projects/fitness/THIRD_PARTY_NOTICES.md) içine eklenmiştir.
* **İlgili RutinFit Dosyaları:**
  * [`src/components/MuscleHeatmap.tsx`](file:///Users/memir/Projects/fitness/src/components/MuscleHeatmap.tsx)
  * [`src/app/workouts/page.tsx`](file:///Users/memir/Projects/fitness/src/app/workouts/page.tsx)
  * [`src/app/opengym/page.tsx`](file:///Users/memir/Projects/fitness/src/app/opengym/page.tsx)

---

## 3. Lisans Güvenliği ve Copyleft İzolasyon Mimarisi

RutinFit, AGPL-3.0 ve ticari telif risklerine karşı şu yasal koruma kalkanını uygular:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RUTİNFİT DESKTOP BİLEŞENİ                      │
│                (Temiz Oda / Bağımsız Kod Tabanı)                       │
├────────────────────────────────────────────────────────────────────────┤
│  ✓ Sıfır AGPL Kütüphane / Kaynak Kod Bağımlılığı                       │
│  ✓ Tamamen MIT / Apache 2.0 / BSD İzin Verici Kütüphaneler             │
│  ✓ Gym Visual Telifli Medyaları Barındırmaz                            │
└──────────────────┬──────────────────────────────────┬──────────────────┘
                   │ Loopback HTTP (İsteğe Bağlı)     │ HTTPS / ODbL
                   ▼                                  ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│  Bağımsız openGym Süreci (Varsa)     │  │  Open Food Facts API         │
│  - AGPL Sınırı Loopback'te Kalır     │  │  - ODbL 1.0 Atfı ile         │
│  - Kodlar Birbirine Link Edilmez     │  │  - Sadece Veri Alımı Yapılır │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

1. **Link Etmeme (No Static/Dynamic Linking):** AGPL lisanslı hiçbir proje RutinFit ikili dosyasına bağlanmaz.
2. **Temiz Oda Mühendisliği:** Yalnızca fikir ve matematiksel konseptler incelenir; tüm kodlar bağımsız olarak TypeScript ve Rust ile yeniden yazılır.
3. **Eksiksiz Atıf:** MIT ve ODbL gereklilikleri arayüzde ve bildirim dosyalarında tam olarak yerine getirilir.

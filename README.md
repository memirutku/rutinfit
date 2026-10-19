# 🏋️‍♂️ RutinFit Desktop

<p align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/activity.svg" width="64" height="64" alt="RutinFit Logo" />
</p>

<p align="center">
  <strong>Yoğun Çalışanlar İçin Tek Pencerede Çalışan, Gizlilik Odaklı Kişisel Fitness, Beslenme ve Ritim Asistanı</strong><br>
  <em>Tauri 2 · Next.js 15 · React 19 · Prisma SQLite · Yerel AI (Ollama & LM Studio) · Sıfır Docker Zorunluluğu</em>
</p>

<p align="center">
  <a href="https://github.com/memirutku/rutinfit/actions/workflows/ci.yml"><img src="https://github.com/memirutku/rutinfit/actions/workflows/ci.yml/badge.svg" alt="CI Durumu" /></a>
  <a href="tests/"><img src="https://img.shields.io/badge/Vitest-72%20passing-10b981.svg?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest 72 Passing" /></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-15.2.0-000000.svg?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 15" /></a>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-2.12-24c8db.svg?style=for-the-badge&logo=tauri&logoColor=white" alt="Tauri 2" /></a>
  <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/Prisma-6.4.0%20SQLite-2d3748.svg?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma SQLite" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License" /></a>
</p>

---

## 🌟 Neden RutinFit Desktop?

Geleneksel fitness ve beslenme uygulamaları verilerinizi bulutta saklar, her özellik için ayrı bir web sekmesi veya karmaşık Docker servisleri (örn. openGym port 8080) çalıştırmanızı gerektirir. 

**RutinFit**, tüm bu karmaşayı tek bir hafif masaüstü penceresinde birleştirir:
* 🔒 **%100 Yerel-First ve Gizli:** Tüm sağlık, besin, kilo ve egzersiz kayıtlarınız yalnızca kendi bilgisayarınızda SQLite üzerinde tutulur.
* ⚡ **Tek Pencere Deneyimi:** OpenGym antrenman sistemi, interaktif kas haritası, plaka hesabı, kiler envanteri ve AI koçu aynı çatı altındadır; **iframe veya harici port sekmesi açılmaz**.
* 🚫 **Sıfır Docker Gereksinimi:** Son kullanıcının Docker, OrbStack veya port konfigürasyonuyla uğraşması gerekmez.
* 🧮 **Deterministik Matematik:** Kaloriler ve makrolar yapay zeka tahminleriyle değil, onaylı 100g gıda verileriyle kuruşu kuruşuna hesaplanır.
* 🛡️ **2-Aşamalı Onaylı Yerel AI:** Ollama veya LM Studio ile çevrimdışı çalışır; kullanıcı açıkça "Onayla" butonuna basmadan veritabanında hiçbir kayıt değişmez.
* ⏱️ **Günün Ritmi & Kolay Kullanım:** Eve varış saatinize duyarlı ritim çizelgesi, son kullanılan besinler, 7 saniyelik geri alma (Undo) ve otomatik dinlenme sayaçlı set takibi.

---

## 🚦 Özellik Durum Matrisi (Feature Status Matrix)

RutinFit'in tüm yetenekleri gerçek kod tabanı ve testlerle doğrulanmış 3 net seviyede sınıflandırılır:

| Modül | Özellik | Durum | Açıklama |
|---|---|:---:|---|
| **Beslenme & Kiler** | 2.080 kcal Sakin Hedef & 2.100 kcal Üst Sınır Uyarısı | 🟢 **Hazır** | Suçlayıcı olmayan bildirimler, deterministik makro dağılımı. |
| **Beslenme & Kiler** | Hızlı Öğün Kaydı, Son Kullanılanlar & Geri Alma (Undo) | 🟢 **Hazır** | Tek tıkla besin seçimi, LIFO 5 öğeli geçmiş ve 7s geri alma toast'ı. |
| **Beslenme & Kiler** | Kiler Envanteri & Eksiklerden Otomatik Alışveriş Listesi | 🟢 **Hazır** | Kilerdeki gramajı menüden düşüp yalnızca net eksiği listeleme. |
| **Beslenme & Kiler** | Open Food Facts Paketli Gıda Arama & Önbellek | 🟡 **Beta** | ODbL uyumlu SQLite önbellek istemcisi (`openfoodfacts-client.ts`). |
| **Antrenman & Vücut** | İnteraktif SVG Kas Haritası (`MuscleHeatmap`) | 🟢 **Hazır** | Son 7 gündeki set hacmine göre ön ve arka kasları renklendirme. |
| **Antrenman & Vücut** | Olimpik Bar & 1RM Plaka Hesaplayıcı (`PlateCalculator`) | 🟢 **Hazır** | 20kg bar manşon çizimi ve Brzycki/Epley 1RM formülleri. |
| **Antrenman & Vücut** | Set Tamamlama, Dinlenme Sayacı & Kaldığın Yerden Devam | 🟢 **Hazır** | Otomatik geri sayım sayacı, yerel draft kurtarma (`localStorage`). |
| **Antrenman & Vücut** | openGym İsteğe Bağlı Sidecar Entegrasyonu | 🟡 **Beta** | Docker gerektirmeyen bağımsız veri modeli ve dışa aktarım köprüsü. |
| **Yerel AI & Ritim** | Günün Sıradaki Adımı / Ritim Çizelgesi | 🟢 **Hazır** | Sabah hidrasyonu, öğle beslenmesi, 19:40 iş çıkışı ve uyku adımları. |
| **Yerel AI & Ritim** | 2-Aşamalı Onaylı Yerel AI Koçu (Ollama / LM Studio) | 🟢 **Hazır** | `ActionDraft` ve `AuditLog` ile kullanıcı onayı olmadan DB'ye yazmama. |
| **Yerel AI & Ritim** | Güvenli Çoklu Dosya Ayrıştırıcıları (PDF, XLSX, DOCX, TXT) | 🟢 **Hazır** | `<untrusted_content>` izolasyonu ve Zod doğrulaması. |
| **Sistem & Veri** | 14 Tablolu Transactional SQLite Yedekleme & Geri Yükleme | 🟢 **Hazır** | `prisma.$transaction` ile kiler dahil tam tablolu sıfır veri kaybı. |
| **Sistem & Veri** | Canlı Sistem Tanılama & Performans Ekranı | 🟢 **Hazır** | SQLite dosya boyutu, RSS bellek ve çalışma süresi izleme. |
| **Masaüstü Dağıtımı** | Tauri 2 Masaüstü Geliştirici Modu (`pnpm desktop:dev`) | 🟡 **Beta** | Kaynak koddan derleme, yerel WebKit/WebView2 penceresi. |
| **Masaüstü Dağıtımı** | İmzalı Tek Tıkla Kurulum Paketleri (`.dmg`, `.msi`, `.deb`) | 🔵 **Planlanıyor** | GitHub Releases üzerinden imzalı bağımsız kurulum dosyaları. |
| **Mobil / Donanım** | Apple Health / Health Connect Dışa Aktarımı | 🔵 **Planlanıyor** | Akıllı saat ve sağlık verisi senkronizasyon köprüsü. |

---

## 🏛️ Mimari Şema

```mermaid
flowchart TD
    subgraph Client ["🖥️ İstemci Katmanı (Masaüstü Tek Pencere)"]
        Window["Tauri 2 Yerel Masaüstü Penceresi (macOS WebKit / Windows WebView2)\n1280 × 840 Çözünürlük · Tek Arayüz ve Navigasyon"]
        UI["React 19 + Tailwind CSS v3.4\nDashboard · Beslenme · Kiler · Kas Haritası · Plaka Hesabı · AI Koç"]
        Window --- UI
    end

    subgraph Security ["🔒 Güvenlik & Süreç Yönetimi"]
        RustCore["Tauri 2 Rust Çekirdeği"]
        Loopback["Loopback IPC (127.0.0.1)\nDinamik Port · Sıfır Port Çakışması · Otomatik Kapanma"]
        RustCore --- Loopback
    end

    subgraph Engine ["⚙️ Yönetilen Arka Plan Motoru (Node.js / Next.js 15)"]
        FileParsers["Çoklu Dosya Ayrıştırıcıları\n(PDF, XLSX, DOCX, TXT)"]
        NutriEngine["Deterministik Besin Motoru\n(2.080 kcal / 2.100 kcal Tavanı)"]
        AIEngine["2-Aşamalı Onaylı AI Koçu\n(ActionDraft & AuditLog)"]
        PlateEngine["Olimpik Plaka & 1RM Motoru"]
    end

    subgraph Storage ["💾 Korumalı Yerel Depolama (OS AppData)"]
        SQLite[("SQLite Veritabanı (Prisma 6.4)\n~/Library/Application Support/RutinFit/rutinfit.db")]
        Backups[("Otomatik Yedekler\n.../RutinFit/backups/")]
    end

    subgraph External ["🌐 Dış Sağlayıcılar (Yalnızca İsteğe Bağlı)"]
        LocalAI["Yerel LLM (Ollama / LM Studio)\n127.0.0.1:11434 veya :1234"]
        OFF["Open Food Facts REST API\n(Yalnızca paketli gıda aramasında, ODbL Önbellekli)"]
    end

    UI <--> Loopback
    Loopback <--> Engine
    Engine <--> SQLite
    SQLite -.-> Backups
    AIEngine <--> LocalAI
    Engine <--> OFF
```

---

## 📸 Görsel Özellik Vitrini (Feature Showcase)

### 1. 📊 Akıllı Beslenme, Ritim ve Kiler Yönetimi
> **2.080 kcal sakin hedef**, suçlayıcı olmayan 2.100 kcal üst tavanı, 4 öğünlük günlük yemek planı ve evdeki malzemeleri kilerde tutup eksikleri otomatik çıkaran alışveriş listesi.

```
┌────────────────────────────────────────────────────────────────────────┐
│ GÜNLÜK KALORİ & MAKRO HEDEFİ                                           │
├────────────────────────────────────────────────────────────────────────┤
│ Kalori:  1.420 / 2.080 kcal  [████████████████░░░░░░░░] %68 (Sakin Mod)│
│ Protein:   125 /   165 g     [███████████████████░░░░░] %75            │
│ Karb:      150 /   220 g     [██████████████░░░░░░░░░░] %68            │
│ Yağ:        42 /    60 g     [████████████████░░░░░░░░] %70            │
├────────────────────────────────────────────────────────────────────────┤
│ Porsiyon Çarpanları: [ 0.5x Yarım ]  [ 1.0x Standart ]  [ 1.5x Doyurucu]│
│ Kiler Farkı: 500g Yulaf Menüde - 300g Evde = 200g Alışveriş Listesinde │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2. 🧬 Kas Yorgunluk & Toparlanma Haritası (`<MuscleHeatmap />`)
> `abdofallah/MuscleMapJS` (MIT) ve Melih Çolpan'ın orijinal anatomik modelinden türetilen, **son 7 gündeki set hacminize göre** ön ve arka vücut kaslarını interaktif renklendiren SVG haritası.

```
┌───────────────────────────────────────┬────────────────────────────────┐
│  ÖN VÜCUT (Anterior)   ARKA (Posterior)│ SEÇİLİ KAS DETAYI: GÖĞÜS       │
│                                       ├────────────────────────────────┤
│         ( o )               ( o )     │ Pectoralis Major & Minor       │
│        /  |  \             /  |  \    │ Durum: Yüksek Yorgunluk 🔴     │
│       [ GÖĞÜS ]           [ SIRT  ]   │ Haftalık Hacim: 8 Set          │
│       [ KARIN ]           [ BEL   ]   │ Son Seans: Dün (19:40)         │
│       [ BACAK ]           [ KALÇA ]   │ Öneri: 48 saat dinlenme        │
│                                       │ Egzersizler: Bench Press, Dips │
├───────────────────────────────────────┴────────────────────────────────┤
│ Lejant:  🟢 Dinlenmiş (0-3 set)  🟡 Toparlanıyor (4-7)  🔴 Yorgun (8+)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 3. 🏋️ Olimpik Bar & 1RM Plaka Hesaplayıcı (`<PlateCalculator />`)
> Hedef ağırlığa göre 20kg barın her iki tarafına takılması gereken plakaları renk kodlarıyla hesaplar ve bar manşonunu görsel olarak çizer.

```
┌────────────────────────────────────────────────────────────────────────┐
│ HEDEF AĞIRLIK: 100 kg   ·   BAR: 20 kg Olimpik Bar   ·   KLİPS: 0 kg   │
├────────────────────────────────────────────────────────────────────────┤
│ Her Tarafa Takılacak: 40 kg  ===>  [ 1 × 20kg 🟦 ] + [ 1 × 20kg 🟦 ]   │
│                                                                        │
│ BAR ===|===[ 20kg Mavi ]===[ 20kg Mavi ]===(Kilit)                     │
├────────────────────────────────────────────────────────────────────────┤
│ 1RM Formülü (Brzycki & Epley): 100 kg × 5 tekrar ===> Tahmini 1RM: 115kg│
│ Çalışma Yüzdeleri: %90 = 102.5kg  ·  %85 = 97.5kg  ·  %80 = 92.5kg     │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 4. 🤖 Güvenli İki Aşamalı AI Planlama Döngüsü

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 Kullanıcı
    participant UI as 🖥️ Masaüstü UI
    participant Core as ⚙️ RutinFit Motoru
    participant LocalAI as 🧠 Yerel AI (Ollama/LM Studio)
    participant DB as 💾 SQLite (AppData)

    User->>UI: "Bu haftaki antrenmanımı ve menümü hazırla" (veya PDF/XLSX yükler)
    UI->>Core: Dosya ayrıştırma & <untrusted_content> izolasyonu
    Core->>LocalAI: Güvenli sistem promptu & Zod şeması
    LocalAI-->>Core: JSON Eylem Taslağı (ActionDraft)
    Core-->>UI: Görsel Değişiklik Önizleme Kartı (Diff & Makrolar)
    Note over UI,User: Kullanıcı Onayı Olmadan DB'ye Asla Yazılmaz!
    User->>UI: ✅ "Onayla ve Plana Ekle" butonuna basar
    UI->>Core: Onay belirteci (approvalToken) ile commit
    Core->>DB: Deterministik hesaplama & SQLite kaydı
    DB-->>UI: Plan başarıyla güncellendi bildirimi
```

---

## 📚 Açık Kaynak Repolar ve Yasal Atıf Tablosu

RutinFit, açık kaynak ekosistemine saygı duyar ve tüm kaynakları doğrulanmış lisanslarıyla açıkça listeler:

| Proje / Kaynak | Doğrulanmış Lisans | Kullanım Durumu | RutinFit'teki Kesin Rolü |
|---|---|---|---|
| **openGym**<br>[GitHub](https://github.com/DuarteSantos8/openGym) · [Gitea](https://gitea.com/DuarteSantos/openGym) | **AGPL-3.0**<br>(Görseller: **Gym Visual** Telifli) | **`adapted`** | Egzersiz ve set/rep veri modelleri yerel SQLite şemamıza uyarlandı. AGPL copyleft ve telifli görsel riskleri nedeniyle web kodu kopyalanmadı. |
| **Open Food Facts**<br>[GitHub](https://github.com/openfoodfacts/openfoodfacts-server) | Sunucu: **AGPL-3.0**<br>DB: **ODbL 1.0**<br>Görseller: **CC BY-SA** | **`external API`** | Paketli gıda ve barkod arama istemcisi (`openfoodfacts-client.ts`). SQLite önbellek katmanı ve ODbL atıfı eklendi. |
| **Tally**<br>[GitHub](https://github.com/GeneArnold/tally) | **MIT**<br>(Telif: 2026 Gene Arnold) | **`adapted`** | Ergonomik porsiyon çarpanları (`0.5x`, `1.0x`, `1.5x`) ve anlık makro geri bildirim UX kalıpları uyarlandı. |
| **Pantry Host**<br>[GitHub](https://github.com/jpdevries/pantry-host) | **MIT**<br>(Telif: 2026 JP de Vries) | **`adapted`** | Kiler envanteri (`PantryItem`) ve tariflerden net alışveriş listesi çıkarma mantığı uyarlandı. Anthropic çağrısı yerel AI ile değiştirildi. |
| **Diet App**<br>[GitHub](https://github.com/whiteravens20/diet-app) | **AGPL-3.0** | **`reference only`** | Hedefe göre menü planlama konsepti kavramsal incelendi. AGPL lisansı nedeniyle hiçbir kaynak kod kopyalanmadı. |
| **Meals**<br>[GitHub](https://github.com/marco308/meals) | Çekirdek: **AGPL-3.0** | **`deferred`** | AI araçları ve MCP mimarisi incelendi. RutinFit'in kendi 2-aşamalı onaylı motoru daha güvenli olduğu için kod birleştirmesi yapılmadı. |
| **MuscleMapJS**<br>[GitHub](https://github.com/abdofallah/MuscleMapJS) | **MIT**<br>(Melih Çolpan türevi) | **`adopted`** | Ön ve arka vücut interaktif SVG kas yorgunluk haritası (`src/components/MuscleHeatmap.tsx`) olarak uyarlandı. |
| **MuscleMap SwiftUI SDK**<br>[GitHub](https://github.com/MuscleMap/MuscleMap) | **MIT**<br>(Telif: Melih Çolpan) | **`reference only`** | MuscleMapJS'in orijinal iOS kaynak projesi; anatomik gruplama referansı ve lisans atfı olarak belgelendi. |

Ayrıntılı teknik analizler ve raporlar için:
* 🏛️ [**Mimari Kararlar ve Teknoloji Yığını Kılavuzu**](docs/ARCHITECTURE_AND_TECH_STACK.md)
* 🔬 [**Açık Kaynak Repolar ve Entegrasyon Derinlemesine İnceleme**](docs/OPEN_SOURCE_INTEGRATION_DEEP_DIVE.md)
* 🧪 [**Mimari Doğrulama ve Test Raporu (Walkthrough)**](docs/WALKTHROUGH.md)
* 📋 [`docs/OPEN_SOURCE_COMPONENTS.md`](docs/OPEN_SOURCE_COMPONENTS.md)
* ⚖️ [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)

---

## 🚀 Kurulum ve Çalıştırma

> [!NOTE]
> **Son Kullanıcı / Dağıtım Durumu Bildirimi:**  
> RutinFit şu an aktif açık kaynak geliştirici önizleme aşamasındadır. Önceden derlenmiş tek tıkla kurulan `.dmg` veya `.msi` yükleyicileri henüz GitHub Releases'da yayınlanmamıştır; mevcut aşamada Node.js ve pnpm ile kaynak koddan çalıştırılmaktadır.

### 💻 Geliştirici Kurulumu

#### Sistem Gereksinimleri
* **İşletim Sistemi:** macOS (Apple Silicon veya Intel), Windows 10/11 (WebView2 ile) veya Linux (Ubuntu 22.04+)
* **Node.js:** v20.0+ (Node v22.18+ önerilir)
* **Paket Yöneticisi:** `pnpm` v9+ (`npm install -g pnpm`)
* **Rust & Cargo:** v1.80+ (Tauri 2 masaüstü derleyicisi için zorunludur)
* *(İsteğe bağlı)* **Yerel AI:** [Ollama](https://ollama.com) veya [LM Studio](https://lmstudio.ai)
* **ÖNEMLİ:** Docker veya harici port yapılandırması kurmanız **gerekmez**.

#### 1. Depoyu Klonlama ve Bağımlılıkları Yükleme
```bash
git clone https://github.com/memirutku/rutinfit.git
cd rutinfit

# Bağımlılıkları yükleyin
pnpm install
```

#### 2. Yerel Veritabanını Başlatma
```bash
# SQLite şemasını senkronize edin ve başlangıç şablon verilerini yükleyin
pnpm run db:push
pnpm run db:seed
```

#### 3. Testleri ve Tür Denetimini Çalıştırma
```bash
# 14 test dosyasında 72 testi çalıştırır
pnpm test

# TypeScript tür denetimi
pnpm exec tsc --noEmit

# ESLint statik kod analizi
pnpm lint
```

#### 4. Uygulamayı Başlatma
* **Masaüstü Penceresi (Tauri 2 Yerel Mod):**
  ```bash
  pnpm run desktop:dev
  ```
* **Web Tarayıcısı Geliştirici Modu:**
  ```bash
  pnpm dev -p 3005
  ```
  Tarayıcınızda açın: `http://localhost:3005`

---

## 🤖 Yerel Yapay Zeka Bağlantısı (Ollama & LM Studio)

RutinFit, kişisel sağlık ve besin verilerinizi asla harici bir bulut sunucusuna göndermez:

1. **Ollama ile:**
   ```bash
   ollama run llama3.2
   ```
   RutinFit içindeki **Ayarlar** sekmesinde Sağlayıcı olarak `Ollama` (`http://127.0.0.1:11434/v1`) ve Model olarak `llama3.2` seçip **"Bağlantıyı Test Et"** butonuna basın.
2. **LM Studio ile:**
   * LM Studio'yu açın, **Developer / Local Server** sekmesinden sunucuyu başlatın (`http://127.0.0.1:1234/v1`).
   * RutinFit **Ayarlar** sekmesinde Sağlayıcı olarak `LM Studio` seçin.

---

## 🛡️ Güvenlik Politikası ve Desteklenen Platformlar

* **Güvenlik Politikası:** Güvenlik açıklarını bildirmek için lütfen [SECURITY.md](SECURITY.md) dosyasını inceleyiniz.
* **Katkıda Bulunma:** Projeye katkıda bulunmak için [CONTRIBUTING.md](CONTRIBUTING.md) ve [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) rehberlerini takip ediniz.
* **Üçüncü Taraf Lisans Bildirimleri:** Tüm kütüphane ve model atıfları [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) dosyasında belgelenmiştir.

---

## 📄 Lisans

RutinFit, **[MIT Lisansı](LICENSE)** altında açık kaynak olarak dağıtılmaktadır.  
Telif Hakkı (c) 2026 RutinFit Katkıda Bulunanları.

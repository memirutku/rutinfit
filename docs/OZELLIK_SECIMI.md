# RutinFit özellik seçimi

Rakip analizinden çıkan 86 özellik ve 5 hatanın seçim sonucu (30 Ekim 2026).

- Kaynak analiz: `reports/RutinFit rakip analizi ve özellik fırsatları.md`
- Seçim sayfası: https://claude.ai/artifact/HvRgZNxwiS5iZgGQ8ismgT
- Boyut: **S** birkaç gün, **M** 1–3 hafta, **L** 3 haftadan uzun (tek geliştirici tahmini).

## Özet

| Durum | Sayı |
| --- | --- |
| Uygulanacak hata | 4 (H5 zaten düzeltildi) |
| Uygulanacak özellik | 44 (bunların 10 tanesi daraltılmış kapsamla) |
| Evet denip fazla karmaşık bulunan, sonraya bırakılan | 18 |
| Belki | 14 |
| Hayır | 10 |

Sonraya bırakılan, belki ve hayır listeleri silinmedi. İleride buradan geri alınabilir.

## 1. Uygulanacaklar

Kapsam notu olan satırlar daraltıldı: notta yazan kısım yapılır, gerisi sonraya kalır.

### Hatalar

| Kod | Özellik | Boyut | Bağımlı olduğu | Kapsam notu |
| --- | --- | --- | --- | --- |
| H1 | CSV içe aktarmada ağırlık sessizce 0 oluyor | S | — |  |
| H2 | CSV içe aktarmada bazı sütunlar atılıyor | M | H1 |  |
| H3 | İçe aktarılan RPE kaydedilmiyor | S | — |  |
| H4 | İçe aktarılan setlerde “hedef tuttu” sabit 8 tekrara bakıyor | S | — |  |

### Beslenme

| Kod | Özellik | Boyut | Bağımlı olduğu | Kapsam notu |
| --- | --- | --- | --- | --- |
| F01 | Kayıtlı öğünler ve öğün/gün kopyalama | S | — |  |
| F02 | Akıllı gıda araması: FTS5, sıklık ve yakınlık ağırlığı, doğrulanmış kayıtlar önce | M | F80 | FTS5 yok. Katalog bugün 18 gıda, Türk yemekleriyle birkaç yüze çıkar; Türkçe harf normalizasyonu ile sıklık ve yakınlık sıralaması bellek içinde yeterli. |
| F03 | Etiketten hızlı yerel ürün oluşturma (barkod OFF'ta yoksa tek ekranlık form) | S | — |  |
| F06 | Doğal dille metin kaydı ("1 kase mercimek çorbası") → katalog eşleme → onay; sayılar katalogdan gelir, kaynakları gösterilir | M | F73, F74, F02 |  |
| F09 | Kurulum sihirbazı: TDEE (Mifflin-St Jeor + aktivite), hedef, kilo kaybı hızı, tahmini varış tarihi | M | F56 |  |
| F10 | Adaptif TDEE: düzeltilmiş kilo trendi + alınan enerji dengesi, uyumdan bağımsız | M | F09 |  |
| F13 | Su takibi (+ kafein ve alkol) | S | — |  |
| F14 | Aralıklı oruç zamanlayıcısı | S | F76 |  |
| F15 | Kreatin takibini ilaç ve takviye takibine genelleştirme (GLP-1 dahil: doz, hatırlatma, yan etki) | M | F83 | Birden çok takviye ve hatırlatma. GLP-1 dozu ve yan etki takibi yok. |
| F16 | Vücut ölçüleri ve sağlık metrikleri (bel dışındaki ölçüler, kan basıncı, dinlenik nabız, BMI/bel-boy oranı, trend grafikleri) + yerelde saklanan ilerleme fotoğrafları | M | — |  |

### Antrenman

| Kod | Özellik | Boyut | Bağımlı olduğu | Kapsam notu |
| --- | --- | --- | --- | --- |
| F17 | Şablon/program editörü (oluştur, düzenle, sırala, tekrar aralığı, dinlenme süresi) | M | F25 |  |
| F18 | Hazır program kütüphanesi (önce başlangıç ve ev/vücut ağırlığı programları, ardından 5/3/1, GZCLP, PPL) | M | F17, F21 | 3–5 başlangıç ve ev programı. 5/3/1, GZCLP ve PPL sonraya. |
| F19 | Set tipleri (ısınma, drop, tükeniş) ve süperset/devre | M | F17, H1 | Yalnız set tipi (ısınma, normal, drop, tükeniş). Süperset ve devre yok. |
| F20 | Set başına RPE/RIR | S | — |  |
| F21 | Gelişmiş ilerleme: egzersiz başına artış, durağanlık tespiti, deload/mezosikl, RPE tabanlı ilerleme | M | F17, F20 | Egzersiz başına artış miktarı ve durağanlık uyarısı. Deload, mezosikl ve RPE tabanlı ilerleme yok. |
| F22 | Isınma seti hesaplayıcısı | S | — |  |
| F23 | PR takibi + e1RM trendi + egzersiz geçmişi grafikleri (tüm zamanlar için ücretsiz) | M | — |  |
| F24 | Kas grubu başına haftalık set/hacim grafiği ve hedef aralığı (örneğin 10–20 set) | M | — |  |
| F25 | Egzersiz kütüphanesi (metin ipuçları, kaslar, ekipman, özel egzersiz, "benzeriyle değiştir"; videosuz) | M | — |  |
| F27 | Koşu, kardiyo ve yürüyüş kaydı (mesafe, süre, tempo, ortalama nabız, RPE) + GPX/FIT/TCX içe aktarma | M | H1 | Elle kayıt (mesafe, süre, tempo, nabız, RPE). GPX/FIT/TCX dosyası yok; saat verisi F62 ile gelir. |
| F28 | Metinden antrenman ayrıştırma ("squat 3x8 80 kg") → onaylı seans/şablon | M | F17, F25 |  |

### Plan, kiler ve market

| Kod | Özellik | Boyut | Bağımlı olduğu | Kapsam notu |
| --- | --- | --- | --- | --- |
| F30 | Yemek planı takvim editörü (haftalık görünüm, ekle/taşı/kopyala/sil, sürükle-bırak, kayıtlı menü ve şablonlar) | M | — | Haftalık görünüm ile ekle, taşı, kopyala ve sil. Sürükle-bırak ve ayrı şablon sistemi yok; şablon yerine F01 kullanılır. |
| F31 | Serbest porsiyon ölçekleme ve hane büyüklüğü (0,5/1/1,5× ötesinde) | S | F30 |  |
| F33 | Tarif URL içe aktarma (schema.org + malzeme ayrıştırma + onaylı katalog eşleme) | M | F73, F02 |  |

### AI koç

| Kod | Özellik | Boyut | Bağımlı olduğu | Kapsam notu |
| --- | --- | --- | --- | --- |
| F49 | Haftalık check-in: uyum yüzdesi, kilo trendi, antrenman hacmi, tek öneri; hedef değişikliği gerekçeli ve onaylı | M | F10, F57 |  |
| F50 | Kullanıcının kendi geçmişi üzerinde soru-cevap (5–10 sabit tipli sorgu aracı, grafik ve kaynak satırları) | M | F57 |  |
| F51 | Manuel hazır olma skoru (uyku, kas ağrısı, stres, enerji, ruh hâli + 7/28 günlük seans yükü); adlandırılmış katkılar ve bant; düşük bantta kısaltılmış antrenman önerisi | M | F20 | Mevcut günlük durum girdileriyle basit skor, bant ve öneri. 7/28 günlük yük oranı yok. |
| F52 | Görünür, düzenlenebilir ve onaylı koç hafızası (alerji, sakatlık, ekipman, çalışma düzeni) | M | — | Ayarlarda düzenlenebilir "Koça notlar" alanı (alerji, sakatlık, ekipman). AI'ın kendiliğinden hafıza çıkarması yok. |
| F56 | Yeme bozukluğu ve tıbbi güvenlik önlemleri (kalori tabanı, azami kilo kaybı hızı, sayıları gizleme modu, kırmızı bayrakta profesyonele yönlendirme) | S | — |  |
| F57 | Açıklanabilirlik: her önerinin yanında kullanılan girdiler, sayılar ve grafik | M | — |  |
| F58 | AI ifşası ve kontroller ("AI tarafından üretildi, hatalı olabilir" etiketi, koçu açma/kapama, ton, dürtme sıklığı) | S | — |  |

### Veri, gizlilik ve entegrasyon

| Kod | Özellik | Boyut | Bağımlı olduğu | Kapsam notu |
| --- | --- | --- | --- | --- |
| F60 | CSV dışa aktarma (besin günlüğü, Strong/Hevy uyumlu antrenman, vücut metrikleri; belgelenmiş şema) | S | — |  |
| F61 | Kullanıcının seçtiği klasöre zamanlanmış otomatik yedek/dışa aktarma (Syncthing ve iCloud uyumlu, saklama süreli) | S | — |  |
| F62 | Apple Health export.zip içe aktarma (akışlı ayrıştırma, içe aktarılan kayıtlar salt okunur, kalorilerin çift sayılmasını önleme) | M | F16 |  |
| F67 | Şeffaflık paketi: "cihazdan ne çıkar" tablosu, kullanılan AI uç noktası göstergesi, api.openai.com seçilince açık uyarı, Ollama/LM Studio'nun yalnız localhost'ta dinlediğinin kontrolü, imzalı sürüm ve SHA-256 özeti, Türkçe "Hesap yok, bulut yok" mesajı | S | — |  |

### Türkiye

| Kod | Özellik | Boyut | Bağımlı olduğu | Kapsam notu |
| --- | --- | --- | --- | --- |
| F73 | Gıda başına ev ölçüleri (yemek, tatlı ve çay kaşığı; su ve çay bardağı; kepçe, kase, dilim, adet, avuç) ve gram karşılıkları | M | — |  |
| F74 | Türk ev yemekleri kataloğu (mercimek çorbası, bulgur pilavı, kuru fasulye, karnıyarık, simit, pide, lahmacun, ayran…); değerler RutinFit tariflerinden türetilir | M | F73 |  |
| F76 | Ramazan modu (Sahur/İftar öğünleri, il bazlı çevrimdışı imsak/iftar saatleri, iftar–sahur arası su hedefi, kalori dağılımı, antrenman zamanı önerisi, hatırlatıcılar) | M | F13, F83 |  |
| F77 | Diyetisyene haftalık/aylık PDF veya XLSX rapor (kilo trendi, plana göre alım, uyum yüzdesi, antrenmanlar, notlar) | M | F60, F78 |  |
| F78 | İçe aktarılan diyetisyen planına öğün başına uyum takibi (uygulandı / kısmen / atlandı) | S | — |  |
| F79 | Çay (şeker küpü sayısıyla), Türk kahvesi, simit ve ekmek dilimi için hızlı ekleme | S | F01, F13 |  |
| F80 | Türkçe yerel ayarların tamamlanması (tüm girdi ve çıktılarda virgüllü ondalık, gg.aa.yyyy, İ/ı'ya duyarlı arama ve sıralama) | S | — |  |
| F82 | İsteğe bağlı adet döngüsü notu | S | — |  |

### Platform

| Kod | Özellik | Boyut | Bağımlı olduğu | Kapsam notu |
| --- | --- | --- | --- | --- |
| F83 | Masaüstü bildirimleri ve hatırlatıcılar (öğün, su, tartılma, takviye, SKT; isteğe bağlı sistem tepsisi ajanı) | M | — | Uygulama açıkken sistem bildirimi (öğün, su, tartılma, takviye). Uygulama kapalıyken çalışan tepsi ajanı yok; SKT hatırlatması yok (F37'ye hayır dedin). |

**Tamamlandı:** H5 (masaüstü paketinde PDF okuma). Düzeltme PR #1 ile main'e girdi.

## 2. Fazla karmaşık bulunup sonraya bırakılanlar

Bunlara evet dedin. Bugünkü kullanıma göre maliyeti ve karmaşıklığı getirisinden yüksek olduğu için ilk tura alınmadı.

| Kod | Özellik | Neden sonraya | Şimdilik ne karşılıyor |
| --- | --- | --- | --- |
| F11 | Gün bazlı hedefler ve kalori döngüsü (yüksek/düşük gün) | Hedef hesabına bir katman daha ekler (F10 ve F76 zaten hedefi değiştiriyor); ileri kullanıcı özelliği. | F09 hedefleri |
| F12 | Mikro besinler (lif, sodyum ve şekerle dar başlangıç) | Türk yemekleri için güvenilir mikro besin verisi yok; F68 ve F75 olmadan alanlar boş kalır. | — |
| F26 | Toparlanma, ekipman ve süreye göre antrenman üretimi | Kural motoru, toparlanma verisi ve geniş egzersiz kütüphanesi birlikte gerekir. | F51 hazır olma skoru ve mevcut kısaltılmış antrenman |
| F29 | Sosyal akış ve koç pazaryeri | Gizlilik vaadiyle çelişir; sunucu, hesap ve moderasyon ister. | F60 CSV dışa aktarma |
| F32 | Artık yemek ve toplu pişirme modellemesi | Plan, kiler ve alışveriş listesine aynı anda dokunan yeni bir durum modeli kurar. | F31 porsiyon ölçekleme ve mevcut toplu pişirme rehberi |
| F46 | Hane paylaşımı ve gerçek zamanlı çok kullanıcılı eşitleme | Eşitleme sunucusu ve çakışma çözümü ister; yerel öncelikli modelle çelişir. | F61 klasöre otomatik yedek |
| F48 | AI kullanmadan, deterministik ve makro hedefli otomatik plan üretimi | Makro hedefli bir plan çözücü (optimizasyon motoru) yazmayı gerektirir. | F30 plan editörü, F01 kayıtlı öğünler ve AI koç |
| F53 | İsteğe bağlı proaktif dürtmeler (sabah check-in'i, öğün öncesi kalan makrolar, antrenman sonrası kayıt) ve sıklık kontrolü | AI'ın kendiliğinden mesaj üretmesi; uygulama kapalıyken masaüstünde etkisi yok. | F83 hatırlatıcıları |
| F54 | Affedici seriler ve alışkanlıklar (haftalık X/7, dinlenme ve hastalık günleri uyumlu sayılır, seri onarımı) | Seri onarımı ve istisna günü kuralları ekler; haftalık uyum zaten F49'da var. | F49 haftalık check-in |
| F55 | Diyet molası/bakım modu, aradan sonra dönüş akışı ve Bayram ön ayarı (gevşek hedefler, seri cezası yok) | Hedef hesabına bir katman daha ekler; talep kanıtı zayıf. | F09'da "kiloyu koru" hedefini seçmek |
| F63 | Health Connect içe aktarma (Android) | Masaüstünden Android verisine ulaşmak için ayrı bir köprü uygulaması gerekir. | F62 Apple Health içe aktarma |
| F64 | Tartı ve giyilebilir cihaz verisini dosyadan içe aktarma (openScale CSV, Gadgetbridge SQLite) | Çok küçük bir kitle için iki ayrı dosya biçimine ayrıştırıcı yazmak gerekir. | F62 (akıllı tartılar genelde Apple Health'e yazar) |
| F65 | Veritabanı şifreleme (anahtar macOS Anahtar Zinciri'nde ya da Windows Kimlik Bilgisi Yöneticisi'nde; şifreli yedekler) | Veritabanı sürücüsünü değiştirmek ve mevcut veriyi göç ettirmek gerekir; macOS disk şifrelemesi (FileVault) veriyi zaten korur. | FileVault |
| F68 | Türkiye'ye filtrelenmiş yerel OFF veri dökümü + ek tablolar (USDA FDC) | Büyük bir veri hattı, paket boyutu artışı ve ODbL lisans yükümlülükleri getirir. | Çevrimiçi OFF araması, F03 yerel ürün ve F74 Türk yemekleri kataloğu |
| F69 | Yerel, salt okunur MCP sunucusu (127.0.0.1 ve token modeline uygun) | Dar ve teknik bir kitle için yeni bir dış arayüz (ve saldırı yüzeyi) açar. | F60 CSV dışa aktarma |
| F70 | Paylaşılabilir rutin, plan ve tarif dosyaları (rutin dosya biçimi, schema.org Recipe JSON-LD, QR) | Yeni bir dosya biçimi, QR ve JSON-LD; tek kullanıcılı uygulamada az kullanılır. | F60 CSV dışa aktarma |
| F72 | Çoklu cihaz eşitlemesi (iki masaüstü ya da masaüstü + telefon) | Çift yönlü eşitleme ve çakışma çözümü büyük iş; tek kullanıcı için gereksiz. | F61 ile iCloud veya Syncthing klasörüne yedek |
| F75 | TürKomp verisini uygulamaya paketleme | Fazla karmaşıklık değil, hukuki engel (aşağıdaki açıklamaya bak). | Değerler yalnız kendi verimizi elle kontrol etmek için kullanılır |

### F75 nedir?

TürKomp, Türkiye'nin resmî gıda bileşim veritabanı (yaklaşık 645 gıdanın besin değerleri). Sitesindeki kullanım metni "Tüm Hakları Saklıdır" diyor; yani veriyi yazılı izin olmadan uygulamanın içine koyamayız. İzin istenirse ve gelirse bu madde yeniden açılır. O zamana kadar F74'teki Türk yemeklerinin değerleri kendi tariflerimizden hesaplanır, TürKomp yalnız sonucu elle karşılaştırmak için kullanılır.

## 3. Belki

| Kod | Kategori | Özellik | Boyut | Analizdeki öneri | Not |
| --- | --- | --- | --- | --- | --- |
| F07 | Beslenme | Sesli kayıt (yerel konuşmadan metne çeviri) | L | Şimdilik değil | yerel konuşma tanıma motoru paketlemek pahalı; masaüstünde metin daha hızlı |
| F08 | Beslenme | Fotoğraftan AI öğün kaydı (bileşenlere ayır → katalog → onay) | L | Şimdilik değil | fotoğraf telefonda çekilir ve yerel görsel model kalitesi donanıma bağlı; F06 ve telefon yolu oturunca yeniden değerlendirilmeli |
| F39 | Plan, kiler ve market | "Yedim" ile kilerden otomatik düşüm (son kullanma tarihi en yakın olandan) | M | Önerilen | mevcut bir eylemi kullanarak Grocy'yi geçer; ana akım uygulamaların hiçbirinde uçtan uca yok |
| F40 | Plan, kiler ve market | Minimum stok ve temel ürünlerin listeye otomatik eklenmesi | S | İsteğe bağlı | ucuz ama ek kurulum verisi gerektiriyor |
| F41 | Plan, kiler ve market | Kilere barkodla giriş/çıkış (klavye gibi çalışan USB okuyucu + yerel barkod→gıda eşleme) | S | İsteğe bağlı | masaüstüne uygun, ama USB okuyucu sahibi olan kitle küçük |
| F42 | Plan, kiler ve market | Fiş ya da buzdolabı fotoğrafından kilere giriş | L | Şimdilik değil | doğruluk ve donanım riski var; Türk fiş biçimleri bilinmiyor |
| F43 | Plan, kiler ve market | Öğün ve hafta maliyeti, bütçe, fiyat geçmişi | M | İsteğe bağlı | Türkiye'de fiyat hassasiyeti yüksek ama doğrudan talep verisi yok |
| F44 | Plan, kiler ve market | Mağaza profilleri ve özel reyon sırası | S | İsteğe bağlı | ucuz bir kullanım kolaylığı |
| F45 | Plan, kiler ve market | Listeyi ve planı telefona taşıma (QR ile salt okunur yerel sayfa, metin/Markdown, yazdırma, .ics) | S | Önerilen | telefon boşluğunu en ucuza kapatan adım |
| F66 | Veri, gizlilik ve entegrasyon | Uygulama kilidi/PIN | S | Şimdilik değil | şifreleme olmadan yalnız görünüşte koruma sağlar |
| F71 | Veri, gizlilik ve entegrasyon | Çok kullanıcılı/aile profilleri (profil değiştirici) | M | Şimdilik değil | tüm şemada profile_id göçü gerektirir |
| F81 | Türkiye | Fiyat politikası: ücretsiz ya da tek seferlik TL fiyatı, reklamsız, otomatik yenileme tuzağı yok (bir politika kararı) | S | Önerilen | mevcut duruşu korumak ve pazarlamak; aboneliğe geçmek güveni zedeler |
| F84 | Platform | Telefon yolu: QR ile eşlenen, kullanıcının açıkça başlattığı, geçici bir yerel ağ mini web arayüzü (hızlı kayıt, set işaretleme, alışveriş listesi) | M | Önerilen | yapısal boşluğu bulut kullanmadan kapatır; kamera için HTTPS, token/QR eşleme ve varsayılan olarak kapalı olma şart |
| F85 | Platform | Yerel mobil uygulama (Tauri 2 mobil) + masaüstüyle eşitleme | L | Şimdilik değil | önce F84 ile telefon kullanımı ölçülmeli; yatırım çok büyük |

## 4. Hayır

| Kod | Kategori | Özellik | Boyut | Not |
| --- | --- | --- | --- | --- |
| F04 | Beslenme | Besin etiketi OCR (yerel görsel model, kullanıcı onaylı) | M | F03 formunu otomatik doldurur ama kalite kullanıcının donanımına bağlı |
| F05 | Beslenme | Webcam ile barkod okuma (getUserMedia + WASM çözücü) | M | dizüstü kameraları barkoda zor odaklanır; USB okuyucu (F41) ve telefon yolu (F84) daha güvenilir |
| F34 | Plan, kiler ve market | Fotoğraf, metin veya videodan tarif içe aktarma | M | mevcut belge yükleme hattı yeniden kullanılabilir; metinle başlanmalı |
| F35 | Plan, kiler ve market | Diğer uygulamalardan içe aktarma (Paprika, Mealie, MFP CSV) | M | Türk kullanıcı tabanı Yazio ağırlıklı ve Yazio'nun dışa aktarımı araştırılmadı |
| F36 | Plan, kiler ve market | Pişirme modu (adım adım, ekran açık, metinden zamanlayıcı) | S | masaüstü bilgisayar mutfakta sınırlı kullanılır |
| F37 | Plan, kiler ve market | Son kullanma tarihi uyarıları (rozet, pano, işletim sistemi bildirimi) | S | SKT alanı zaten var; sıfır israf döngüsünün ilk halkası |
| F38 | Plan, kiler ve market | "Elimdekilerle pişir" ve bozulmak üzere olanı önce kullanan sıralama; AI planında SKT önceliği | M | birim farkındalıklı eşleme zaten var |
| F47 | Plan, kiler ve market | Online market siparişi | L | bulut bağımlılığı getirir ve rakiplerdeki örnekler ABD odaklı |
| F59 | AI koç | Kan tahlili ve laboratuvar sonucu yorumlama | L | tıbbi risk yüksek ve küçük modeller bu iş için uygun değil |
| F86 | Platform | Akıllı saat ve canlı nabız entegrasyonu | L | masaüstünden doğrudan mümkün değil; veriler dosya içe aktarımıyla (F62, F27) alınabilir |

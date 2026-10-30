# Hayali kullanıcı testi: eksikler ve bulgular

**Tarih:** 30 Ekim 2026 · **Dal:** `ozellik/dalga-5` (dalga 1–4 dahil) · **Ortam:** paketlenmiş masaüstü sunucusu, WebKit

## Özet

Altı hayali kullanıcı (persona), paketlenmiş uygulamayı **ilk kurulumdan** başlayarak birer hafta kullandı. 82 adımın her biri ekran görüntüsüyle kaydedildi; altı ayrı değerlendirici ekran görüntülerine o kişinin gözünden baktı. 88 ham bulgu birleştirildi: **43 ayrı madde** (4 kritik, 13 yüksek, 21 orta, 5 düşük).

En önemli dört sorun:

1. **İlk kurulumda besin kataloğu boş** (B01). Paketli uygulama boş katalogla açılıyor: hızlı ekleme ve yazarak ekleme ilk öğünde çıkmaza giriyor, koçun yemek önerisi 0 kcal olarak plana giriyor. Türk ev yemekleri paketi yalnız Tarifler sekmesinde duruyor.
1. **Günlük plan, girilen menü yerine sabit örnek öğünleri gösteriyor** (B08). Haftalık editöre girilen diyetisyen menüsü günlük Yemek Planı'nda görünmüyor; yerine 'Yulaflı Lorlu Fit Omlet' gibi sabit, laktozlu örnek öğünler ve sahte makrolar çıkıyor.
1. **Tamamlanmamış setler 40 kg ile gerçek set olarak kaydediliyor** (B17). 'Tamamla' denmemiş setler varsayılan 40 kg ile kaydediliyor; ilerleme önerisi, bench hacmi (3.320 kg) ve haftalık set sayıları bu hayali setlerle bozuluyor.
1. **Dar pencerede Ayarlar ve İlerleme'ye ulaşılamıyor** (B32). Alt menüde yalnız 5 bağlantı ve AI Koçu var; Ayarlar ve İlerleme yok. Masaüstü uygulamasında adres çubuğu olmadığından takviye ekleme, hatırlatma ve fotoğraf dar pencerede erişilemez.

Ortak tema: uygulama geliştiricinin kendi rutinine göre kurulmuş (2.080 kcal, 112 kg, iş çıkışı antrenman, kreatin) ve yeni kurulumda boş geliyor. Bu ikisi birlikte, ilk 10 dakikada kullanıcıların çoğunu yanlış sayılarla ya da boş bir katalogla karşılıyor. Buna karşılık sihirbaz, Ramazan sayacı, şeffaflık tablosu, set başına RPE/dinlenme sayacı, ölçü takibi ve diyetisyen raporu personaların beğendiği yerler oldu.

## Personalar

| Persona | Kim | Ekran | Adım | Başarısız |
|---|---|---|---|---|
| Ayşe | 34, muhasebeci, ilk kez beslenme takibi, Türk ev yemekleri, 90 → 75 kg | 1366 px | 16 | 2 |
| Mert | 28, 6 yıllık halterci, Strong/Hevy kullanmış, yavaş bulk | 1366 px | 15 | 0 |
| Zeynep | 41, öğretmen, diyetisyenle çalışıyor, laktoz intoleransı | 1366 px | 14 | 2 |
| Emre | 30, yazılımcı, İstanbul, Ramazan orucu, yerel modeli yok | 1366 px | 11 | 2 |
| Can | 37, sistem yöneticisi, gizlilik hassas, LM Studio, iPhone + Watch | 1366 px | 12 | 0 |
| Elif | 22, öğrenci, telefon alışkanlığı, whey + kreatin, döngü notu | 390 px | 14 | 3 |

**Ayşe.** Ayşe kurulum sihirbazını rahatça tamamladı ve kişisel bir kalori hedefi (1.370 kcal, 30 hafta) aldı; ancak ilk öğününü kaydetmeye çalıştığında katalog boş olduğu için hem Hızlı Öğün hem Yazarak ekle çıkmaza girdi. Türk ev yemekleri paketini ancak Besin & Tarif > Tarifler sekmesinde tesadüfen bulunca kayıt yapabildi, yine de ekmeği kaydedemedi ve 'kase' için iki farklı kalori gördü. Pano ve İlerleme sayfası onun hayatına değil, iş çıkışı antrenman yapan ve kreatin kullanan bir kullanıcıya göre kurulmuş görünüyor.

**Mert.** Mert'in beklediği temel parçalar (set başına RPE, dinlenme sayacı, plaka ve ısınma hesabı, durağanlık uyarısı, kas grubu başına haftalık set) var ve Strong/Hevy kullanıcısına tanıdık geliyor. Ancak seans kaydı tamamlanmamış setleri 40 kg varsayılanla gerçek set gibi saklıyor, şablondaki set sayıları seansa yansımıyor ve metinden eklenen dünkü antrenman bugüne yazılıyor; bu yüzden hacim ve ilerleme sayılarına güvenmek zor. Program kütüphanesi ileri seviye kaldırıcıya hitap etmiyor ve arayüzde geliştiriciye özgü varsayılanlar (iş çıkışı saatleri, 112 kg örneği, kreatin) göze batıyor.

**Zeynep.** Zeynep diyetisyen menüsünü haftalık editöre kolayca girebildi, ölçülerini kaydetti ve tek tıkla PDF/Excel rapor aldı. Ancak günlük plan ekranı onun menüsü yerine sabit, laktozlu örnek öğünleri ve sabit 2.080 kcal hedefini gösteriyor; 'Yedim Olarak Kaydet' tarifsiz öğünde hiçbir şey kaydetmiyor. Rapor ise diyetisyenin en çok bakacağı ölçüleri, plana uyumu ve plan–gerçekleşen karşılaştırmasını içermiyor.

**Emre.** Ramazan modu Ayarlar'da bulunup kolayca açılıyor ve panodaki iftar sayacı, imsak/iftar saatleri ve su önerisi net. Ancak boş katalog yüzünden Emre mercimek çorbası ve pideyi hiç kaydedemiyor; panonun üstü oruç saatinde hâlâ ara öğün öneriyor. Yerel model kurulu değilken AI koçu yanlış kalori hedefiyle karşılıyor ve hata mesajı çözüm adımı vermiyor.

**Can.** Can'ın gizlilik beklentisi büyük ölçüde karşılanıyor: şeffaflık tablosu, uç nokta rozeti, SHA-256 doğrulaması ve tam dosya yolları güven veriyor. Ancak sihirbazı atlayınca başkasının profiliyle (112 kg, 25 yaş, 2080 kcal) çalışan bir pano görüyor. Koç sayfası yatay taşıyor ve mesajların başı kenar çubuğunun altında kalıyor. Boş katalog yüzünden koçun yemek önerisi 0 kcal olarak plana giriyor. Yedek, tanılama ve Apple Sağlık geri bildirimleri ise bir sistem yöneticisinin doğrulayabileceği kadar açık değil.

**Elif.** Elif telefon genişliğindeki pencerede simidi ekledi, takviyeleri işaretledi ve döngü notunu girdi. Bu tek dokunuşluk işler hızlı ve iyi çalışıyor. Ama Ayarlar ile İlerleme alt menüde yok ve paketli uygulamada adres çubuğu da bulunmadığı için takviye ekleme, hatırlatma ve fotoğraf yükleme dar pencerede ulaşılamaz durumda. Koçun karşılama mesajı yanlış kalori hedefi gösteriyor, whey işaretlemesi de proteine sayılmıyor.

## Bulgular

Her madde: önem · boyut (S/M/L) · kimde görüldü · adımlar. Ekran görüntüleri `reports/personas/<persona>/NN-*.png`.

### İlk kurulum ve varsayılanlar

**B01 · İlk kurulumda besin kataloğu boş** — Kritik · M · Ayşe, Zeynep, Emre, Can
- Görülen: Paketli uygulama boş katalogla açılıyor: hızlı ekleme ve yazarak ekleme ilk öğünde çıkmaza giriyor, koçun yemek önerisi 0 kcal olarak plana giriyor. Türk ev yemekleri paketi yalnız Tarifler sekmesinde duruyor.
- Öneri: İlk açılışta (ya da sihirbaz sonunda) temel katalog, Türk ev yemekleri ve hızlı kalemleri (simit, ekmek) kur; boş katalogda hızlı ekleme, yazarak ekleme ve katalog sekmesinde 'yükle / yeni besin ekle' düğmesi göster.
- Adımlar: Ayşe 5, 7, 9 · Emre 7 · Can 6 · Zeynep 10

**B02 · Geliştiricinin kişisel varsayılanları herkese görünüyor** — Yüksek · M · Ayşe, Mert, Zeynep, Can, Elif
- Görülen: Profil 181 cm / 25 yaş / 112 kg / 2.080 kcal ile başlıyor; kilo alanında 'Örn: 112,0', panoda 'iş çıkışı antrenman, eve varış 19:30' bandı ve kreatin kartı/uyarısı her kullanıcıya çıkıyor. Sihirbazı atlayan biri başkasının hedefleriyle çalışıyor.
- Öneri: Nötr varsayılanlar kullan; sihirbaz atlanınca hedefleri 'tahmini' göster ve kalıcı 'Profilini tamamla' şeridi ekle. Günlük rutin bandını yalnız kullanıcı saat tanımladıysa göster; yeni kurulumda takviye listesi boş başlasın.
- Adımlar: Ayşe 3, 14 · Mert 1 · Zeynep 7 · Can 1–2 · Elif 3

**B03 · Koda yazılı '2.080 kcal' hedefi** — Yüksek · S · Zeynep, Emre, Elif, Can
- Görülen: Yemek Planı başlığı '2.080 kcal · 165 g protein', koçun karşılama mesajı ve hazır sorusu '2.080 kcal hedefi' diyor; kullanıcının hedefi 1.370–2.460 kcal arasında.
- Öneri: Bu metinleri profildeki hedeflerden üret (src/app/nutrition/page.tsx, src/components/coach/types.ts, QuickPrompts); 'sayıları gizle' ayarına da uy.
- Adımlar: Zeynep 7 · Emre 10 · Elif 13 · Can 5

**B04 · Veri yokken uydurma değerler gösteriliyor ve kaydediliyor** — Yüksek · S · Ayşe, Mert, Zeynep, Can
- Görülen: Kayıt yokken 'Ortalama enerji 3,0/5', '0 kg' ve hazır olma skoru görünüyor; uyku 7 saat, enerji 3 gibi önceden dolu değerler kullanıcı girmiş gibi kaydediliyor.
- Öneri: Veri yokken '—' ve 'Henüz kayıt yok' göster; alanları boş başlat ve yalnız kullanıcının dokunduğu alanları kaydet.
- Adımlar: Ayşe 13, 15 · Mert 15 · Zeynep 12 · Can 2

**B05 · Sihirbaz: cinsiyet 'Erkek' ile başlıyor, hata erken çıkıyor** — Orta · S · Ayşe, Elif
- Görülen: Cinsiyet alanı 'Erkek' seçili geliyor; yaş/boy hataları kullanıcı yazmaya başlamadan kırmızı görünüyor.
- Öneri: Cinsiyeti 'Seçin' ile başlat; doğrulamayı alandan çıkınca ya da 'İleri'ye basınca göster.
- Adımlar: Ayşe 1 · Elif 1

**B06 · Kurulumdan sonra yön gösterilmiyor** — Orta · M · Emre, Elif
- Görülen: Sihirbaz bitince yeni başlayan boş bir antrenman haftası, oruç tutan Ayarlar'ın ortasında saklı Ramazan modu, öğrenci 'iş çıkışı' etiketleri görüyor.
- Öneri: Sihirbazın sonuna kısa bir 'başlarken' adımı ekle: başlangıç programı seç, oruç tutuyor musun, günün nasıl geçiyor (okul/ofis/vardiya).
- Adımlar: Emre 2 · Elif 3, 14

**B07 · Kilo hedefine ilerleme hiçbir yerde görünmüyor** — Orta · M · Ayşe
- Görülen: Kilo girişi spor kartına gömülü; hedef kilo, verilen/kalan kg ve sihirbazdaki tahmini varış tarihi panoda yok.
- Öneri: Panoya 'Kilo hedefim' kartı ekle: güncel kilo, hedef, verilen/kalan kg, tahmini varış; kilo kaydından sonra kısa ilerleme mesajı.
- Adımlar: Ayşe 13–14

### Beslenme

**B08 · Günlük plan, girilen menü yerine sabit örnek öğünleri gösteriyor** — Kritik · S · Zeynep
- Görülen: Haftalık editöre girilen diyetisyen menüsü günlük Yemek Planı'nda görünmüyor; yerine 'Yulaflı Lorlu Fit Omlet' gibi sabit, laktozlu örnek öğünler ve sahte makrolar çıkıyor.
- Öneri: Planlı öğün varsa onun adını ve besin değerini göster; plan yoksa örnek yerine boş durum ve 'Hafta'dan ekle' bağlantısı ver.
- Adımlar: Zeynep 7

**B09 · Tarifsiz plan öğünü 'Yedim' ile kaydedilemiyor; alışveriş listesi boş** — Yüksek · M · Zeynep
- Görülen: Serbest metin plan öğününde 'Yedim Olarak Kaydet' hiçbir şey yazmıyor (4 saniyelik yeşil kutuda yönlendirme); alışveriş listesi bu öğünler için boş ve nedenini söylemiyor.
- Öneri: Serbest öğünde 'kalori girerek kaydet' ya da katalogla eşleştirme akışı aç; alışveriş listesinde boşluğun nedenini yaz ve elle kalem eklemeye izin ver.
- Adımlar: Zeynep 9–10

**B43 · Diyetisyen raporunda ölçüler, plana uyum ve sapmalar yok** — Yüksek · M · Zeynep
- Görülen: Rapor kalori/makro tablosu veriyor ama diyetisyenin en çok bakacağı bel/kalça ölçüleri, plana uyum yüzdesi ve plan ile gerçekleşenin karşılaştırması yok; hedeften sapmalar işaretlenmiyor, öğün günlüğü uzun düz bir liste.
- Öneri: Rapora ölçü tablosu (ilk/son/fark), haftalık uyum yüzdesi ve öğün bazında plan–gerçekleşen ekle; özet kartlarında hedefe göre farkı renkle göster; öğün günlüğünü güne göre grupla.
- Adımlar: Zeynep 13–14

**B10 · Yazarak eklemede bulunamayan kalem çıkmaz** — Yüksek · M · Ayşe, Emre
- Görülen: Eşleşmeyen satırda çözüm yolu yok; panoda hızlı çip olarak duran 'ekmek' bile tanınmıyor ve günlük toplam eksik kalıyor. Pencere Ramazan modunda Sahur/İftar adlarını bilmiyor.
- Öneri: Bulunamayan satıra 'yeni besin olarak ekle' ve 'yaklaşık kalori gir' seçenekleri koy; hızlı kalemleri eşlemeye kat; öğün adlarını Ramazan moduna göre göster.
- Adımlar: Ayşe 7, 11 · Emre 7

**B11 · '1 kase' çorba iki yerde farklı kalori** — Yüksek · M · Ayşe
- Görülen: Mercimek çorbası tarif kartında 1 kase 201 kcal, yazarak eklemede 151 kcal; tarif kartında öne çıkan sayı bütün tencerenin kalorisi.
- Öneri: Tarif porsiyonunu ev ölçüsü eşlemesinde kullan (1 kase ≈ 250 g); kartta porsiyon kalorisini öne çıkar.
- Adımlar: Ayşe 10–11

**B12 · Takviye işareti protein ve kaloriye sayılmıyor; panodan takviye eklenemiyor** — Yüksek · M · Elif
- Görülen: Whey 'alındı' işaretlenince günlük protein değişmiyor; panodaki takviye kartında ekleme bağlantısı yalnız liste boşken görünüyor (yeni kurulumda kreatin olduğu için hiç görünmüyor).
- Öneri: Takviyeyi isteğe bağlı bir besine bağla ve işaretleyince günlüğe ekle (ya da sor); karta her zaman '+ Takviye / Düzenle' bağlantısı koy.
- Adımlar: Elif 6, 9

**B13 · Hızlı eklemede öğün saate göre yanlış seçiliyor** — Orta · S · Elif
- Görülen: Sabah yenilen simit 'İş Çıkışı' öğününe yazıldı; sonradan öğünü değiştirme yolu yok.
- Öneri: Satırdaki öğün rozetine dokunarak değiştirmeyi sağla; saat sınırdaysa kısa bir 'Hangi öğün?' seçimi göster.
- Adımlar: Elif 3

**B14 · Yeni besin formu: 'Kasap & Balık' ve 'Yüksek' güven varsayılanı** — Orta · S · Zeynep, Emre
- Görülen: Elle eklenen hurma ve yoğurt 'Kasap & Balık' kategorisine, 'Yüksek' güvenle kaydediliyor.
- Öneri: Kategoriyi zorunlu yap ya da 'Genel' varsayılanı kullan; elle eklenen besinin güveni 'Kullanıcı' olsun.
- Adımlar: Zeynep 10 · Emre 5

**B15 · Kalori hedefi değişince makrolar güncellenmiyor** — Orta · S · Zeynep
- Görülen: Kalori 1.500'e indirilince protein/yağ/karbonhidrat eski değerlerde kalıyor; toplamları kaloriyle uyuşmuyor.
- Öneri: Kalori değişince makroları oranla yeniden dağıtmayı öner ya da farkı uyarıyla göster.
- Adımlar: Zeynep 2

**B16 · Haftalık editör: metin kesiliyor, gün toplamı ve hafta gezinmesi yok** — Orta · M · Zeynep
- Görülen: Uzun öğün adları kesiliyor, günlerde kcal toplamı ve bugün vurgusu yok, sonraki haftaya geçilemiyor.
- Öneri: Satırı sar ya da ipucu göster; gün toplamı ve bugün vurgusu ekle; hafta okları koy.
- Adımlar: Zeynep 4–6

### Antrenman

**B17 · Tamamlanmamış setler 40 kg ile gerçek set olarak kaydediliyor** — Kritik · S · Mert
- Görülen: 'Tamamla' denmemiş setler varsayılan 40 kg ile kaydediliyor; ilerleme önerisi, bench hacmi (3.320 kg) ve haftalık set sayıları bu hayali setlerle bozuluyor.
- Öneri: Yalnız tamamlanan setleri kaydet; bitirirken 'X set tamamlanmadı: at / tamamlandı say' sor; ağırlık alanını boş başlat.
- Adımlar: Mert 6–8, 10–11

**B18 · Şablondaki set sayısı seansa yansımıyor; set ekleme/silme yok** — Yüksek · S · Mert
- Görülen: Şablonda 4 ya da 2 set olan hareketler seansta hep 3 setle açılıyor; set eklemek veya silmek mümkün değil.
- Öneri: Seansı şablondaki set sayısıyla oluştur; her harekete '+ Set' ve set sil düğmesi ekle.
- Adımlar: Mert 5

**B19 · Metinden eklemede tarih yok; seans geçmişi yok** — Yüksek · M · Mert
- Görülen: 'Dünkü' antrenman bugüne yazılıyor; kayıttan sonra onay yok ve geçmiş seansları görüp düzenleyecek bir liste yok.
- Öneri: Pencereye varsayılanı bugün olan tarih seçici ekle; Antrenman'a tarihli seans geçmişi (gör, düzenle, sil) koy.
- Adımlar: Mert 9

**B20 · Pano yapılmayan seansı 'Tamamlandı' gösteriyor; bugün vurgulanmıyor** — Yüksek · S · Mert
- Görülen: Üst Gövde A yapıldığı hâlde pano Alt Gövde B'yi tamamlandı gösteriyor; haftalık planda bugün belli değil ve antrenman günü 'Toparlanma' açıklamasıyla görünüyor.
- Öneri: Tamamlandı durumunu yapılan şablonla eşleştir; bugünün kartını vurgula; gün açıklamasını şablondan üret.
- Adımlar: Mert 5, 8, 15

**B21 · İleri seviye kaldırıcı için program yok** — Orta · M · Mert
- Görülen: Hazır programlar başlangıç seviyesinde; 5/3/1, GZCLP, PPL gibi %1RM'e bağlı programlar yok.
- Öneri: En az birini (ör. 5/3/1) %1RM'e bağlı yüklemeyle ekle; o zamana dek 'kendi programını kur' yolunu öne çıkar.
- Adımlar: Mert 3–4 · Önceki seçimde: F18 (kapsam dışı bırakılmıştı)

**B22 · Isınma hesaplayıcısı seansa bağlı değil** — Orta · M · Mert
- Görülen: Plaka sayfası ısınma setlerini hesaplıyor ama seansa ekleyemiyor.
- Öneri: Seansta ana harekete 'Isınma setleri ekle' düğmesi koy.
- Adımlar: Mert 7, 12

**B23 · Ondalık gösterim tutarsız; plaka 1,25 → '1,3'** — Orta · S · Mert, Ayşe, Elif
- Görülen: Plaka hesabında 1,25 kg '1,3' görünüyor; e1RM grafiği ve bazı kartlarda noktalı ondalık, girdilerde virgül.
- Öneri: Tüm sayıları tek Türkçe biçimlendiriciden geçir; plaka ve ağırlıkta iki ondalığa kadar gereksiz sıfırsız göster.
- Adımlar: Mert 12, 10 · Ayşe 12 · Elif 3

**B24 · Güç bölümü dipte; yeni başlayana jargon ve boş bölümler** — Düşük · M · Mert, Ayşe
- Görülen: Güç gelişimi İlerleme'nin en altında; antrenman kaydı olmayan kullanıcıya TDEE, e1RM, set hacmi gibi bölümler boş hâlde gösteriliyor.
- Öneri: İlerleme'ye 'Güç' sekmesi ya da Antrenman'dan kısayol; kaydı olmayanda bu bölümleri gizle ve terimleri sadeleştir.
- Adımlar: Mert 10 · Ayşe 15

### Ramazan

**B25 · Ramazan modunda pano hâlâ ara öğün ve iş çıkışı rutini öneriyor** — Yüksek · M · Emre
- Görülen: Oruç saatinde üstteki 'Sıradaki adım' kartı ara öğün öneriyor; Ramazan kartı sayfanın aşağısında; alkol hızlı ekleme düğmeleri duruyor.
- Öneri: Ramazan modunda ritim kartını imsak/iftara göre üret ve Ramazan kartını en üste al; alkol satırını gizle.
- Adımlar: Emre 4, 11

**B26 · Ramazan dışında bağlamsız sayaç; sahur/iftar hatırlatması ve sofra kalemleri yok** — Orta · M · Emre
- Görülen: Ramazan dışında da 'İftara …' sayacı çalışıyor; sahur/iftar hatırlatması önerilmiyor; pide, hurma, güllaç gibi kalemler katalogda yok.
- Öneri: Ramazan tarihlerini çevrimdışı hesapla ve dışında 'Ramazan'a X gün' göster; mod açılınca sahur/iftar hatırlatmalarını tek tıkla öner; Türk paketine Ramazan kalemlerini ekle.
- Adımlar: Emre 4, 9, 7

### AI koç

**B27 · Koç sayfası 1366 px'te yana taşıyor** — Yüksek · S · Emre, Can
- Görülen: Hazır soru şeridi sayfayı genişletiyor; mesajların başı yan menünün altında kalıyor.
- Öneri: Ana içeriğe min-w-0 ver ya da şeridi sınırla; yatay kaydırma olmadığını doğrulayan bir E2E testi ekle.
- Adımlar: Emre 10 · Can 5–6

**B28 · Yerel model yokken koç ne olduğunu ve nasıl düzeleceğini söylemiyor** — Orta · M · Emre, Elif
- Görülen: Model kurulu değilken hata ham markdown ile çıkıyor ve çözüm adımı vermiyor; ayarlar çalışmayan modeli yeşil 'hazır' gibi gösteriyor; sayfa önceden uyarmıyor.
- Öneri: Sayfa açılınca bağlantıyı denetle; 'Koç kapalı: yerel model bulunamadı' satırı, kurulum adımları ve 'Ayarlar'da test et' düğmesi göster; rozeti gerçek duruma bağla.
- Adımlar: Emre 10 · Elif 13

**B29 · Öneri kartı: metinde ham JSON, onay sonrası rozet değişmiyor, eksik malzemeyle 'Hesaplandı'** — Orta · S · Can
- Görülen: Koç balonunda öneri JSON'u görünüyor; onaylanan kartta rozet 'Onay Bekliyor' kalıyor; malzemeler katalogda yokken '0 kcal · Hesaplandı'.
- Öneri: JSON'u metinden çıkar; rozeti 'Onaylandı' yap; eksik malzeme varsa 'Hesaplandı' yerine seçim sun.
- Adımlar: Can 6

**B30 · Yapay zekâ ayarının kaydedildiği belli değil** — Orta · S · Can
- Görülen: Ayrı kaydet düğmesi yok; başarılı test ayarı kaydediyor ama bu yazmıyor; algılanan modeller seçilemiyor.
- Öneri: Mesajı 'Bağlantı başarılı ve kaydedildi' yap; algılanan modelleri seçilebilir yap.
- Adımlar: Can 4

**B31 · 'Kaç km koştum?' bütün kardiyoyu topluyor** — Orta · S · Can
- Görülen: Soru koşu hakkındayken yürüyüş ve bisiklet de toplama giriyor.
- Öneri: Soruda 'koş' geçiyorsa koşuya göre filtrele ya da türlere ayır; karta 'kayıtlarından hesaplandı' etiketi koy.
- Adımlar: Can 5

### Gezinme ve dar ekran

**B32 · Dar pencerede Ayarlar ve İlerleme'ye ulaşılamıyor** — Kritik · S · Elif
- Görülen: Alt menüde yalnız 5 bağlantı ve AI Koçu var; Ayarlar ve İlerleme yok. Masaüstü uygulamasında adres çubuğu olmadığından takviye ekleme, hatırlatma ve fotoğraf dar pencerede erişilemez.
- Öneri: Alt menüye 'Daha fazla' sekmesi ekle (İlerleme, Ayarlar, Kiler, openGym) ya da başlığa dişli simgesi koy.
- Adımlar: Elif 4, 11

**B33 · Koçun gönder düğmesinin erişilebilir adı yok** — Orta · S · Elif
- Görülen: Dar ekranda 'Gönder' metni gizleniyor ve düğme adsız kalıyor.
- Öneri: Düğmeye aria-label ekle; metni sr-only ile gizle.
- Adımlar: Elif 13

**B34 · Ayarlar sayfası çok uzun ve teknik** — Orta · M · Elif, Emre, Zeynep
- Görülen: Takviye, hatırlatma, oruç, AI, şeffaflık, yedek ve tanılama tek sayfada; açma-kapama ayarları ayrı bir 'Kaydet' bekliyor.
- Öneri: Bölüm sekmeleri ya da içindekiler ekle; teknik bölümleri 'Gelişmiş' altında katla; anahtarlar dokununca kaydetsin.
- Adımlar: Elif 8 · Emre 2 · Zeynep 2

**B35 · Dar ekranda taşmalar; İngilizce dosya seçici; karışık dil** — Düşük · M · Elif, Can, Ayşe, Mert
- Görülen: Tablolar ve rozetler dar ekranda taşıyor; dosya seçiciler 'Choose File' diyor; 'Yerel-First' gibi karışık ifadeler var.
- Öneri: Dar ekranda tabloyu karta çevir; dosya girişini Türkçe düğmeyle sar; ifadeleri sadeleştir.
- Adımlar: Elif 12, 14 · Can 10 · Ayşe 15 · Mert 15

### Gizlilik, yedek ve veri

**B36 · İndirilen dosyaların yeri belirsiz; ham yollar teknik** — Orta · M · Can, Zeynep, Ayşe
- Görülen: Mesaj indirilenler klasörünü söylemiyor; her dışa aktarmanın sessiz bir kopyası uygulama klasörüne yazılıyor; otomatik yedek klasörü elle yazılıyor; dosya adları UTC saatinde.
- Öneri: 'Finder'da göster' ve 'Yolu kopyala' düğmeleri; kopyayı ayarla kapatılabilir yap; klasör seçme penceresi; yerel saatli dosya adları.
- Adımlar: Can 7–9 · Zeynep 14 · Ayşe 15

**B37 · Apple Sağlık'ta çift sayım önlemi görünmüyor** — Orta · S · Can
- Görülen: iPhone ve Apple Watch adımları birleştirilirken hangi kaynağın alındığı söylenmiyor.
- Öneri: Sonuca 'aynı gün için yalnız yüksek kaynak alındı (Apple Watch)' satırı ve açılabilir kaynak dökümü ekle.
- Adımlar: Can 10

**B38 · Tanılama bölümü eksik ve güncel değil** — Orta · M · Can
- Görülen: İşlemden sonra yenilenmiyor; bazı tablolar, sürüm ve günlük dosyası yolu yok.
- Öneri: Otomatik yenile; tüm tabloları, sürümü ve günlük yolunu göster; 'Tanılamayı kopyala' düğmesi koy.
- Adımlar: Can 12

**B39 · Şeffaflık ayrıntıları: sunucu yokken yeşil onay, eksik satır, iCloud uyarısı** — Düşük · S · Can
- Görülen: Yerel model sunucusu yokken 'yalnız bu bilgisayardan erişilebilir' onayı çıkıyor; yerel ve bulut satırları farklı veri listesi veriyor; iCloud klasörü önerilirken yedeğin şifresiz olduğu yazmıyor.
- Öneri: Sunucu yoksa 'kontrol yapılmadı' yaz; iki satırı aynı listeyle yaz; iCloud önerisine şifresiz uyarısı ekle.
- Adımlar: Can 3–4, 8 · Önceki seçimde: F65 (iCloud şifreli yedek)

### Diğer

**B40 · Haftalık değerlendirmede öneri iki kez yazıyor** — Düşük · S · Ayşe
- Görülen: Kurallı özetin son cümlesi ile 'tek adım' kutusu aynı öneriyi tekrar ediyor.
- Öneri: Öneriyi yalnız kutuda göster; özete hedefle karşılaştırma ekle; etiketi 'Otomatik özet' yap.
- Adımlar: Ayşe 16

**B41 · Hatırlatmalar telefona ulaşmıyor** — Orta · M · Elif
- Görülen: Takviye hatırlatması yalnız uygulama açıkken çalışıyor; telefon alışkanlığı olan kullanıcıya ulaşmıyor.
- Öneri: Kısa vadede hatırlatmaları .ics takvim dosyası olarak dışa aktar; uzun vadede telefon yolu.
- Adımlar: Elif 7 · Önceki seçimde: F84 (telefon yolu)

**B42 · Yerel model yokken yapay zekâsız öğün önerisi yok** — Düşük · L · Emre
- Görülen: Model kurulu değilken iftar ya da akşam yemeği için hiçbir öneri gelmiyor.
- Öneri: Kalan kalori/makroya göre kayıtlı öğün ve tariflerden kural tabanlı öneri göster.
- Adımlar: Emre 10 · Önceki seçimde: F48 (kural tabanlı plan üretimi)

## Beğenilenler

**Ayşe**
- Kurulum sihirbazı 4 adımda bazal metabolizma, günlük hedef, makrolar ve tahmini varış tarihini (28.05.2027) hesapladı; değerler panoya hemen yansıdı (adım 3–4).
- Türk ev yemekleri paketi tek tıkla 15 tarif ve 24 malzeme ekledi; ardından '1 kase mercimek çorbası, 1 su bardağı ayran' cümlesi doğru tanındı (adım 10–11).
- Su ve çay çipleri tek tıkla, saatli ve × ile geri alınabilir kayıt yapıyor; kafein miktarı da gösteriliyor (adım 12).

**Mert**
- Set tamamlanınca 90 sn dinlenme sayacı kendiliğinden başlıyor; set başına RPE ve set tipi (ısınma) seçilebiliyor (adım 6–7).
- İlerleme'de bench için 'Son 3 seansta yeni rekor yok' durağanlık uyarısı ve deload önerisi çıkıyor; en iyi e1RM, en ağır set ve en yüksek hacim kartları net (adım 10).
- Kas grubu başına haftalık set tablosu 10–20 hedef bandı, 'Az/Hedefte' etiketleri ve çalışılmayan kaslar listesiyle geliyor (adım 11).

**Zeynep**
- Haftalık editörde her güne öğün eklemek hızlı; taşı/kopyala/sil simgeleri hazır ve eklenen satır hemen görünüyor (adım 4–6).
- Ölçü girişi sade: bel 91 / kalça 107 önceki ölçüye göre farkla (−2, −1) ve bel/boy oranı açıklamasıyla gösteriliyor (adım 12).
- Kilo grafiği günlük tartı ile 7 günlük ortalamayı birlikte veriyor; 'Haftalık kilo farkı −0,4 kg' motive edici (adım 12).

**Emre**
- Ramazan modu tek satırda ne yaptığını anlatıyor (imsak/iftar sayacı, sahur/iftar öğünleri, oruçta su hatırlatması yok); il seçimi, dakika düzeltmesi ve 'Kaydedildi ✓' geri bildirimi var (adım 3, 03-ramazan-modunu-acar.png).
- Panodaki Ramazan kartı anlaşılır: büyük 'İftara 1 sa 15 dk', ilerleme çubuğu, 'İmsak 05:59 · İftar 18:10', iftar–sahur arasına yayılmış su önerisi ve 'Diyanet takvimiyle bir iki dakika fark olabilir' notu (adım 4, 04-panoda-geri-sayim.png).
- Hurmayı elle eklemek kolay: virgüllü ondalık ('2,5') kabul ediliyor ve '"Hurma" yerel kataloğa eklendi' onayı görünüyor (adım 5, 05-hurmayi-elle-ekler.png).

**Can**
- Şeffaflık tablosu (adım 3–4) neyin nereye gittiğini satır satır gösteriyor; etkin satırda 'Şu an kullanılan' etiketi, başlıkta 'Bu bilgisayarda · 127.0.0.1:3300' rozeti ve shasum komutu bir sistem yöneticisinin aradığı türden kanıtlar.
- Bağlantı testi (adım 4) net bir yeşil kutu ve algılanan model listesiyle sonuçlanıyor; başarı belirsiz kalmıyor.
- Koçun veri yanıtı (adım 5) sayıyı ayrı bir kartta veriyor, 'Kaynak kayıtlar' açılabiliyor ve 'hatalı olabilir' uyarısı duruyor. Yemek önerisi (adım 6) açık onay istiyor ve katalogda bulunmayan malzemeleri dürüstçe belirtiyor.

**Elif**
- Panodaki takviye kartında kreatin ve whey tek dokunuşla 'alındı' oldu; yeşil durum ve '1/7 gün' sayacı hemen güncellendi (adım 9, 09-panoda-takviyeleri-isaretler.png).
- '+ Simit' hızlı ekleme çipi tek tıkla kayıt açtı; kalori (303/2410) ve makro çubukları hemen güncellendi (adım 3, 03-simit-ekler.png).
- Döngü notu varsayılan olarak kapalı ve 'yapay zekâ modeline gönderilmez' diye açıkça yazıyor. Açılınca Günlük Ritim'e sade bir 'Döngü (isteğe bağlı)' listesi geliyor ve kayıt 'Kayıt güncellendi ✓' ile onaylanıyor (adım 8 ve 10).

## Yöntem ve sınırlar

- Senaryolar: `e2e/personas/*.persona.ts`. Çalıştırma: `pnpm exec playwright test -c e2e/personas/playwright.personas.config.ts` (önce `pnpm desktop:build`).
- Her persona kendi boş veri klasöründe, ayrı bir paketlenmiş sunucuya karşı koştu (seed yok; gerçek ilk kurulum).
- Önceki günlerin verisi API ile dolduruldu (ör. Mert'in 6 haftalık bench platosu); bugünkü adımlar arayüzden yapıldı.
- Dış servisler sahteydi: Open Food Facts araması boş döner; Can'in 'LM Studio'su hazır yanıt veren bir sahte sunucuydu. Diğer personalarda yerel model yoktu (gerçek ilk kurulum durumu).
- Test tarihi Ramazan dışında (30 Ekim 2026); Ramazan sayacı bu bağlamda değerlendirildi.
- Sistem bildirimi ve yazdırma penceresi gerçek uygulamada elle denenmedi.
- WebKit'te ayarlar sayfasındaki bazı Playwright sorguları aracın kendi iç hatasını verdi; bu adımlar kimlik seçicilerle yeniden koşuldu ve bulgu sayılmadı.

## Sonraki adım

Bulgular seçim sayfasında Evet / Belki / Hayır ile işaretlenecek; seçilenler için ayrı bir düzeltme planı (dalga 6) yazılacak.

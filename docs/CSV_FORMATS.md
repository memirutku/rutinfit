# RutinFit CSV biçimleri

Ayarlar → Yedekleme bölümündeki CSV düğmeleri bu dosyaları üretir (`GET /api/export/csv?type=…`,
isteğe bağlı `from` ve `to` tarih aralığıyla). Ortak kurallar:

- Kodlama UTF-8, başta BOM vardır (Excel Türkçe karakterleri doğru açar).
- Ayraç virgüldür; virgül, tırnak ya da satır sonu içeren alanlar çift tırnak içindedir (RFC 4180).
- Sayılar **noktalı ondalıkla** yazılır (`62.5`); tablolama programları ve diğer uygulamalarla uyum
  için. Tarihler `YYYY-MM-DD`.
- Her dışa aktarmanın bir kopyası uygulama veri klasöründeki `exports/` klasörüne de yazılır.

## Besin günlüğü (`type=food-log`)

| Sütun | Açıklama |
| --- | --- |
| `date`, `time` | Kayıt günü ve saati (`HH:mm`) |
| `meal` | Öğün: Kahvaltı, Öğle Yemeği, İş Çıkışı Ara Öğünü, Akşam Yemeği, Ekstra / Ara Öğün |
| `name` | Besin ya da tarif adı |
| `grams` | Miktar (g; içecekte ml) |
| `kcal`, `protein_g`, `carbs_g`, `fat_g` | Kayıt anındaki değerler |

## Antrenmanlar (`type=workouts`)

Strong uygulamasının dışa aktarma biçimi; RutinFit'e (Ayarlar değil, openGym sayfasındaki CSV içe
aktarma) ve Strong/Hevy'yi okuyan araçlara geri yüklenebilir. Yalnız tamamlanmış seanslar yazılır.

`Date, Workout Name, Duration, Exercise Name, Set Order, Weight, Reps, Distance, Seconds, Notes, Workout Notes, RPE`

- `Date`: `YYYY-MM-DD 00:00:00` (seans saati tutulmaz).
- `Duration`: dakika, `50m` biçiminde.
- `Weight`: kg. `RPE`: set RPE'si (boşsa girilmemiş).
- `Workout Notes`: seans notu; `Distance`, `Seconds`, `Notes` boştur.

## Kilo ve bel ölçüsü (`type=body`)

| Sütun | Açıklama |
| --- | --- |
| `date` | Ölçüm günü |
| `weight_kg` | Sabah kilosu (yoksa boş) |
| `waist_cm` | Bel çevresi (yoksa boş) |

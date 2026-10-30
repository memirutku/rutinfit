# macOS Sürüm Yayınlama: İmza, Notarization ve GitHub Releases

RutinFit'in macOS paketi Developer ID ile imzalanır, hardened runtime ile çalışır ve Apple tarafından
notarize edilir. Böylece indirilen `.dmg` Gatekeeper uyarısı çıkmadan açılır.

> **Sırlar asla depoya girmez.** Sertifika (`.p12`), App Store Connect anahtarı (`.p8`) ve parolalar
> yalnız anahtar zincirinde veya GitHub Secrets'ta durur. `.gitignore` bu dosya türlerini dışlar.

## 1. Neyi, kim imzalar?

| Dosya (`RutinFit.app/Contents/…`) | İmzalayan | Not |
| --- | --- | --- |
| `MacOS/rutinfit` (Tauri kabuğu) | Tauri | hardened runtime + `src-tauri/entitlements.plist` |
| `MacOS/node` (gömülü Node 22) | Tauri (`externalBin`) | aynı entitlements dosyası |
| `Resources/server/**` içindeki native modüller (better-sqlite3, @napi-rs/canvas, varsa sharp/libvips) | `scripts/prepare-desktop.mjs` | Tauri `Resources` altını **imzalamaz**; bu adım olmazsa notarization reddeder ve Node bu kütüphaneleri yükleyemez |
| `RutinFit.app` (paket mührü) | Tauri | |
| `RutinFit_<sürüm>_<mimari>.dmg` | Tauri imzalar, `scripts/notarize-macos.mjs` notarize edip bileti zımbalar | |

### Entitlements: yalnız `com.apple.security.cs.allow-jit`

Node'un V8 motoru JIT için `MAP_JIT` bellek ister. arm64'te (Node 22.23.3) ölçülen sonuç:

| Entitlements | Sonuç |
| --- | --- |
| hiçbiri | Node açılışta çöküyor (SIGTRAP, çıkış 133) |
| `allow-jit` | JIT, WebAssembly ve yerel eklentiler (SQLite, canvas, sharp) çalışıyor |
| ad-hoc imza + hardened runtime | Prisma yüklenmiyor: `mapping process and mapped file (non-platform) have different Team IDs` |

`allow-unsigned-executable-memory`, `disable-library-validation` ve `get-task-allow` bilerek yok:
paketteki bütün native modüller aynı takım kimliğiyle imzalanır, `get-task-allow` ise notarization'ı
reddettirir. Tauri tek bir entitlements dosyasını hem kabuğa hem Node'a uygular; kabuk JIT kullanmaz ama
ayrı dosya desteği olmadığı için bu izni o da taşır. Intel (x64) için aynı denetimi sürüm iş akışındaki
duman testi Intel makinede yapar. Orada Node JIT hatasıyla çökerse entitlements dosyasına
`com.apple.security.cs.allow-unsigned-executable-memory` eklenir.

### İki derleme kipi (`pnpm desktop:build` → `scripts/desktop-build.mjs`)

| | Yerel kip | Dağıtım kipi |
| --- | --- | --- |
| Ne zaman | `APPLE_SIGNING_IDENTITY` yok | `APPLE_SIGNING_IDENTITY="Developer ID Application: … (TAKIMID)"` |
| İmza | ad-hoc | Developer ID + güvenli zaman damgası |
| Hardened runtime | kapalı (ad-hoc imzada Prisma'yı engellerdi) | açık |
| Nerede açılır | yalnız derlendiği Mac | her Mac (notarize edildikten sonra) |

Sertifika derlemeden **önce** anahtar zincirinde olmalı, çünkü native modüller Tauri'den önce imzalanır.
Tauri'nin `APPLE_CERTIFICATE` ile kendi içe aktarması bu adıma yetişmez; sarmalayıcı bunu baştan denetler.

## 2. Bir kerelik kurulum

### 2.1 Developer ID sertifikası

Apple Developer hesabında **Developer ID Application** sertifikası oluşturup anahtar zincirine kurun:

```bash
security find-identity -v -p codesigning
# 1) ABCD…1234 "Developer ID Application: Ad Soyad (TAKIMID)"
```

### 2.2 Notarization kimliği (yerel)

Parolayı anahtar zincirine kaydeden bir profil en güvenli yoldur; değer hiçbir dosyaya düşmez.
[appleid.apple.com](https://appleid.apple.com) → Uygulamaya Özel Parolalar'dan bir parola alın, sonra:

```bash
xcrun notarytool store-credentials rutinfit --apple-id "e-posta@ornek.com" --team-id TAKIMID
# parolayı komut sorar; ya da App Store Connect API anahtarıyla:
xcrun notarytool store-credentials rutinfit --key ~/.private_keys/AuthKey_ABC123.p8 --key-id ABC123 --issuer <issuer-uuid>
```

### 2.3 GitHub Secrets (CI)

Settings → Secrets and variables → Actions:

| Sır | İçerik |
| --- | --- |
| `APPLE_CERTIFICATE` | Developer ID Application `.p12` dosyasının base64'ü |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` dışa aktarma parolası |
| `APPLE_API_KEY` / `APPLE_API_ISSUER` / `APPLE_API_KEY_P8` | **Önerilen** notarization yolu: App Store Connect → Users and Access → Integrations → Keys. `APPLE_API_KEY_P8` = `.p8` dosyasının içeriği |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | Alternatif: Apple ID + uygulamaya özel parola + takım kimliği |

```bash
# Anahtar Zinciri Erişimi → sertifika + özel anahtar → Dışa Aktar (.p12), ardından:
base64 -i DeveloperID.p12 | gh secret set APPLE_CERTIFICATE
gh secret set APPLE_CERTIFICATE_PASSWORD            # parolayı sorar
gh secret set APPLE_API_KEY_P8 < ~/.private_keys/AuthKey_ABC123.p8
gh secret set APPLE_API_KEY --body ABC123
gh secret set APPLE_API_ISSUER --body <issuer-uuid>
rm DeveloperID.p12
```

`APPLE_SIGNING_IDENTITY` sır değildir; iş akışı onu `.p12` içinden okur.

## 3. Yerel imzalı derleme ve kuru çalıştırma

```bash
APPLE_SIGNING_IDENTITY="Developer ID Application: Ad Soyad (TAKIMID)" pnpm desktop:build
NOTARYTOOL_PROFILE=rutinfit node scripts/notarize-macos.mjs src-tauri/target/release/bundle/dmg/*.dmg
node scripts/verify-desktop.mjs --distribution
```

- `verify-desktop.mjs`, `.dmg`'yi salt okunur bağlar ve **içindeki** `.app`'i denetler: derin/strict imza,
  her Mach-O dosyasının aynı takım kimliği + hardened runtime + zaman damgası taşıması, entitlements,
  `spctl` (Gatekeeper) ve zımbalı bilet. Ardından gömülü Node ile sunucuyu **geçici** bir veri klasöründe
  açıp `/api/health` ve açılış anahtarı akışını dener. Kullanıcı verisine dokunmaz.
- `--distribution` olmadan (ad-hoc yerel paket) yalnız imza bütünlüğü ve duman testi koşar.
- Notarization profili yerine `APPLE_API_KEY` + `APPLE_API_ISSUER` (+ `.p8` dosyası `~/.private_keys/`
  altında) verirseniz Tauri `.app`'i de notarize edip bileti zımbalar. Yalnız profil verildiğinde `.dmg`
  notarize edilir; içindeki `.app`'in bileti çevrimiçi doğrulanır.

**GitHub'da kuru çalıştırma:** Actions → **Release (macOS)** → **Run workflow**. arm64 ve x64 paketleri
derlenir, imzalanır, notarize edilir ve doğrulanır; `.dmg`'ler iş akışı çıktısı (artifact) olarak indirilebilir.
Release'e dokunulmaz. Sırlar tanımlı değilse ad-hoc paket üretilir.

## 4. Sürüm yayınlama

1. Sürümü üç yerde aynı yapın: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.
2. `main`'e birleştirin ve CI'nın yeşil olduğunu görün.
3. Etiketi gönderin:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
4. **Release (macOS)** iş akışı etiket, `package.json` ve `tauri.conf.json` sürümlerini karşılaştırır; sırlar
   eksikse imzasız sürüm yayınlamaz. Her iki mimari geçince `RutinFit_<sürüm>_aarch64.dmg`,
   `RutinFit_<sürüm>_x64.dmg` ve `SHA256SUMS.txt` **taslak** Release'e yüklenir.
5. GitHub → Releases → taslağı gözden geçirip **Publish release**. Tirelisi olan etiketler (`v0.2.0-beta.1`)
   ön sürüm olarak işaretlenir.

## 5. Elle denetim komutları

```bash
APP=src-tauri/target/release/bundle/macos/RutinFit.app
DMG=$(ls src-tauri/target/release/bundle/dmg/*.dmg)
codesign --verify --deep --strict --verbose=2 "$APP"
codesign -d --entitlements - --xml "$APP/Contents/MacOS/node" | plutil -p -
spctl -a -vv -t exec "$APP"                                      # accepted · source=Notarized Developer ID
spctl -a -vv -t open --context context:primary-signature "$DMG"  # accepted · source=Notarized Developer ID
xcrun stapler validate "$DMG"
```

## 6. Sorun giderme

| Belirti | Neden / çözüm |
| --- | --- |
| `different Team IDs` (SQLite, canvas veya sharp yüklenmiyor) | Native modül imzasız ya da başka kimlikle imzalı. `prepare-desktop` çıktısında "native modül imzalandı" satırı olmalı. |
| Node çıkış 133 / SIGTRAP | Hardened runtime var ama `allow-jit` yok. |
| `spctl`: `rejected · source=Unnotarized Developer ID` | İmza doğru, notarization yapılmamış. `scripts/notarize-macos.mjs` çalıştırın. |
| Notarization `Invalid` | Betik `xcrun notarytool log <id>` çıktısını basar; çoğunlukla imzasız/zaman damgasız bir Mach-O dosyasıdır. |
| `… kimliği anahtar zincirinde yok` | Sertifikayı derlemeden önce anahtar zincirine aktarın (`security find-identity -v -p codesigning`). |
| Eski imzasız paket: `code has no resources but signature indicates they must be present` | Kabuk yalnız bağlayıcının (linker) ad-hoc imzasını taşıyordu. Artık yerel kip de paketi ad-hoc mühürlüyor. |

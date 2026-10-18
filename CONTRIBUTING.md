# RutinFit Desktop — Katkıda Bulunma Rehberi (Contributing Guide)

RutinFit Desktop projesine katkıda bulunmak istediğiniz için teşekkür ederiz! RutinFit, açık kaynak topluluğunun katkılarıyla gelişen, yerel-first ve gizlilik odaklı bir projedir.

---

## 🛠️ Geliştirme Ortamını Hazırlama

### 1. Gereksinimler
* **Node.js:** v20+ (Node v22.18+ önerilir)
* **Paket Yöneticisi:** `pnpm` (`npm install -g pnpm`)
* **Rust & Cargo:** v1.80+ (Masaüstü Tauri paketini derlemek için: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
* **Veritabanı:** SQLite (Ek bir veritabanı sunucusu veya Docker kurulumu gerekmez)

### 2. Depoyu Kurma
```bash
# Depoyu klonlayın
git clone https://github.com/memirutku/rutinfit.git
cd rutinfit

# Bağımlılıkları yükleyin
pnpm install

# Yerel SQLite veritabanını oluşturun ve şablon verileri yükleyin
pnpm run db:push
pnpm run db:seed
```

### 3. Uygulamayı Başlatma
* **Web Geliştirme Modu:**
  ```bash
  pnpm dev -p 3005
  ```
  Tarayıcınızda açın: `http://localhost:3005`
* **Masaüstü Geliştirme Modu (Tauri 2):**
  ```bash
  pnpm run desktop:dev
  ```

---

## 🧪 Test Kuralları ve Kalite Güvencesi

Herhangi bir Pull Request (PR) göndermeden önce tüm otomatik testlerin ve üretim derlemesinin hatasız geçtiğinden emin olun:

```bash
# 38 Vitest testini çalıştırın
pnpm test

# Next.js üretim derlemesini doğrulayın
pnpm run build

# Tauri Cargo derleme kontrolü
cargo check --manifest-path src-tauri/Cargo.toml
```

> [!IMPORTANT]
> Testleri geçmeyen veya var olan bir test süitini bozan hiçbir Pull Request ana dala (main) birleştirilmeyecektir. Yeni bir modül veya hesaplayıcı eklediğinizde `tests/` dizini altına karşılık gelen Vitest testini eklemeniz beklenir.

---

## 📝 Commit Mesajı Formatı (Conventional Commits)

Projede [Conventional Commits](https://www.conventionalcommits.org/) standartları uygulanmaktadır:

* `feat: yeni bir özellik (örn: feat: add barcode scanner camera support)`
* `fix: hata düzeltmesi (örn: fix: resolve plate math remainder issue)`
* `docs: dokümantasyon güncellemesi (örn: docs: update architecture diagrams)`
* `test: test ekleme veya güncelleme (örn: test: add test case for 1RM calculator)`
* `refactor: davranış değiştirmeyen kod iyileştirmesi`

---

## 🔀 Pull Request (PR) Süreci

1. Projeyi kendi GitHub hesabınıza çatallayın (Fork).
2. Yeni bir özellik dalı açın (`git checkout -b feat/harika-ozellik`).
3. Değişikliklerinizi commit edin (`git commit -m "feat: harika ozellik eklendi"`).
4. Dalınızı gönderin (`git push origin feat/harika-ozellik`).
5. GitHub üzerinde ana depoya yönelik bir Pull Request açın.
6. PR şablonundaki tüm kontrol maddelerini doldurun.

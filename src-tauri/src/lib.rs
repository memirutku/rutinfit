//! RutinFit masaüstü kabuğu.
//!
//! Sürüm derlemesinde (release) paketle gelen Node çalışma zamanıyla Next.js "standalone"
//! sunucusunu başlatır, yalnız 127.0.0.1'e bağlar, sunucunun gerçekten bu örnek olduğunu tek
//! kullanımlık bir nonce ile doğrular ve pencereyi açılış anahtarıyla uygulamaya yönlendirir.
//! Geliştirme derlemesinde (`pnpm desktop:dev`) Tauri CLI'nin başlattığı `next dev` kullanılır.

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::webview::{DownloadEvent, NewWindowResponse};
use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// Önce denenen port: localStorage kökeni (taslaklar, son kullanılanlar) sabit kalsın.
pub const PREFERRED_PORT: u16 = 3005;
const STARTUP_TIMEOUT: Duration = Duration::from_secs(60);

/// Çalışan sunucu sürecini uygulama kapanırken sonlandırmak için tutar.
struct ServerProcess(Mutex<Option<Child>>);

// ------------------------------------------------------------------ saf yardımcılar (test edilir)

/// Tercih edilen port boşsa onu, doluysa işletim sisteminin verdiği boş bir portu döner.
pub fn pick_port(preferred: u16) -> std::io::Result<u16> {
  if let Ok(listener) = TcpListener::bind(("127.0.0.1", preferred)) {
    drop(listener);
    return Ok(preferred);
  }
  let listener = TcpListener::bind(("127.0.0.1", 0))?;
  Ok(listener.local_addr()?.port())
}

/// /api/health yanıtının bu örneğe ait olup olmadığını denetler (aynı portta başka bir uygulama olabilir).
pub fn health_matches(http_response: &str, nonce: &str) -> bool {
  let status_ok = http_response.starts_with("HTTP/1.1 200") || http_response.starts_with("HTTP/1.0 200");
  let body = http_response.split("\r\n\r\n").nth(1).unwrap_or("");
  status_ok
    && body.contains("\"app\":\"rutinfit\"")
    && body.contains(&format!("\"nonce\":\"{}\"", nonce))
}

/// Pencerenin açılacağı adres; sunucu ?launch= anahtarıyla HttpOnly oturum çerezi kurar.
pub fn launch_url(port: u16, token: &str) -> String {
  format!("http://127.0.0.1:{}/?launch={}", port, token)
}

/// Uygulama penceresinde kalabilecek adresler: yerel açılış ekranı, 127.0.0.1 sunucusu,
/// indirme/veri adresleri. Diğer her şey sistem tarayıcısında açılır (pencere uzak siteye gitmez).
pub fn is_internal_url(url: &tauri::Url) -> bool {
  match url.scheme() {
    "tauri" | "asset" | "blob" | "data" | "about" => true,
    "http" | "https" => matches!(url.host_str(), Some("127.0.0.1") | Some("localhost") | Some("tauri.localhost")),
    _ => false,
  }
}

/// Yalnız http(s) adreslerini varsayılan tarayıcıda açar.
fn open_externally(url: &tauri::Url) {
  if !matches!(url.scheme(), "http" | "https") {
    log::warn!("Desteklenmeyen dış bağlantı engellendi: {}", url.scheme());
    return;
  }
  #[cfg(target_os = "macos")]
  let result = Command::new("open").arg(url.as_str()).spawn();
  #[cfg(target_os = "windows")]
  let result = Command::new("cmd").args(["/C", "start", "", url.as_str()]).spawn();
  #[cfg(all(unix, not(target_os = "macos")))]
  let result = Command::new("xdg-open").arg(url.as_str()).spawn();
  if let Err(e) = result {
    log::error!("Dış bağlantı açılamadı: {e}");
  }
}

/// Kriptografik rastgele onaltılık dize.
pub fn random_hex(bytes: usize) -> String {
  let mut buf = vec![0u8; bytes];
  getrandom::fill(&mut buf).expect("işletim sistemi rastgele sayı üretemedi");
  buf.iter().map(|b| format!("{:02x}", b)).collect()
}

fn fetch_health(port: u16) -> Option<String> {
  let addr: SocketAddr = format!("127.0.0.1:{}", port).parse().ok()?;
  let mut stream = TcpStream::connect_timeout(&addr, Duration::from_millis(400)).ok()?;
  stream.set_read_timeout(Some(Duration::from_secs(2))).ok()?;
  let req = format!(
    "GET /api/health HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\nAccept: application/json\r\n\r\n",
    port
  );
  stream.write_all(req.as_bytes()).ok()?;
  let mut out = String::new();
  stream.read_to_string(&mut out).ok()?;
  Some(out)
}

// ------------------------------------------------------------------ sunucu yaşam döngüsü

fn bundled_node() -> Option<PathBuf> {
  // Tauri externalBin ikililerini ana çalıştırılabilir dosyanın yanına (Contents/MacOS) koyar.
  let exe = std::env::current_exe().ok()?;
  let candidate = exe.parent()?.join(if cfg!(windows) { "node.exe" } else { "node" });
  candidate.exists().then_some(candidate)
}

fn spawn_server(server_dir: &Path, port: u16, token: &str, nonce: &str) -> std::io::Result<Child> {
  let node = bundled_node().ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "paketlenmiş Node bulunamadı"))?;
  Command::new(node)
    .arg(server_dir.join("desktop-entry.cjs"))
    .current_dir(server_dir)
    .env("PORT", port.to_string())
    .env("HOSTNAME", "127.0.0.1")
    .env("NODE_ENV", "production")
    .env("RUTINFIT_LAUNCH_TOKEN", token)
    .env("RUTINFIT_INSTANCE_NONCE", nonce)
    .env("RUTINFIT_PARENT_PID", std::process::id().to_string())
    .env("RUTINFIT_WATCH_STDIN", "1")
    .env("NEXT_TELEMETRY_DISABLED", "1")
    // Kabuk kapanınca boru kapanır ve sunucu kendini sonlandırır (desktop-entry.cjs)
    .stdin(Stdio::piped())
    .stdout(Stdio::inherit())
    .stderr(Stdio::inherit())
    .spawn()
}

fn splash_status(window: &WebviewWindow, message: &str, is_error: bool) {
  let js = format!(
    "window.rutinfitSplash && window.rutinfitSplash.update({}, {});",
    serde_json::to_string(message).unwrap_or_else(|_| "\"\"".into()),
    is_error
  );
  let _ = window.eval(js);
}

fn start_backend(app: &AppHandle, window: WebviewWindow) {
  let server_dir = match app.path().resource_dir() {
    Ok(dir) => dir.join("server"),
    Err(e) => {
      log::error!("Kaynak klasörü bulunamadı: {e}");
      splash_status(&window, "Uygulama dosyaları bulunamadı. Lütfen uygulamayı yeniden kurun.", true);
      return;
    }
  };

  let port = match pick_port(PREFERRED_PORT) {
    Ok(p) => p,
    Err(e) => {
      log::error!("Boş port bulunamadı: {e}");
      splash_status(&window, "Yerel bağlantı noktası açılamadı.", true);
      return;
    }
  };
  let token = random_hex(32);
  let nonce = random_hex(16);

  match spawn_server(&server_dir, port, &token, &nonce) {
    Ok(child) => {
      log::info!("Sunucu başlatıldı (pid {}, port {})", child.id(), port);
      if let Some(state) = app.try_state::<ServerProcess>() {
        *state.0.lock().unwrap() = Some(child);
      }
    }
    Err(e) => {
      log::error!("Sunucu başlatılamadı: {e}");
      splash_status(&window, "Yerel sunucu başlatılamadı. Ayrıntılar günlük dosyasında.", true);
      return;
    }
  }

  // Ana thread'i bloklamadan hazır olmasını bekle (pencere bu sırada açılış ekranını gösterir).
  std::thread::spawn(move || {
    let started = Instant::now();
    while started.elapsed() < STARTUP_TIMEOUT {
      if let Some(resp) = fetch_health(port) {
        if health_matches(&resp, &nonce) {
          log::info!("Sunucu hazır ({} ms)", started.elapsed().as_millis());
          match tauri::Url::parse(&launch_url(port, &token)) {
            Ok(url) => {
              let _ = window.navigate(url);
            }
            Err(e) => log::error!("Açılış adresi oluşturulamadı: {e}"),
          }
          return;
        }
      }
      std::thread::sleep(Duration::from_millis(250));
    }
    log::error!("Sunucu {} sn içinde hazır olmadı", STARTUP_TIMEOUT.as_secs());
    splash_status(&window, "Yerel sunucu zamanında yanıt vermedi. Uygulamayı kapatıp yeniden açmayı deneyin.", true);
  });
}

fn stop_backend(app: &AppHandle) {
  if let Some(state) = app.try_state::<ServerProcess>() {
    if let Some(mut child) = state.0.lock().unwrap().take() {
      log::info!("Sunucu kapatılıyor (pid {})", child.id());
      let _ = child.kill();
      let _ = child.wait();
    }
  }
}

fn create_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
  let url = if cfg!(debug_assertions) {
    // `pnpm desktop:dev`: Tauri CLI `next dev`i başlatır, pencere doğrudan ona açılır.
    match app.config().build.dev_url.clone() {
      Some(dev) => WebviewUrl::External(dev),
      None => WebviewUrl::App("index.html".into()),
    }
  } else {
    WebviewUrl::App("index.html".into()) // yerel açılış ekranı (src-tauri/splash)
  };

  let downloads = app.path().download_dir().ok();
  WebviewWindowBuilder::new(app, "main", url)
    .title("RutinFit — Kişisel Fitness & Beslenme Asistanı")
    .inner_size(1280.0, 840.0)
    .min_inner_size(980.0, 640.0)
    .resizable(true)
    // Dış bağlantılar (ör. "openGym'i Aç", Open Food Facts) sistem tarayıcısında açılır.
    .on_navigation(|url| {
      if is_internal_url(url) {
        true
      } else {
        open_externally(url);
        false
      }
    })
    .on_new_window(|url, _features| {
      if !is_internal_url(&url) {
        open_externally(&url);
      }
      NewWindowResponse::Deny
    })
    // Yedek dışa aktarma gibi indirmeler İndirilenler klasörüne kaydedilir.
    .on_download(move |_webview, event| {
      match event {
        DownloadEvent::Requested { url, destination } => {
          if let Some(dir) = &downloads {
            let name = destination
              .file_name()
              .map(|n| n.to_owned())
              .unwrap_or_else(|| "rutinfit-indirme".into());
            *destination = dir.join(name);
          }
          log::info!("İndirme başladı: {url} → {}", destination.display());
        }
        DownloadEvent::Finished { url, path, success } => {
          log::info!("İndirme bitti ({success}): {url} → {:?}", path);
        }
        _ => {}
      }
      true
    })
    .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    // İkinci açılış yeni sunucu başlatmaz; mevcut pencereyi öne getirir.
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
      }
    }))
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .targets([
          tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
          tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: Some("rutinfit".into()) }),
        ])
        .build(),
    )
    // F83: hatırlatma bildirimleri (uygulama açıkken)
    .plugin(tauri_plugin_notification::init())
    .manage(ServerProcess(Mutex::new(None)))
    .setup(|app| {
      let handle = app.handle().clone();
      let window = create_main_window(&handle)?;
      if !cfg!(debug_assertions) {
        start_backend(&handle, window);
      }
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("Tauri uygulaması oluşturulamadı");

  app.run(|handle, event| {
    if let RunEvent::Exit = event {
      stop_backend(handle);
    }
  });
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn pick_port_uses_preferred_when_free() {
    let free = TcpListener::bind(("127.0.0.1", 0)).unwrap().local_addr().unwrap().port();
    assert_eq!(pick_port(free).unwrap(), free);
  }

  #[test]
  fn pick_port_falls_back_when_preferred_is_taken() {
    let busy = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let busy_port = busy.local_addr().unwrap().port();
    let picked = pick_port(busy_port).unwrap();
    assert_ne!(picked, busy_port);
    assert!(TcpListener::bind(("127.0.0.1", picked)).is_ok());
  }

  #[test]
  fn health_requires_status_app_and_nonce() {
    let ok = "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n{\"app\":\"rutinfit\",\"version\":\"0.1.0\",\"nonce\":\"abc\"}";
    assert!(health_matches(ok, "abc"));
    assert!(!health_matches(ok, "baska"));
    assert!(!health_matches(&ok.replace("200 OK", "500 Error"), "abc"));
    let other_app = "HTTP/1.1 200 OK\r\n\r\n{\"app\":\"baska-uygulama\",\"nonce\":\"abc\"}";
    assert!(!health_matches(other_app, "abc"));
  }

  #[test]
  fn launch_url_is_loopback_with_token() {
    assert_eq!(launch_url(3005, "t0k"), "http://127.0.0.1:3005/?launch=t0k");
  }

  #[test]
  fn only_local_addresses_stay_in_the_window() {
    let u = |s: &str| tauri::Url::parse(s).unwrap();
    assert!(is_internal_url(&u("http://127.0.0.1:3005/settings")));
    assert!(is_internal_url(&u("tauri://localhost/index.html")));
    assert!(is_internal_url(&u("blob:http://127.0.0.1:3005/abc")));
    assert!(!is_internal_url(&u("https://world.openfoodfacts.org/product/1")));
    assert!(!is_internal_url(&u("http://192.168.1.20:8080/")));
    assert!(!is_internal_url(&u("file:///etc/passwd")));
  }

  #[test]
  fn random_hex_has_expected_length_and_varies() {
    let a = random_hex(16);
    let b = random_hex(16);
    assert_eq!(a.len(), 32);
    assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
    assert_ne!(a, b);
  }
}

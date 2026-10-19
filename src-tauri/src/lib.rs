use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Manager;

fn is_server_listening(addr_str: &str) -> bool {
  if let Ok(addr) = addr_str.parse::<SocketAddr>() {
    TcpStream::connect_timeout(&addr, Duration::from_millis(350)).is_ok()
  } else {
    false
  }
}

fn find_project_dir() -> Option<PathBuf> {
  // 1. Current working directory
  if let Ok(cwd) = std::env::current_dir() {
    if cwd.join("package.json").exists() {
      return Some(cwd);
    }
    if let Some(parent) = cwd.parent() {
      if parent.join("package.json").exists() {
        return Some(parent.to_path_buf());
      }
    }
  }

  // 2. Relative to executable path
  if let Ok(exe) = std::env::current_exe() {
    let mut current = exe.parent();
    for _ in 0..6 {
      if let Some(dir) = current {
        if dir.join("package.json").exists() {
          return Some(dir.to_path_buf());
        }
        current = dir.parent();
      } else {
        break;
      }
    }
  }

  None
}

fn get_augmented_path() -> String {
  let existing_path = std::env::var("PATH").unwrap_or_default();
  let home = std::env::var("HOME").unwrap_or_default();

  let mut extra_paths = vec![
    format!("{}/.nvm/versions/node/v22.18.0/bin", home),
    "/opt/homebrew/bin".to_string(),
    "/opt/homebrew/sbin".to_string(),
    "/usr/local/bin".to_string(),
    "/usr/bin".to_string(),
    "/bin".to_string(),
    "/usr/sbin".to_string(),
    "/sbin".to_string(),
  ];

  if let Ok(entries) = std::fs::read_dir(format!("{}/.nvm/versions/node", home)) {
    for entry in entries.flatten() {
      let bin_dir = entry.path().join("bin");
      if bin_dir.exists() {
        if let Some(s) = bin_dir.to_str() {
          extra_paths.push(s.to_string());
        }
      }
    }
  }

  format!("{}:{}", extra_paths.join(":"), existing_path)
}

fn get_fallback_html() -> String {
  r#"data:text/html;charset=utf-8,<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>RutinFit — Sunucu Bağlantısı</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; box-sizing: border-box; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 36px; max-width: 480px; width: 90%; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    .spinner { width: 36px; height: 36px; border: 4px solid #334155; border-top-color: #10b981; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 20px; font-weight: 700; color: #f8fafc; margin: 0 0 10px 0; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.5; margin: 0 0 20px 0; }
    .badge { display: inline-block; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .code { background: #0f172a; color: #38bdf8; padding: 10px 14px; border-radius: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; margin: 16px 0; text-align: left; }
    .btn { background: #10b981; color: #022c22; font-weight: 700; padding: 10px 22px; border-radius: 12px; border: none; cursor: pointer; font-size: 14px; transition: all 0.2s; }
    .btn:hover { background: #34d399; transform: translateY(-1px); }
    #status { font-size: 13px; color: #38bdf8; font-weight: 500; margin-top: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <div class="badge">RutinFit Başlatılıyor</div>
    <h1>Yerel Sunucuya Bağlanılıyor</h1>
    <p>RutinFit yerel sunucusu (port 3005) başlatılıyor. Hazır olduğunda sayfa otomatik olarak açılacaktır.</p>
    <div class="code">pnpm run desktop</div>
    <div id="status">Bağlantı kontrol ediliyor...</div>
    <div style="margin-top: 24px;">
      <button class="btn" onclick="checkServer(true)">Yeniden Dene</button>
    </div>
  </div>
  <script>
    function checkServer(force) {
      var st = document.getElementById('status');
      if (st) st.innerText = 'Sunucu yanıtı kontrol ediliyor...';
      fetch('http://127.0.0.1:3005/api/diagnostics', { mode: 'no-cors' })
        .then(function() {
          if (st) st.innerText = 'Sunucu hazır! Yönlendiriliyor...';
          window.location.replace('http://127.0.0.1:3005');
        })
        .catch(function() {
          if (force && st) {
            st.innerText = 'Sunucu henüz yanıt vermiyor. Lütfen bekleyin veya terminali kontrol edin.';
          }
        });
    }
    setInterval(function() { checkServer(false); }, 1000);
    setTimeout(function() { checkServer(false); }, 300);
  </script>
</body>
</html>"#
    .to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let child_holder: Arc<Mutex<Option<std::process::Child>>> = Arc::new(Mutex::new(None));
  let child_holder_cleanup = Arc::clone(&child_holder);

  let app = tauri::Builder::default()
    .setup(move |app| {
      if cfg!(debug_assertions) {
        let _ = app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        );
      }

      let addr = "127.0.0.1:3005";
      let mut is_up = is_server_listening(addr);

      if !is_up {
        log::info!("Port 3005 is not responding. Attempting to start local server...");
        if let Some(project_dir) = find_project_dir() {
          log::info!("Found project directory at {:?}", project_dir);
          let path_env = get_augmented_path();
          let spawn_res = std::process::Command::new("/bin/sh")
            .arg("-c")
            .arg("pnpm dev -p 3005 || npm run dev -- -p 3005")
            .current_dir(&project_dir)
            .env("PATH", path_env)
            .spawn();

          match spawn_res {
            Ok(child) => {
              log::info!("Spawned background Next.js dev server with PID {}", child.id());
              if let Ok(mut guard) = child_holder.lock() {
                *guard = Some(child);
              }

              // Wait up to 12 seconds for the server to accept connections
              for _ in 0..24 {
                if is_server_listening(addr) {
                  is_up = true;
                  log::info!("Local server is now up and listening on {}", addr);
                  break;
                }
                std::thread::sleep(Duration::from_millis(500));
              }
            }
            Err(e) => {
              log::warn!("Failed to auto-spawn local server: {}", e);
            }
          }
        } else {
          log::warn!("Could not locate project directory containing package.json");
        }
      } else {
        log::info!("Local server is already active on {}", addr);
      }

      // If the server is still not reachable, navigate to fallback HTML so user never sees a blank white screen
      if !is_up {
        if let Some(window) = app.get_webview_window("main") {
          log::info!("Navigating webview to friendly connection waiting screen...");
          if let Ok(fallback_url) = tauri::Url::parse(&get_fallback_html()) {
            let _ = window.navigate(fallback_url);
          }
        }
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(move |_app_handle, event| {
    if let tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. } = event {
      if let Ok(mut guard) = child_holder_cleanup.lock() {
        if let Some(mut child) = guard.take() {
          log::info!("Terminating spawned Next.js server child process...");
          let _ = child.kill();
        }
      }
    }
  });
}

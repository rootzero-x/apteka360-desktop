//! Apteka 360 — desktop qobiq (Tauri 2).
//!
//! Ilova https://apteka.agrom24.uz web panelini ochadi. Rust tomoni:
//! - ulanishni tekshiradi (`check_online`) — offline bo'lsa lokal o'zbekcha ekran ko'rsatiladi;
//! - har bir sahifaga init-skript kiritadi: API so'rovlariga `X-Client: desktop/<versiya>` va
//!   `X-Client-Device` sarlavhalarini qo'shadi, F11 / Ctrl+± tugmalarini ushlaydi, offline overlay;
//! - menyu: qayta yuklash, zoom, to'liq ekran;
//! - `updater` feature yoqilganda avto-yangilanishni ishga tushiradi.

use std::sync::Mutex;
use std::time::Duration;

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Manager, State, Url, WebviewWindow};

/// Web panel manzili. Kompilyatsiya vaqtida `APTEKA_PANEL_URL` orqali o'zgartirish mumkin.
pub const PANEL_URL: &str = match option_env!("APTEKA_PANEL_URL") {
    Some(u) => u,
    None => "https://apteka.agrom24.uz",
};

const ZOOM_STEPS: [f64; 9] = [0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75];

struct ZoomState(Mutex<usize>);

#[derive(serde::Serialize)]
struct ClientInfo {
    version: String,
    client_header: String,
    device_header: String,
    panel_url: String,
    platform: &'static str,
}

fn ascii_hostname() -> String {
    let raw = gethostname::gethostname().to_string_lossy().to_string();
    let cleaned: String = raw
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .take(40)
        .collect();
    if cleaned.is_empty() {
        "DESKTOP".to_string()
    } else {
        cleaned
    }
}

fn client_info(app: &AppHandle) -> ClientInfo {
    let version = app.package_info().version.to_string();
    ClientInfo {
        client_header: format!("desktop/{version}"),
        device_header: format!("{} · Desktop ilova", ascii_hostname()),
        version,
        panel_url: PANEL_URL.to_string(),
        platform: std::env::consts::OS,
    }
}

/// Panelga ulanish bor-yo'qligini tekshiradi (6 soniya timeout).
#[tauri::command]
async fn check_online(app: AppHandle) -> Result<bool, String> {
    let info = client_info(&app);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(6))
        .user_agent(format!("Apteka360Desktop/{}", info.version))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!("{}/login", PANEL_URL.trim_end_matches('/'));
    match client
        .get(&url)
        .header("X-Client", &info.client_header)
        .header("X-Client-Device", &info.device_header)
        .send()
        .await
    {
        Ok(resp) => Ok(resp.status().as_u16() < 500),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn get_client_info(app: AppHandle) -> ClientInfo {
    client_info(&app)
}

#[tauri::command]
fn toggle_fullscreen(window: WebviewWindow) -> Result<bool, String> {
    let now = window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(!now).map_err(|e| e.to_string())?;
    Ok(!now)
}

/// delta: +1 kattalashtirish, -1 kichraytirish, 0 asl o'lcham.
#[tauri::command]
fn zoom_step(window: WebviewWindow, zoom: State<'_, ZoomState>, delta: i32) -> Result<f64, String> {
    let mut idx = zoom.0.lock().map_err(|e| e.to_string())?;
    let default_idx = ZOOM_STEPS.iter().position(|z| *z == 1.0).unwrap_or(4);
    *idx = match delta {
        0 => default_idx,
        d if d > 0 => (*idx + 1).min(ZOOM_STEPS.len() - 1),
        _ => idx.saturating_sub(1),
    };
    let factor = ZOOM_STEPS[*idx];
    window.set_zoom(factor).map_err(|e| e.to_string())?;
    Ok(factor)
}

#[tauri::command]
fn go_home(window: WebviewWindow) -> Result<(), String> {
    let url = Url::parse(PANEL_URL).map_err(|e| e.to_string())?;
    window.navigate(url).map_err(|e| e.to_string())
}

#[tauri::command]
fn reload_page(window: WebviewWindow) -> Result<(), String> {
    window.eval("window.location.reload()").map_err(|e| e.to_string())
}

fn init_script(info: &ClientInfo) -> String {
    include_str!("inject.js")
        .replace("__CLIENT_HEADER__", &info.client_header)
        .replace("__DEVICE_HEADER__", &info.device_header)
        .replace("__PANEL_URL__", &info.panel_url)
        .replace("__APP_VERSION__", &info.version)
}

fn build_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let reload = MenuItemBuilder::with_id("reload", "Qayta yuklash")
        .accelerator("CmdOrCtrl+R")
        .build(app)?;
    let home = MenuItemBuilder::with_id("home", "Bosh sahifa")
        .accelerator("Alt+Home")
        .build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Chiqish")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;
    let file = SubmenuBuilder::new(app, "Fayl")
        .item(&home)
        .item(&reload)
        .separator()
        .item(&quit)
        .build()?;

    let zoom_in = MenuItemBuilder::with_id("zoom_in", "Kattalashtirish")
        .accelerator("CmdOrCtrl+=")
        .build(app)?;
    let zoom_out = MenuItemBuilder::with_id("zoom_out", "Kichraytirish")
        .accelerator("CmdOrCtrl+-")
        .build(app)?;
    let zoom_reset = MenuItemBuilder::with_id("zoom_reset", "Asl o'lcham")
        .accelerator("CmdOrCtrl+0")
        .build(app)?;
    let fullscreen = MenuItemBuilder::with_id("fullscreen", "To'liq ekran")
        .accelerator("F11")
        .build(app)?;
    let view = SubmenuBuilder::new(app, "Ko'rinish")
        .item(&zoom_in)
        .item(&zoom_out)
        .item(&zoom_reset)
        .separator()
        .item(&fullscreen)
        .build()?;

    let version = app.package_info().version.to_string();
    let about = MenuItemBuilder::with_id("about", format!("Apteka 360 Desktop v{version}"))
        .enabled(false)
        .build(app)?;
    let open_browser = MenuItemBuilder::with_id("open_browser", "Brauzerda ochish")
        .build(app)?;
    let help = SubmenuBuilder::new(app, "Yordam")
        .item(&open_browser)
        .separator()
        .item(&about)
        .build()?;

    MenuBuilder::new(app).items(&[&file, &view, &help]).build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(ZoomState(Mutex::new(4)))
        .invoke_handler(tauri::generate_handler![
            check_online,
            get_client_info,
            toggle_fullscreen,
            zoom_step,
            go_home,
            reload_page
        ]);

    #[cfg(feature = "updater")]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_dialog::init());
    }

    builder
        .setup(|app| {
            let handle = app.handle().clone();
            let info = client_info(&handle);

            // Asosiy oyna tauri.conf.json dan yaratiladi; init-skriptni unga qo'shish uchun
            // oynani qayta quramiz (conf'dagi oyna faqat shablon).
            if let Some(w) = app.get_webview_window("main") {
                w.close()?;
            }
            let mut wb = tauri::WebviewWindowBuilder::from_config(
                &handle,
                &app.config().app.windows[0],
            )?
            .initialization_script(init_script(&info));

            // Dastlabki navigatsiya so'roviga ham X-Client sarlavhalari qo'shiladi
            // (keyingi fetch/XHR so'rovlari init-skript orqali belgilanadi).
            let mut headers = tauri::http::HeaderMap::new();
            if let (Ok(c), Ok(d)) = (
                info.client_header.parse(),
                info.device_header.parse(),
            ) {
                headers.insert("X-Client", c);
                headers.insert("X-Client-Device", d);
            }
            wb = wb.headers(headers)?;

            let window = wb.build()?;
            window.set_menu(build_menu(&handle)?)?;
            let _ = window.set_title("Apteka 360");

            #[cfg(feature = "updater")]
            {
                let h = handle.clone();
                tauri::async_runtime::spawn(async move { updater::check(h).await });
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            let Some(window) = app.get_webview_window("main") else { return };
            let zoom = app.state::<ZoomState>();
            match event.id().as_ref() {
                "reload" => { let _ = reload_page(window); }
                "home" => { let _ = go_home(window); }
                "quit" => app.exit(0),
                "zoom_in" => { let _ = zoom_step(window, zoom, 1); }
                "zoom_out" => { let _ = zoom_step(window, zoom, -1); }
                "zoom_reset" => { let _ = zoom_step(window, zoom, 0); }
                "fullscreen" => { let _ = toggle_fullscreen(window); }
                "open_browser" => {
                    use tauri_plugin_shell::ShellExt;
                    let _ = app.shell().open(PANEL_URL, None);
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("Apteka 360 ilovasini ishga tushirib bo'lmadi");
}

#[cfg(feature = "updater")]
mod updater {
    use tauri::AppHandle;
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
    use tauri_plugin_updater::UpdaterExt;

    /// Ishga tushganda yangilanishni tekshiradi; topilsa foydalanuvchidan so'raydi,
    /// yuklab o'rnatadi va ilovani qayta ishga tushiradi.
    pub async fn check(app: AppHandle) {
        let Ok(updater) = app.updater() else { return };
        let Ok(Some(update)) = updater.check().await else { return };
        let ok = app
            .dialog()
            .message(format!(
                "Apteka 360 ning yangi versiyasi mavjud: {}.\nHozir yangilansinmi?",
                update.version
            ))
            .title("Yangilanish")
            .kind(MessageDialogKind::Info)
            .buttons(MessageDialogButtons::OkCancelCustom("Yangilash".into(), "Keyinroq".into()))
            .blocking_show();
        if !ok {
            return;
        }
        if update.download_and_install(|_, _| {}, || {}).await.is_ok() {
            app.restart();
        }
    }
}

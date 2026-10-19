//! Apteka 360 — desktop qobiq (Tauri 2).
//!
//! Ilova https://apteka.agrom24.uz web panelini ochadi. Rust tomoni:
//! - ulanishni tekshiradi (`check_online`) — offline bo'lsa lokal o'zbekcha ekran ko'rsatiladi;
//! - har bir sahifaga init-skript kiritadi: API so'rovlariga `X-Client: desktop/<versiya>` va
//!   `X-Client-Device` sarlavhalarini qo'shadi, F11 / Ctrl+± tugmalarini ushlaydi, offline overlay;
//! - menyu, tizim tray ikonkasi, bitta nusxa, oyna holatini eslab qolish, avtostart;
//! - `updater` feature yoqilganda avto-yangilanishni ishga tushiradi.

use std::sync::Mutex;
use std::time::Duration;

use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::{PermissionKind, PermissionResponse};
use tauri::{AppHandle, LogicalSize, Manager, State, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_autostart::ManagerExt as _;

/// Web panel manzili. Kompilyatsiya vaqtida `APTEKA_PANEL_URL` orqali o'zgartirish mumkin.
pub const PANEL_URL: &str = match option_env!("APTEKA_PANEL_URL") {
    Some(u) => u,
    None => "https://apteka.agrom24.uz",
};

const WINDOW_LABEL: &str = "main";
const ZOOM_STEPS: [f64; 9] = [0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75];
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Apteka360Desktop";

struct ZoomState(Mutex<usize>);
/// Oynani yopganda trayga yig'ish (true) yoki ilovadan chiqish (false).
struct CloseToTray(Mutex<bool>);

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
    if cleaned.is_empty() { "DESKTOP".to_string() } else { cleaned }
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

/// URL panel domeniga (yoki APTEKA_PANEL_URL hostiga) tegishlimi.
fn is_panel_origin(url: &Url) -> bool {
    let panel_host = Url::parse(PANEL_URL).ok().and_then(|u| u.host_str().map(str::to_owned));
    match (url.host_str(), panel_host) {
        (Some(h), Some(p)) => h.eq_ignore_ascii_case(&p) || h.to_ascii_lowercase().ends_with(".agrom24.uz"),
        _ => false,
    }
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(WINDOW_LABEL) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn build_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let home = MenuItemBuilder::with_id("home", "Bosh sahifa").accelerator("Alt+Home").build(app)?;
    let reload = MenuItemBuilder::with_id("reload", "Qayta yuklash").accelerator("CmdOrCtrl+R").build(app)?;
    let autostart_on = app.autolaunch().is_enabled().unwrap_or(false);
    let autostart = CheckMenuItemBuilder::with_id("autostart", "Windows bilan ishga tushirish")
        .checked(autostart_on)
        .build(app)?;
    let close_tray = CheckMenuItemBuilder::with_id("close_to_tray", "Yopganda trayga yig'ish")
        .checked(true)
        .build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Chiqish").accelerator("CmdOrCtrl+Q").build(app)?;
    let file = SubmenuBuilder::new(app, "Fayl")
        .item(&home)
        .item(&reload)
        .separator()
        .item(&autostart)
        .item(&close_tray)
        .separator()
        .item(&quit)
        .build()?;

    let zoom_in = MenuItemBuilder::with_id("zoom_in", "Kattalashtirish").accelerator("CmdOrCtrl+=").build(app)?;
    let zoom_out = MenuItemBuilder::with_id("zoom_out", "Kichraytirish").accelerator("CmdOrCtrl+-").build(app)?;
    let zoom_reset = MenuItemBuilder::with_id("zoom_reset", "Asl o'lcham").accelerator("CmdOrCtrl+0").build(app)?;
    let fullscreen = MenuItemBuilder::with_id("fullscreen", "To'liq ekran").accelerator("F11").build(app)?;
    let view = SubmenuBuilder::new(app, "Ko'rinish")
        .item(&zoom_in)
        .item(&zoom_out)
        .item(&zoom_reset)
        .separator()
        .item(&fullscreen)
        .build()?;

    let version = app.package_info().version.to_string();
    let about = MenuItemBuilder::with_id("about", format!("Apteka 360 Desktop v{version}")).enabled(false).build(app)?;
    let open_browser = MenuItemBuilder::with_id("open_browser", "Brauzerda ochish").build(app)?;
    let help = SubmenuBuilder::new(app, "Yordam").item(&open_browser).separator().item(&about).build()?;

    MenuBuilder::new(app).items(&[&file, &view, &help]).build()
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("tray_show", "Apteka 360 ni ochish").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Chiqish").build(app)?;
    let menu = MenuBuilder::new(app).items(&[&show]).separator().items(&[&quit]).build()?;
    let mut tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("Apteka 360")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

fn handle_menu(app: &AppHandle, id: &str) {
    let Some(window) = app.get_webview_window(WINDOW_LABEL) else { return };
    let zoom = app.state::<ZoomState>();
    match id {
        "reload" => { let _ = reload_page(window); }
        "home" => { let _ = go_home(window); }
        "quit" => app.exit(0),
        "tray_show" => show_main(app),
        "zoom_in" => { let _ = zoom_step(window, zoom, 1); }
        "zoom_out" => { let _ = zoom_step(window, zoom, -1); }
        "zoom_reset" => { let _ = zoom_step(window, zoom, 0); }
        "fullscreen" => { let _ = toggle_fullscreen(window); }
        "autostart" => {
            let al = app.autolaunch();
            let _ = if al.is_enabled().unwrap_or(false) { al.disable() } else { al.enable() };
        }
        "close_to_tray" => {
            if let Ok(mut v) = app.state::<CloseToTray>().0.lock() { *v = !*v; }
        }
        "open_browser" => {
            use tauri_plugin_opener::OpenerExt;
            let _ = app.opener().open_url(PANEL_URL, None::<&str>);
        }
        _ => {}
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        // Bitta nusxa: ikkinchi marta ochilsa mavjud oyna ko'tariladi
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .manage(ZoomState(Mutex::new(4)))
        .manage(CloseToTray(Mutex::new(true)))
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

            let window = WebviewWindowBuilder::new(app, WINDOW_LABEL, WebviewUrl::App("index.html".into()))
                .title("Apteka 360")
                .inner_size(1366.0, 860.0)
                .min_inner_size(1280.0, 800.0)
                .center()
                .resizable(true)
                .maximizable(true)
                .decorations(true)
                .user_agent(USER_AGENT)
                .zoom_hotkeys_enabled(true)
                .initialization_script(init_script(&info))
                // Kamera ovozi va «Gapirish» (push-to-talk): panel getUserMedia(audio) so'raydi,
                // HLS ovozni ijro etadi. Faqat panel domeni uchun ruxsat beriladi,
                // boshqa sahifalar standart (platforma) tartibida qoladi.
                .on_permission_request(|webview, kind| {
                    let trusted = webview
                        .url()
                        .map(|u| is_panel_origin(&u))
                        .unwrap_or(false);
                    match kind {
                        PermissionKind::Microphone | PermissionKind::Camera | PermissionKind::Autoplay
                            if trusted => PermissionResponse::Allow,
                        PermissionKind::Autoplay => PermissionResponse::Allow,
                        _ => PermissionResponse::Default,
                    }
                })
                .build()?;
            let _ = window.set_min_size(Some(LogicalSize::new(1280.0, 800.0)));
            window.set_menu(build_menu(&handle)?)?;

            // Oynani yopish → trayga yig'ish (sozlamaga qarab)
            let h = handle.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let to_tray = h.state::<CloseToTray>().0.lock().map(|v| *v).unwrap_or(true);
                    if to_tray {
                        api.prevent_close();
                        if let Some(w) = h.get_webview_window(WINDOW_LABEL) { let _ = w.hide(); }
                    }
                }
            });

            build_tray(&handle)?;

            #[cfg(feature = "updater")]
            {
                let h = handle.clone();
                tauri::async_runtime::spawn(async move { updater::check(h).await });
            }
            Ok(())
        })
        .on_menu_event(|app, event| handle_menu(app, event.id().as_ref()))
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
        if !ok { return; }
        if update.download_and_install(|_, _| {}, || {}).await.is_ok() {
            app.restart();
        }
    }
}

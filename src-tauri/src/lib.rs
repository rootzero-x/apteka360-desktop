//! Apteka 360 — native desktop qobiq (Tauri 2, multiwebview).
//!
//! Arxitektura: bitta `Window` («main») ichida ikkita child-webview:
//! - `shell`  — lokal `ui/index.html`: Fluent uslubidagi yon panel, buyruqlar paneli, holat paneli,
//!              offline ekrani. Butun oynani egallaydi (auto_resize).
//! - `panel`  — https://apteka.agrom24.uz web paneli; qobiq ko'rsatgan «kontent» maydonida joylashadi
//!              (`set_panel_bounds`). Unga init-skript (inject.js) kiritiladi: X-Client sarlavhalari,
//!              tugmalar, panelning o'z yon panelini yashirish (compact rejim), tarmoq holati.
//! Rust: ulanish tekshiruvi, tray, bitta nusxa, oyna holati, avtostart, native dialoglar,
//! mikrofon/kamera/autoplay ruxsati (faqat panel domeni), ixtiyoriy avto-yangilanish.

use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::menu::{CheckMenuItemBuilder, ContextMenu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::{PermissionKind, PermissionResponse, WebviewBuilder};
use tauri::window::WindowBuilder;
use tauri::{
    AppHandle, Emitter, EventTarget, LogicalPosition, LogicalSize, Manager, Rect, State, Url, Webview, WebviewUrl,
    Window, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

/// Web panel manzili. Kompilyatsiya vaqtida `APTEKA_PANEL_URL` orqali o'zgartirish mumkin.
pub const PANEL_URL: &str = match option_env!("APTEKA_PANEL_URL") {
    Some(u) => u,
    None => "https://apteka.agrom24.uz",
};

/// API manzili (qobiqdagi native login shu yerga murojaat qiladi — panel webview konteksti orqali).
pub const API_URL: &str = match option_env!("APTEKA_API_URL") {
    Some(u) => u,
    None => "https://api-apteka.agrom24.uz",
};

const WINDOW: &str = "main";
/// capabilities/remote.json bilan bir xil (maxsus panel manzili uchun runtime capability).
const REMOTE_PERMISSIONS: &[&str] = &["core:event:default", "allow-toggle-fullscreen", "allow-zoom-step", "allow-panel-reload", "allow-panel-back", "allow-panel-forward", "allow-report-network", "allow-get-client-info", "allow-api-result", "allow-report-token", "allow-shell-home"];
const SHELL: &str = "shell";
const PANEL: &str = "panel";
const ZOOM_STEPS: [f64; 9] = [0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75];
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Apteka360Desktop";

struct ZoomState(Mutex<usize>);
/// Joriy access token (15 daqiqa). Panel webview'dagi init-skript auth javoblaridan va so'rov sarlavhalaridan oladi.
struct TokenState(Mutex<Option<String>>);
/// Oynani yopganda trayga yig'ish (true) yoki ilovadan chiqish (false).
struct CloseToTray(Mutex<bool>);

#[derive(Serialize, Clone)]
struct ClientInfo {
    version: String,
    client_header: String,
    device_header: String,
    hostname: String,
    panel_url: String,
    api_url: String,
    platform: &'static str,
    /// `APTEKA_SELFTEST=1` (runtime): qobiq login ko'prigini avtomatik sinaydi (faqat diagnostika).
    selftest: bool,
    /// `APTEKA_SELFTEST_ROUTE` — diagnostika: kirgandan keyin ochiladigan ekran.
    selftest_route: Option<String>,
    selftest_role: Option<String>,
}

#[derive(Serialize, Clone)]
struct ApiResult {
    id: String,
    status: u16,
    body: serde_json::Value,
}

#[derive(Serialize, Clone)]
struct Prefs {
    autostart: bool,
    close_to_tray: bool,
}

#[derive(Serialize, Clone)]
struct PanelEvent<'a> {
    kind: &'a str,
    url: String,
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
    let hostname = ascii_hostname();
    ClientInfo {
        client_header: format!("desktop/{version}"),
        // HTTP sarlavhasi faqat ASCII bo'lishi kerak («·» UTF-8 da buziladi)
        device_header: format!("{hostname} - Desktop ilova"),
        hostname,
        version,
        panel_url: PANEL_URL.to_string(),
        api_url: API_URL.to_string(),
        platform: std::env::consts::OS,
        selftest: std::env::var("APTEKA_SELFTEST").map(|v| v == "1").unwrap_or(false),
        selftest_route: std::env::var("APTEKA_SELFTEST_ROUTE").ok(),
        selftest_role: std::env::var("APTEKA_SELFTEST_ROLE").ok(),
    }
}

/// URL panel domeniga (yoki APTEKA_PANEL_URL hostiga) tegishlimi.
fn is_panel_origin(url: &Url) -> bool {
    let panel_host = Url::parse(PANEL_URL).ok().and_then(|u| u.host_str().map(str::to_owned));
    match (url.host_str(), panel_host) {
        (Some(h), Some(p)) => h.eq_ignore_ascii_case(&p) || h.to_ascii_lowercase().ends_with(".agrom24.uz"),
        _ => false,
    }
}

fn panel(app: &AppHandle) -> Result<Webview, String> {
    app.get_webview(PANEL).ok_or_else(|| "panel webview topilmadi".to_string())
}
fn main_window(app: &AppHandle) -> Result<Window, String> {
    app.get_window(WINDOW).ok_or_else(|| "asosiy oyna topilmadi".to_string())
}
fn emit_shell<S: Serialize + Clone>(app: &AppHandle, event: &str, payload: S) {
    let _ = app.emit_to(EventTarget::webview(SHELL), event, payload);
}

// ----------------------------------------------------------------------------- buyruqlar

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
fn toggle_fullscreen(app: AppHandle) -> Result<bool, String> {
    let w = main_window(&app)?;
    let now = w.is_fullscreen().map_err(|e| e.to_string())?;
    w.set_fullscreen(!now).map_err(|e| e.to_string())?;
    emit_shell(&app, "fullscreen", !now);
    Ok(!now)
}

/// delta: +1 kattalashtirish, -1 kichraytirish, 0 asl o'lcham. Natija: zoom foizi.
#[tauri::command]
fn zoom_step(app: AppHandle, zoom: State<'_, ZoomState>, delta: i32) -> Result<f64, String> {
    let mut idx = zoom.0.lock().map_err(|e| e.to_string())?;
    let default_idx = ZOOM_STEPS.iter().position(|z| *z == 1.0).unwrap_or(4);
    *idx = match delta {
        0 => default_idx,
        d if d > 0 => (*idx + 1).min(ZOOM_STEPS.len() - 1),
        _ => idx.saturating_sub(1),
    };
    let factor = ZOOM_STEPS[*idx];
    panel(&app)?.set_zoom(factor).map_err(|e| e.to_string())?;
    emit_shell(&app, "zoom", (factor * 100.0).round());
    Ok(factor)
}

/// `path` — "/cameras" kabi yo'l yoki to'liq URL.
#[tauri::command]
fn panel_navigate(app: AppHandle, path: String) -> Result<(), String> {
    let url = if path.starts_with("http") {
        Url::parse(&path)
    } else {
        Url::parse(PANEL_URL).and_then(|b| b.join(&path))
    }
    .map_err(|e| e.to_string())?;
    if !is_panel_origin(&url) {
        return Err("faqat panel domeni".into());
    }
    panel(&app)?.navigate(url).map_err(|e| e.to_string())
}

/// Panelning o'z yon panelini yashirish/ko'rsatish (inject.js dagi __aptekaSetCompact).
#[tauri::command]
fn panel_eval_compact(app: AppHandle, on: bool) -> Result<(), String> {
    panel(&app)?
        .eval(format!("window.__aptekaSetCompact && window.__aptekaSetCompact({on})"))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn panel_reload(app: AppHandle) -> Result<(), String> {
    panel(&app)?.reload().map_err(|e| e.to_string())
}
#[tauri::command]
fn panel_back(app: AppHandle) -> Result<(), String> {
    panel(&app)?.eval("history.back()").map_err(|e| e.to_string())
}
#[tauri::command]
fn panel_forward(app: AppHandle) -> Result<(), String> {
    panel(&app)?.eval("history.forward()").map_err(|e| e.to_string())
}

/// Qobiq kontent maydonini (mantiqiy piksel) xabar qiladi — panel shu joyga qo'yiladi.
/// Linux (WebKitGTK): Tauri child-webview'larni GtkBox'ga ketma-ket joylaydi, pozitsiya ishlamaydi.
/// Shuning uchun Linux'da bir vaqtda faqat bitta webview ko'rinadi (panel yoki qobiq).
const STACKED_FALLBACK: bool = cfg!(target_os = "linux");

#[tauri::command]
fn set_panel_bounds(app: AppHandle, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    if STACKED_FALLBACK { return Ok(()); }
    let p = panel(&app)?;
    p.set_bounds(Rect {
        position: LogicalPosition::new(x, y).into(),
        size: LogicalSize::new(width.max(1.0), height.max(1.0)).into(),
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_panel_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    let p = panel(&app)?;
    if STACKED_FALLBACK {
        if let Some(sh) = app.get_webview(SHELL) {
            let _ = if visible { sh.hide() } else { sh.show() };
        }
    }
    if visible { p.show() } else { p.hide() }.map_err(|e| e.to_string())
}

/// «⋯» tugmasi: native kontekst menyusi (oyna koordinatalarida, mantiqiy piksel).
#[tauri::command]
fn show_more_menu(app: AppHandle, close_to_tray: State<'_, CloseToTray>, x: f64, y: f64, compact: bool) -> Result<(), String> {
    let w = main_window(&app)?;
    let b = |id: &str, label: &str, acc: Option<&str>| {
        let mut m = MenuItemBuilder::with_id(id, label);
        if let Some(a) = acc { m = m.accelerator(a); }
        m.build(&app).map_err(|e| e.to_string())
    };
    let home = b("m_home", "Bosh sahifa", Some("Alt+Home"))?;
    let reload = b("m_reload", "Qayta yuklash", Some("F5"))?;
    let browser = b("m_browser", "Brauzerda ochish", None)?;
    let compact_i = CheckMenuItemBuilder::with_id("m_compact", "Panel navigatsiyasini yashirish").checked(compact).build(&app).map_err(|e| e.to_string())?;
    let autostart = CheckMenuItemBuilder::with_id("m_autostart", "Windows bilan ishga tushirish")
        .checked(app.autolaunch().is_enabled().unwrap_or(false)).build(&app).map_err(|e| e.to_string())?;
    let tray = CheckMenuItemBuilder::with_id("m_tray", "Yopganda trayga yig'ish")
        .checked(close_to_tray.0.lock().map(|v| *v).unwrap_or(true)).build(&app).map_err(|e| e.to_string())?;
    let fs = b("m_fs", "To'liq ekran", Some("F11"))?;
    let about = b("m_about", "Apteka 360 haqida", None)?;
    let logout = b("m_logout", "Hisobdan chiqish", None)?;
    let quit = b("m_quit", "Chiqish", Some("Ctrl+Q"))?;
    let sep = || PredefinedMenuItem::separator(&app).map_err(|e| e.to_string());
    let menu = MenuBuilder::new(&app)
        .items(&[&home, &reload, &browser, &sep()?, &compact_i, &autostart, &tray, &sep()?, &fs, &about, &sep()?, &logout, &quit])
        .build().map_err(|e| e.to_string())?;
    menu.popup_at(w, LogicalPosition::new(x, y)).map_err(|e| e.to_string())
}

fn handle_menu(app: &AppHandle, id: &str) {
    match id {
        "m_home" => { let _ = panel_navigate(app.clone(), "/dashboard".into()); }
        "m_reload" => { let _ = panel_reload(app.clone()); }
        "m_browser" => { let _ = open_in_browser(app.clone()); }
        "m_compact" => emit_shell(app, "menu", "compact"),
        "m_logout" => emit_shell(app, "menu", "logout"),
        "m_autostart" => {
            let al = app.autolaunch();
            let on = al.is_enabled().unwrap_or(false);
            let _ = if on { al.disable() } else { al.enable() };
            emit_shell(app, "prefs", get_prefs(app.clone(), app.state::<CloseToTray>()));
        }
        "m_tray" => {
            if let Ok(mut v) = app.state::<CloseToTray>().0.lock() { *v = !*v; }
            emit_shell(app, "prefs", get_prefs(app.clone(), app.state::<CloseToTray>()));
        }
        "m_fs" => { let _ = toggle_fullscreen(app.clone()); }
        "m_about" => show_about(app.clone()),
        "m_quit" | "tray_quit" => app.exit(0),
        "tray_show" => show_main(app),
        _ => {}
    }
}

/// Native login: API so'rovi **panel webview konteksti** (apteka.agrom24.uz origin) orqali bajariladi —
/// shunda httpOnly refresh-cookie web paneldagi kabi o'rnatiladi va panel sessiyani o'zi tiklaydi.
/// Natija `api_result` buyrug'i orqali qaytib, qobiqqa `api` hodisasi sifatida yetkaziladi.
#[tauri::command]
fn panel_api(app: AppHandle, tokens: State<'_, TokenState>, id: String, path: String, body: serde_json::Value) -> Result<(), String> {
    if !path.starts_with("/v1/auth/") && path != "/v1/me" {
        return Err("faqat auth yo'llari".into());
    }
    let auth = if path == "/v1/auth/logout" {
        tokens.0.lock().ok().and_then(|t| t.clone()).map(|t| format!("Bearer {t}")).unwrap_or_default()
    } else {
        String::new()
    };
    let js = format!(
        r#"(function(){{var id={id},url={url},body={body},auth={auth},h={{'Content-Type':'application/json'}};if(auth)h.Authorization=auth;
fetch(url,{{method:'POST',credentials:'include',headers:h,body:JSON.stringify(body)}})
.then(function(r){{return r.text().then(function(t){{var b;try{{b=JSON.parse(t)}}catch(e){{b={{}}}}if(b){{delete b.refreshToken;delete b.accessToken;}}
  window.__TAURI__.core.invoke('api_result',{{id:id,status:r.status,body:b}});}});}})
.catch(function(e){{window.__TAURI__.core.invoke('api_result',{{id:id,status:0,body:{{error:'Server bilan aloqa yo‘q. Internetni tekshiring.',code:'unavailable',detail:String(e&&e.message||e)}}}});}});}})();"#,
        id = serde_json::to_string(&id).map_err(|e| e.to_string())?,
        url = serde_json::to_string(&format!("{}{}", API_URL.trim_end_matches('/'), path)).map_err(|e| e.to_string())?,
        body = serde_json::to_string(&body).map_err(|e| e.to_string())?,
        auth = serde_json::to_string(&auth).map_err(|e| e.to_string())?,
    );
    panel(&app)?.eval(js).map_err(|e| e.to_string())
}

/// Panel webview: yangi access token (auth javobi yoki Authorization sarlavhasidan).
#[tauri::command]
fn report_token(app: AppHandle, tokens: State<'_, TokenState>, token: Option<String>) {
    let changed = {
        let mut t = match tokens.0.lock() { Ok(t) => t, Err(_) => return };
        let changed = *t != token;
        *t = token.clone();
        changed
    };
    if changed {
        emit_shell(&app, "token", token.is_some());
    }
}

/// Panel (Linux zaxira rejimi) → qobiqning native bosh sahifasiga qaytish.
/// Diagnostika: qobiq jurnalini stderr'ga yozish (APTEKA_DEBUG=1 bo'lganda).
#[tauri::command]
fn debug_log(msg: String) {
    if std::env::var("APTEKA_DEBUG").map(|v| v == "1").unwrap_or(false) {
        eprintln!("[shell] {msg}");
    }
}

#[tauri::command]
fn shell_home(app: AppHandle) {
    emit_shell(&app, "menu", "native-home");
}

#[tauri::command]
fn has_token(tokens: State<'_, TokenState>) -> bool {
    tokens.0.lock().map(|t| t.is_some()).unwrap_or(false)
}

/// Native ekranlar uchun API so'rovi (Rust → reqwest; CORS yo'q). `idem` — buyruqlar uchun Idempotency-Key.
#[tauri::command]
async fn api(
    app: AppHandle,
    method: String,
    path: String,
    body: Option<serde_json::Value>,
    idem: Option<String>,
) -> Result<ApiResult, String> {
    // Kirish/refresh faqat panel ko'prigi orqali (cookie); sessiyalar va kirishlar tarixini o'qishga ruxsat
    let auth_read = method == "GET" && (path == "/v1/auth/sessions" || path == "/v1/auth/logins" || path.starts_with("/v1/auth/sessions?") || path.starts_with("/v1/auth/logins?"));
    if !path.starts_with("/v1/") || (path.starts_with("/v1/auth/") && !auth_read) {
        return Err("ruxsat etilmagan yo'l".into());
    }
    let token = app.state::<TokenState>().0.lock().map_err(|e| e.to_string())?.clone();
    let info = client_info(&app);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(25))
        .user_agent(format!("Apteka360Desktop/{}", info.version))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!("{}{}", API_URL.trim_end_matches('/'), path);
    let mut req = match method.as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "PATCH" => client.patch(&url),
        "DELETE" => client.delete(&url),
        _ => return Err("noma'lum HTTP metod".into()),
    }
    .header("X-Client", &info.client_header)
    .header("X-Client-Device", &info.device_header);
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }
    if let Some(k) = idem {
        req = req.header("Idempotency-Key", k);
    }
    if let Some(b) = body {
        req = req
            .header("Content-Type", "application/json")
            .body(serde_json::to_vec(&b).map_err(|e| e.to_string())?);
    }
    match req.send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let text = resp.text().await.unwrap_or_default();
            let body = serde_json::from_str(&text).unwrap_or(serde_json::Value::Null);
            Ok(ApiResult { id: String::new(), status, body })
        }
        Err(e) => Ok(ApiResult {
            id: String::new(),
            status: 0,
            body: serde_json::json!({ "error": "Server bilan aloqa yo‘q. Internetni tekshiring.", "code": "unavailable", "detail": e.to_string() }),
        }),
    }
}

#[tauri::command]
fn api_result(app: AppHandle, id: String, status: u16, body: serde_json::Value) {
    emit_shell(&app, "api", ApiResult { id, status, body });
}

/// Panel ichidagi init-skript `online`/`offline` hodisalarini xabar qiladi → qobiq offline ekranini ko'rsatadi.
#[tauri::command]
fn report_network(app: AppHandle, online: bool) {
    emit_shell(&app, "network", online);
}

#[tauri::command]
fn get_prefs(app: AppHandle, close_to_tray: State<'_, CloseToTray>) -> Prefs {
    Prefs {
        autostart: app.autolaunch().is_enabled().unwrap_or(false),
        close_to_tray: close_to_tray.0.lock().map(|v| *v).unwrap_or(true),
    }
}

#[tauri::command]
fn set_pref(app: AppHandle, close_to_tray: State<'_, CloseToTray>, key: String, value: bool) -> Result<Prefs, String> {
    match key.as_str() {
        "autostart" => {
            let al = app.autolaunch();
            if value { al.enable() } else { al.disable() }.map_err(|e| e.to_string())?;
        }
        "close_to_tray" => {
            if let Ok(mut v) = close_to_tray.0.lock() { *v = value; }
        }
        _ => return Err("noma'lum sozlama".into()),
    }
    Ok(get_prefs(app, close_to_tray))
}

#[tauri::command]
fn show_about(app: AppHandle) {
    let info = client_info(&app);
    app.dialog()
        .message(format!(
            "Apteka 360 Desktop v{}\n\nDorixona tarmog'i boshqaruv tizimi.\nServer: {}\nQurilma: {}\n\n© Apteka 360",
            info.version, info.panel_url, info.hostname
        ))
        .title("Apteka 360 haqida")
        .kind(MessageDialogKind::Info)
        .show(|_| {});
}

#[tauri::command]
fn open_in_browser(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(PANEL_URL, None::<&str>).map_err(|e| e.to_string())
}

/// API serveridagi faylni (masalan imzolangan hisobot havolasi) tizim brauzerida ochish — faqat API/panel domeni.
#[tauri::command]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let u = Url::parse(&url).map_err(|e| e.to_string())?;
    let api_host = Url::parse(API_URL).ok().and_then(|x| x.host_str().map(str::to_owned));
    let ok = is_panel_origin(&u) || (u.host_str().map(str::to_owned) == api_host && api_host.is_some());
    if !ok { return Err("ruxsat etilmagan manzil".into()); }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

// ----------------------------------------------------------------------------- yordamchilar

fn init_script(info: &ClientInfo) -> String {
    include_str!("inject.js")
        .replace("__CLIENT_HEADER__", &info.client_header)
        .replace("__DEVICE_HEADER__", &info.device_header)
        .replace("__PANEL_URL__", &info.panel_url)
        .replace("__APP_VERSION__", &info.version)
        .replace("__API_URL__", &info.api_url)
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_window(WINDOW) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("tray_show", "Apteka 360 ni ochish").build(app)?;
    let quit = MenuItemBuilder::with_id("tray_quit", "Chiqish").build(app)?;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(ZoomState(Mutex::new(4)))
        .manage(CloseToTray(Mutex::new(true)))
        .manage(TokenState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            check_online, get_client_info, toggle_fullscreen, zoom_step,
            panel_navigate, panel_reload, panel_back, panel_forward, panel_eval_compact,
            set_panel_bounds, set_panel_visible, report_network,
            get_prefs, set_pref, show_about, open_in_browser, quit_app, show_more_menu, panel_api, api_result, report_token, has_token, api, shell_home, debug_log, open_external
        ])
        .on_menu_event(|app, event| handle_menu(app, event.id().as_ref()));

    #[cfg(feature = "updater")]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
            let handle = app.handle().clone();
            let info = client_info(&handle);

            // APTEKA_PANEL_URL boshqa domen bo'lsa (staging / lokal sinov) — o'sha origin'ga ham panel ruxsatlarini beramiz
            if let Ok(u) = Url::parse(PANEL_URL) {
                let host = u.host_str().unwrap_or_default().to_ascii_lowercase();
                if !host.ends_with("agrom24.uz") {
                    let origin = u.origin().ascii_serialization();
                    let mut cap = tauri::ipc::CapabilityBuilder::new("remote-panel-custom")
                        .remote(format!("{origin}/*"))
                        .window(WINDOW)
                        .webview(PANEL);
                    for p in REMOTE_PERMISSIONS {
                        cap = cap.permission(*p);
                    }
                    app.add_capability(cap)?;
                }
            }

            let window = WindowBuilder::new(app, WINDOW)
                .title("Apteka 360")
                .inner_size(1366.0, 860.0)
                .min_inner_size(1280.0, 800.0)
                .center()
                .resizable(true)
                .maximizable(true)
                .decorations(true)
                .build()?;

            let scale = window.scale_factor().unwrap_or(1.0);
            let size: LogicalSize<f64> = window.inner_size()?.to_logical(scale);

            // 1) Qobiq — butun oyna
            window.add_child(
                WebviewBuilder::new(SHELL, WebviewUrl::App("index.html".into()))
                    .initialization_script(init_script(&info))
                    // Native kamera ekrani: ovoz (autoplay) va «Gapirish» (mikrofon) — lokal qobiq ishonchli
                    .on_permission_request(|_wv, kind| match kind {
                        PermissionKind::Microphone | PermissionKind::Autoplay => PermissionResponse::Allow,
                        _ => PermissionResponse::Default,
                    })
                    .auto_resize(),
                LogicalPosition::new(0.0, 0.0),
                size,
            )?;

            // 2) Panel — qobiq joy ko'rsatguncha yashirin
            let h1 = handle.clone();
            let h2 = handle.clone();
            let h3 = handle.clone();
            let panel_url = Url::parse(PANEL_URL)?;
            let panel = window.add_child(
                WebviewBuilder::new(PANEL, WebviewUrl::External(panel_url))
                    .initialization_script(init_script(&info))
                    .user_agent(USER_AGENT)
                    .zoom_hotkeys_enabled(true)
                    .on_navigation(move |url| {
                        emit_shell(&h1, "panel", PanelEvent { kind: "navigate", url: url.to_string() });
                        true
                    })
                    .on_page_load(move |_wv, payload| {
                        let kind = match payload.event() {
                            tauri::webview::PageLoadEvent::Started => "started",
                            tauri::webview::PageLoadEvent::Finished => "finished",
                        };
                        emit_shell(&h2, "panel", PanelEvent { kind, url: payload.url().to_string() });
                    })
                    // Kamera ovozi va «Gapirish»: mikrofon/kamera/autoplay faqat panel domeni uchun
                    .on_permission_request(|webview, kind| {
                        let trusted = webview.url().map(|u| is_panel_origin(&u)).unwrap_or(false);
                        match kind {
                            PermissionKind::Microphone | PermissionKind::Camera | PermissionKind::Autoplay if trusted => {
                                PermissionResponse::Allow
                            }
                            PermissionKind::Autoplay => PermissionResponse::Allow,
                            _ => PermissionResponse::Default,
                        }
                    }),
                LogicalPosition::new(0.0, 0.0),
                LogicalSize::new(1.0, 1.0),
            )?;
            let _ = panel.hide();

            // Oynani yopish → trayga yig'ish (sozlamaga qarab)
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let to_tray = h3.state::<CloseToTray>().0.lock().map(|v| *v).unwrap_or(true);
                    if to_tray {
                        api.prevent_close();
                        if let Some(w) = h3.get_window(WINDOW) { let _ = w.hide(); }
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
        .run(tauri::generate_context!())
        .expect("Apteka 360 ilovasini ishga tushirib bo'lmadi");
}

#[cfg(feature = "updater")]
mod updater {
    use tauri::AppHandle;
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
    use tauri_plugin_updater::UpdaterExt;

    pub async fn check(app: AppHandle) {
        let Ok(updater) = app.updater() else { return };
        let Ok(Some(update)) = updater.check().await else { return };
        let ok = app
            .dialog()
            .message(format!("Apteka 360 ning yangi versiyasi mavjud: {}.\nHozir yangilansinmi?", update.version))
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

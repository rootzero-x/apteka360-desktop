fn main() {
    // Maxsus buyruqlar uchun `allow-<buyruq>` ruxsatlari yaratiladi (capabilities/*.json da ishlatiladi)
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&["check_online", "get_client_info", "toggle_fullscreen", "zoom_step", "panel_navigate", "panel_reload", "panel_eval_compact", "panel_back", "panel_forward", "set_panel_bounds", "set_panel_visible", "report_network", "get_prefs", "set_pref", "show_about", "open_in_browser", "quit_app", "show_more_menu"])),
    )
    .expect("tauri build");
}

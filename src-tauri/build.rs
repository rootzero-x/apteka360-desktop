fn main() {
    // Maxsus buyruqlar uchun `allow-<buyruq>` ruxsatlari yaratiladi (capabilities/*.json da ishlatiladi)
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "check_online",
            "get_client_info",
            "toggle_fullscreen",
            "zoom_step",
            "go_home",
            "reload_page",
        ])),
    )
    .expect("tauri build");
}

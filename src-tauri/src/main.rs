// Windows'da release rejimida konsol oynasi ochilmasin
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    apteka360_desktop_lib::run()
}

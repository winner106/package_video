use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{self, command, Emitter, Manager, Runtime};

#[derive(Clone, Serialize)]
pub struct IconTrayPayload {
    message: String,
}

impl IconTrayPayload {
    pub fn new(message: &str) -> IconTrayPayload {
        IconTrayPayload {
            message: message.into(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum TrayState {
    NotPlaying,
    Paused,
    Playing,
}

/// 获取托盘菜单的翻译文本
fn get_tray_translations(lang: &str) -> HashMap<&'static str, &'static str> {
    match lang {
        "zh-CN" => {
            let mut map = HashMap::new();
            map.insert("toggle-visibility-show", "显示窗口");
            map.insert("toggle-visibility-hide", "隐藏窗口");
            map.insert("quit", "退出");
            map.insert("toggle-tray-icon", "切换托盘图标");
            map.insert("sub-menu", "子菜单");
            map.insert("before-separator", "分隔符前");
            map.insert("after-separator", "分隔符后");
            map
        }
        "zh-HK" => {
            let mut map = HashMap::new();
            map.insert("toggle-visibility-show", "顯示視窗");
            map.insert("toggle-visibility-hide", "隱藏視窗");
            map.insert("quit", "結束");
            map.insert("toggle-tray-icon", "切換托盤圖標");
            map.insert("sub-menu", "子選單");
            map.insert("before-separator", "分隔符前");
            map.insert("after-separator", "分隔符後");
            map
        }
        _ => {
            // 英文(默认)
            let mut map = HashMap::new();
            map.insert("toggle-visibility-show", "Show Window");
            map.insert("toggle-visibility-hide", "Hide Window");
            map.insert("quit", "Quit");
            map.insert("toggle-tray-icon", "Toggle the tray icon");
            map.insert("sub-menu", "Sub Menu!");
            map.insert("before-separator", "Before Separator");
            map.insert("after-separator", "After Separator");
            map
        }
    }
}

// https://v2.tauri.app/start/migrate/from-tauri-1/#migrate-to-menu-module
pub fn create_tray_menu<R: Runtime>(
    app: &tauri::AppHandle<R>,
    lang: String,
) -> Result<Menu<R>, tauri::Error> {
    // 获取对应语言的翻译
    let translations = get_tray_translations(&lang);
    // println!("lang: {}, translations: {:#?}", lang, translations);
    // 检查窗口是否可见，以决定显示「隐藏窗口」还是「显示窗口」
    let window_visible = if let Some(main_window) = app.get_webview_window("main") {
        main_window.is_visible().unwrap_or(true)
    } else {
        true
    };

    // 根据窗口可见性选择适当的翻译
    let toggle_text = if window_visible {
        translations
            .get("toggle-visibility-hide")
            .unwrap_or(&"Hide Window")
    } else {
        translations
            .get("toggle-visibility-show")
            .unwrap_or(&"Show Window")
    };

    let toggle = MenuItemBuilder::with_id("toggle-visibility", toggle_text)
        .accelerator("Ctrl+Shift+T")
        .build(app)?;

    MenuBuilder::new(app)
        .items(&[
            &SubmenuBuilder::new(app, translations.get("sub-menu").unwrap_or(&"Sub Menu!"))
                .text(
                    "bf-sep",
                    translations
                        .get("before-separator")
                        .unwrap_or(&"Before Separator"),
                )
                .separator()
                .text(
                    "af-sep",
                    translations
                        .get("after-separator")
                        .unwrap_or(&"After Separator"),
                )
                .build()?,
            &toggle,
            &MenuItemBuilder::with_id("quit", translations.get("quit").unwrap_or(&"Quit"))
                .accelerator("Ctrl+Q")
                .build(app)?,
            &MenuItemBuilder::with_id(
                "toggle-tray-icon",
                translations
                    .get("toggle-tray-icon")
                    .unwrap_or(&"Toggle the tray icon"),
            )
            .build(app)?,
        ])
        .build()
}

static TRAY_ID: &str = "main";

pub fn create_tray_icon(app: &tauri::AppHandle) -> Result<TrayIcon, tauri::Error> {
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(
            tauri::image::Image::from_bytes(include_bytes!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/icons/SystemTray1.ico"
            )))
            .expect("SystemTray1.icon not found"),
        )
        .menu(&create_tray_menu(app, "en".into())?)
        .tooltip("Tauri App")
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| {
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.emit("systemTray", IconTrayPayload::new(event.id().as_ref()));
            }
            let tray_icon = app.tray_by_id(TRAY_ID).unwrap();

            // TODO: FIGURE OUT HOW TO GET THE ITEM HANDLER IN v2
            // let item_handle: MenuItem = tray_icon.get_item();

            match event.id().as_ref() {
                "quit" => {
                    std::process::exit(0);
                }
                "toggle-tray-icon" => {
                    let tray_state_mutex = app.state::<Mutex<TrayState>>();
                    let mut tray_state = tray_state_mutex.lock().unwrap();
                    match *tray_state {
                        TrayState::NotPlaying => {
                            tray_icon
                                .set_icon(
                                    tauri::image::Image::from_bytes(include_bytes!(concat!(
                                        env!("CARGO_MANIFEST_DIR"),
                                        "/icons/SystemTray2.ico"
                                    )))
                                    .ok(),
                                )
                                .unwrap();
                            *tray_state = TrayState::Playing;
                        }
                        TrayState::Playing => {
                            tray_icon
                                .set_icon(
                                    tauri::image::Image::from_bytes(include_bytes!(concat!(
                                        env!("CARGO_MANIFEST_DIR"),
                                        "/icons/SystemTray1.ico"
                                    )))
                                    .ok(),
                                )
                                .unwrap();
                            *tray_state = TrayState::NotPlaying;
                        }
                        TrayState::Paused => {}
                    };
                }
                "toggle-visibility" => {
                    if let Some(main_window) = app.get_webview_window("main") {
                        // 切换窗口可见性
                        if main_window.is_visible().unwrap() {
                            main_window.hide().unwrap();
                        } else {
                            main_window.show().unwrap();
                        }

                        // 更新菜单文本 - 重建整个菜单
                        if let Some(tray) = app.tray_by_id(TRAY_ID) {
                            let current_lang = app
                                .state::<Mutex<String>>()
                                .lock()
                                .map(|lang| lang.clone())
                                .unwrap_or_else(|_| "en".to_string());

                            if let Ok(new_menu) = create_tray_menu(app, current_lang) {
                                let _ = tray.set_menu(Some(new_menu));
                            }
                        }
                    }
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            let app = tray.app_handle();
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(main_window) = app.get_webview_window("main") {
                    let _ = main_window.emit("system-tray", IconTrayPayload::new("left-click"));
                    let _ = main_window.show();
                    let _ = main_window.set_focus();
                }
                println!("system tray received a left click");
            } else if let TrayIconEvent::Click {
                button: MouseButton::Right,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                println!("system tray received a right click");
            } else if let TrayIconEvent::DoubleClick { .. } = event {
                println!("system tray received a double click");
            }
        })
        .build(app)
}

#[command]
#[specta::specta]
#[allow(unused_must_use)]
pub fn tray_update_lang(app: tauri::AppHandle, lang: String) {
    // 更新应用的语言状态
    if let Ok(mut current_lang) = app.state::<Mutex<String>>().lock() {
        *current_lang = lang.clone();
    }

    // 更新托盘菜单
    let tray_handle = app.tray_by_id(TRAY_ID);
    if let Some(t) = tray_handle {
        t.set_menu(create_tray_menu(&app, lang).ok());
    }
}

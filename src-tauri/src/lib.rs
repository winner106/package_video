//! Tauri application library entry point.
//!
//! This module serves as the main entry point for the Tauri application.
//! Command implementations are organized in the `commands` module,
//! and shared types are in the `types` module.

mod bindings;
mod commands;
mod types;
mod utils;

use std::sync::Mutex;
use tauri::Manager;

// Re-export only what's needed externally
use commands::tray::{create_tray_icon, TrayState};
pub use types::DEFAULT_QUICK_PANE_SHORTCUT;

/// Default enablement for the quick pane feature.
///
/// For template reuse across different projects, you can set this to `false` to
/// completely skip quick pane initialization and shortcut registration.
const QUICK_PANE_ENABLED_DEFAULT: bool = false;

fn is_quick_pane_enabled() -> bool {
    match std::env::var("TAURI_ENABLE_QUICK_PANE") {
        Ok(value) => match value.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => true,
            "0" | "false" | "no" | "off" => false,
            _ => {
                log::warn!(
                    "Invalid TAURI_ENABLE_QUICK_PANE value '{value}', using default: {QUICK_PANE_ENABLED_DEFAULT}"
                );
                QUICK_PANE_ENABLED_DEFAULT
            }
        },
        Err(std::env::VarError::NotPresent) => QUICK_PANE_ENABLED_DEFAULT,
        Err(e) => {
            log::warn!(
                "Failed to read TAURI_ENABLE_QUICK_PANE ({e}), using default: {QUICK_PANE_ENABLED_DEFAULT}"
            );
            QUICK_PANE_ENABLED_DEFAULT
        }
    }
}

fn prevent_default() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    #[cfg(debug_assertions)]
    {
        // 开发时：只禁用右键菜单等，但保留调试体验
        // 你也可以直接用 tauri_plugin_prevent_default::debug()
        use tauri_plugin_prevent_default::{Builder, Flags};

        let mut builder = Builder::new().with_flags(Flags::all().difference(
            // ✅ 开发期保留这三个（你也可按需改）
            Flags::CONTEXT_MENU | Flags::DEV_TOOLS | Flags::RELOAD,
        ));

        // Windows 额外：更“硬”的禁用（可选，建议发布期开）
        #[cfg(target_os = "windows")]
        {
            use tauri_plugin_prevent_default::PlatformOptions;
            builder = builder.platform(
                PlatformOptions::new()
                    // Whether general form information should be saved and autofilled.
                    .general_autofill(false)
                    // Whether password information should be autosaved.
                    .password_autosave(false)
                    // Whether browser-specific accelerator keys are enabled.
                    .browser_accelerator_keys(true)
                    // Whether the default context menus are shown in the webview.
                    .default_context_menus(true)
                    // Whether the webview renders the default JavaScript dialog box.
                    .default_script_dialogs(true),
            );
        }

        builder.build()
    }

    #[cfg(not(debug_assertions))]
    {
        // 发布时：禁用全部默认浏览器快捷键/菜单（最像原生应用）
        use tauri_plugin_prevent_default::{Builder, Flags};

        let mut builder = Builder::new().with_flags(Flags::all());

        #[cfg(target_os = "windows")]
        {
            use tauri_plugin_prevent_default::PlatformOptions;
            builder = builder.platform(
                PlatformOptions::new()
                    .browser_accelerator_keys(false) // ✅ 彻底禁用 WebView2 浏览器加速键（含 F5 / Ctrl+R）
                    .default_context_menus(false) // ✅ 彻底禁用默认右键菜单
                    // Whether general form information should be saved and autofilled.
                    .general_autofill(false)
                    // Whether password information should be autosaved.
                    .password_autosave(false)
                    // Whether the webview renders the default JavaScript dialog box.
                    .default_script_dialogs(false),
            );
        }

        builder.build()
    }
}

/// Application entry point. Sets up all plugins and initializes the app.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = bindings::generate_bindings();

    // Export TypeScript bindings in debug builds
    #[cfg(debug_assertions)]
    bindings::export_ts_bindings();

    // Build with common plugins
    let mut app_builder =
        tauri::Builder::default().plugin(tauri_plugin_autostart::Builder::new().build());

    // Single instance plugin must be registered FIRST
    // When user tries to open a second instance, focus the existing window instead
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }));
    }

    // Prevent default browser behaviors (right-click menu, reload, dev tools, etc.)
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(prevent_default());
    }

    // Window state plugin - saves/restores window position and size
    // Note: Only applies to windows listed in capabilities (main window only, not quick-pane)
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(tauri_plugin_window_state::StateFlags::all())
                .build(),
        );
    }

    // Updater plugin for in-app updates
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    app_builder = app_builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                // Use Debug level in development, Info in production
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Info
                })
                .targets([
                    // Always log to stdout for development
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    // Log to webview console for development
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                    // Log to system logs on macOS (appears in Console.app)
                    #[cfg(target_os = "macos")]
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    }),
                ])
                .build(),
        );

    // macOS: Add NSPanel plugin for native panel behavior
    #[cfg(target_os = "macos")]
    {
        app_builder = app_builder.plugin(tauri_nspanel::init());
    }

    app_builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            log::info!("Application starting up");
            log::debug!(
                "App handle initialized for package: {}",
                app.package_info().name
            );

            // 初始化托盘图标和状态
            let _ = create_tray_icon(app.handle());
            app.manage(Mutex::new(TrayState::NotPlaying));

            // 管理当前语言状态，默认为英文
            app.manage(Mutex::new(String::from("en")));

            // Set up global shortcut plugin (without any shortcuts - we register them separately)
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::Builder;

                app.handle().plugin(Builder::new().build())?;
            }

            // Load saved preferences and register the quick pane shortcut
            #[cfg(desktop)]
            {
                if is_quick_pane_enabled() {
                    let saved_shortcut =
                        commands::preferences::load_quick_pane_shortcut(app.handle());
                    let shortcut_to_register = saved_shortcut
                        .as_deref()
                        .unwrap_or(DEFAULT_QUICK_PANE_SHORTCUT);

                    log::info!("Registering quick pane shortcut: {shortcut_to_register}");
                    commands::quick_pane::register_quick_pane_shortcut(
                        app.handle(),
                        shortcut_to_register,
                    )?;
                } else {
                    log::info!(
                        "Quick pane disabled; skipping shortcut registration (TAURI_ENABLE_QUICK_PANE / QUICK_PANE_ENABLED_DEFAULT)"
                    );
                }
            }

            // Create the quick pane window (hidden) - must be done on main thread
            #[cfg(desktop)]
            {
                if is_quick_pane_enabled() {
                    if let Err(e) = commands::quick_pane::init_quick_pane(app.handle()) {
                        log::error!("Failed to create quick pane: {e}");
                        // Non-fatal: app can still run without quick pane
                    }
                }
            }

            // NOTE: Application menu is built from JavaScript for i18n support
            // See src/lib/menu.ts for the menu implementation

            Ok(())
        })
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

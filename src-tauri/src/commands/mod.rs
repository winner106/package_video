//! Tauri command handlers organized by domain.
//!
//! Each submodule contains related commands and their helper functions.
//! Import specific commands via their submodule (e.g., `commands::preferences::greet`).

pub mod notifications;
pub mod parcel_video;
pub mod preferences;
pub mod quick_pane;
pub mod recovery;
pub mod tray;

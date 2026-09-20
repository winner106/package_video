//! Shared types and validation functions for the Tauri application.

use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::sync::LazyLock;

/// Default shortcut for the quick pane
pub const DEFAULT_QUICK_PANE_SHORTCUT: &str = "CommandOrControl+Shift+.";

/// Maximum size for recovery data files (10MB)
pub const MAX_RECOVERY_DATA_BYTES: u32 = 10_485_760;

/// Default behavior when the user closes the window.
/// "ask" = prompt user, "minimizeToTray" = hide window, "quit" = close app.
pub const DEFAULT_CLOSE_BEHAVIOR: &str = "ask";

/// Pre-compiled regex pattern for filename validation.
/// Only allows alphanumeric characters, dashes, underscores, and a single extension.
pub static FILENAME_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)?$")
        .expect("Failed to compile filename regex pattern")
});

// ============================================================================
// Preferences
// ============================================================================

/// Application preferences that persist to disk.
/// Only contains settings that should be saved between sessions.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AppPreferences {
    pub theme: String,
    /// Global shortcut for quick pane (e.g., "CommandOrControl+Shift+.")
    /// If None, uses the default shortcut
    pub quick_pane_shortcut: Option<String>,
    /// How the app should behave when the user closes the main window
    /// Supported values: "ask", "minimizeToTray", "quit"
    #[serde(default = "default_close_behavior")]
    pub close_behavior: String,
    /// Active theme pack/palette (e.g., "default", "business-blue")
    #[serde(default = "default_theme_palette")]
    pub theme_palette: String,
    /// Whether to start minimized to the system tray
    /// Defaults to false
    pub silent_start: Option<bool>,
    /// User's preferred language (e.g., "en", "es", "de")
    /// If None, uses system locale detection
    pub language: Option<String>,
    /// Whether to start the application automatically on system startup
    pub auto_start: Option<bool>,
    /// Custom mood candidates per locale. Key: locale code, Value: list of moods.
    pub mood_candidates: Option<HashMap<String, Vec<String>>>,
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            quick_pane_shortcut: None, // None means use default
            close_behavior: default_close_behavior(),
            theme_palette: default_theme_palette(),
            silent_start: Some(false),
            language: None,          // None means use system locale
            auto_start: Some(false), // Default to not auto-start
            mood_candidates: Some(default_mood_candidates()),
        }
    }
}

// ============================================================================
// Recovery Errors
// ============================================================================

/// Error types for recovery operations (typed for frontend matching)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type")]
pub enum RecoveryError {
    /// File does not exist (expected case, not a failure)
    FileNotFound,
    /// Filename validation failed
    ValidationError { message: String },
    /// Data exceeds size limit
    DataTooLarge { max_bytes: u32 },
    /// File system read/write error
    IoError { message: String },
    /// JSON serialization/deserialization error
    ParseError { message: String },
}

impl std::fmt::Display for RecoveryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RecoveryError::FileNotFound => write!(f, "File not found"),
            RecoveryError::ValidationError { message } => write!(f, "Validation error: {message}"),
            RecoveryError::DataTooLarge { max_bytes } => {
                write!(f, "Data too large (max {max_bytes} bytes)")
            }
            RecoveryError::IoError { message } => write!(f, "IO error: {message}"),
            RecoveryError::ParseError { message } => write!(f, "Parse error: {message}"),
        }
    }
}

// ============================================================================
// Validation Functions
// ============================================================================

/// Validates a filename for safe file system operations.
/// Only allows alphanumeric characters, dashes, underscores, and a single extension.
pub fn validate_filename(filename: &str) -> Result<(), String> {
    if filename.is_empty() {
        return Err("Filename cannot be empty".to_string());
    }

    if filename.chars().count() > 100 {
        return Err("Filename too long (max 100 characters)".to_string());
    }

    if !FILENAME_PATTERN.is_match(filename) {
        return Err(
            "Invalid filename: only alphanumeric characters, dashes, underscores, and dots allowed"
                .to_string(),
        );
    }

    Ok(())
}

/// Validates string input length (by character count, not bytes).
pub fn validate_string_input(input: &str, max_len: usize, field_name: &str) -> Result<(), String> {
    let char_count = input.chars().count();
    if char_count > max_len {
        return Err(format!("{field_name} too long (max {max_len} characters)"));
    }
    Ok(())
}

/// Validates theme value.
pub fn validate_theme(theme: &str) -> Result<(), String> {
    match theme {
        "light" | "dark" | "system" => Ok(()),
        _ => Err("Invalid theme: must be 'light', 'dark', or 'system'".to_string()),
    }
}

/// Validates close behavior preference.
pub fn validate_close_behavior(behavior: &str) -> Result<(), String> {
    match behavior {
        "ask" | "minimizeToTray" | "quit" => Ok(()),
        _ => Err("Invalid close behavior: must be 'ask', 'minimizeToTray', or 'quit'".to_string()),
    }
}

fn default_close_behavior() -> String {
    DEFAULT_CLOSE_BEHAVIOR.to_string()
}

fn default_theme_palette() -> String {
    "default".to_string()
}

fn default_mood_candidates() -> HashMap<String, Vec<String>> {
    HashMap::from([
        (
            "en".to_string(),
            vec![
                "😀 Feeling great".to_string(),
                "😎 Keep it cool".to_string(),
                "🤔 Deep in thought".to_string(),
                "🎯 Focus mode".to_string(),
                "🔥 Bring the heat".to_string(),
                "🌱 Grow every day".to_string(),
                "🚀 Ready to launch".to_string(),
                "💡 New ideas brewing".to_string(),
                "🎵 In the groove".to_string(),
                "⌛ Where there is time, there is a stage!".to_string(),
            ],
        ),
        (
            "zh-CN".to_string(),
            vec![
                "😀 心情很好".to_string(),
                "😎 冷静如常".to_string(),
                "🤔 认真思考中".to_string(),
                "🎯 专注模式".to_string(),
                "🔥 干劲满满".to_string(),
                "🌱 一点点成长".to_string(),
                "🚀 准备起飞".to_string(),
                "💡 灵感在酝酿".to_string(),
                "🎵 音乐陪伴".to_string(),
                "⌛ 时间在哪里，舞台就在那里！".to_string(),
            ],
        ),
        (
            "zh-HK".to_string(),
            vec![
                "😀 心情不錯".to_string(),
                "😎 冷靜如常".to_string(),
                "🤔 認真思考中".to_string(),
                "🎯 專注模式".to_string(),
                "🔥 幹勁滿滿".to_string(),
                "🌱 一點點成長".to_string(),
                "🚀 準備起飛".to_string(),
                "💡 靈感在醞釀".to_string(),
                "🎵 音樂陪伴".to_string(),
                "⌛ 時間喺邊，舞台就喺邊！".to_string(),
            ],
        ),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn close_behavior_defaults_to_ask() {
        let prefs = AppPreferences::default();
        assert_eq!(prefs.close_behavior, DEFAULT_CLOSE_BEHAVIOR);
    }

    #[test]
    fn validate_close_behavior_accepts_supported_values() {
        assert!(validate_close_behavior("ask").is_ok());
        assert!(validate_close_behavior("minimizeToTray").is_ok());
        assert!(validate_close_behavior("quit").is_ok());
    }

    #[test]
    fn validate_close_behavior_rejects_unknown_value() {
        let err = validate_close_behavior("something-else").unwrap_err();
        assert!(err.contains("Invalid close behavior"));
    }
}

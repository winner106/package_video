use serde::{Deserialize, Serialize};
use specta::Type;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

use crate::types::AppPreferences;

const DEFAULT_STORAGE_BYTES: u64 = 100 * 1024 * 1024 * 1024;
const MAX_BARCODE_LENGTH: usize = 120;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SaveParcelRecordingResponse {
    pub file_name: String,
    pub file_path: String,
    pub file_size_bytes: i64,
    pub deleted_files: Vec<String>,
    pub total_size_bytes: i64,
}

fn sanitize_barcode(barcode: &str) -> String {
    let mut sanitized = barcode
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>();

    if sanitized.is_empty() {
        sanitized = "UNKNOWN".to_string();
    }

    sanitized
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))
}

fn configured_recording_dir(app: &AppHandle) -> Result<Option<PathBuf>, String> {
    let prefs_path = super::preferences::get_preferences_path(app)?;

    if !prefs_path.exists() {
        return Ok(None);
    }

    let content = match fs::read_to_string(&prefs_path) {
        Ok(content) => content,
        Err(error) => {
            log::warn!("Failed to read preferences for recording directory: {error}");
            return Ok(None);
        }
    };

    let preferences: AppPreferences = match serde_json::from_str(&content) {
        Ok(preferences) => preferences,
        Err(error) => {
            log::warn!("Failed to parse preferences for recording directory: {error}");
            return Ok(None);
        }
    };

    Ok(preferences
        .recording_directory
        .map(|path| path.trim().to_string())
        .filter(|path| !path.is_empty())
        .map(PathBuf::from))
}

fn recording_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let fallback_dir = app_data_dir(app)?.join("parcel-recordings");
    let target = configured_recording_dir(app)?.unwrap_or(fallback_dir);

    fs::create_dir_all(&target).map_err(|e| format!("Failed to create recording directory: {e}"))?;
    Ok(target)
}

fn now_filename_prefix() -> String {
    chrono::Local::now().format("%Y%m%d_%H%M%S").to_string()
}

fn transcode_webm_to_mp4(input_path: &Path, output_path: &Path) -> Result<(), String> {
    let output = Command::new("ffmpeg")
        .arg("-y")
        .arg("-i")
        .arg(input_path)
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg("veryfast")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-movflags")
        .arg("+faststart")
        .arg(output_path)
        .output()
        .map_err(|e| format!("Failed to execute ffmpeg: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffmpeg transcoding failed: {stderr}"));
    }

    Ok(())
}

fn list_mp4_files(dir: &Path) -> Result<Vec<(PathBuf, u64, u128)>, String> {
    let mut files = Vec::new();

    for entry in fs::read_dir(dir).map_err(|e| format!("Failed to read recording directory: {e}"))? {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
        let path = entry.path();

        if path.extension().and_then(|ext| ext.to_str()) != Some("mp4") {
            continue;
        }

        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read file metadata: {e}"))?;

        let modified = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map_or(0, |duration| duration.as_millis());

        files.push((path, metadata.len(), modified));
    }

    Ok(files)
}

fn enforce_storage_limit(dir: &Path, max_storage_bytes: u64) -> Result<(Vec<String>, u64), String> {
    let mut files = list_mp4_files(dir)?;
    let mut total_size: u64 = files.iter().map(|(_, size, _)| *size).sum();
    let mut deleted_files = Vec::new();

    files.sort_by_key(|(_, _, modified)| *modified);

    for (path, size, _) in files {
        if total_size <= max_storage_bytes {
            break;
        }

        fs::remove_file(&path).map_err(|e| format!("Failed to remove old recording file {path:?}: {e}"))?;
        total_size = total_size.saturating_sub(size);

        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            deleted_files.push(name.to_string());
        }
    }

    Ok((deleted_files, total_size))
}

#[tauri::command]
#[specta::specta]
pub fn get_parcel_recording_directory(app: AppHandle) -> Result<String, String> {
    let dir = recording_root_dir(&app)?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
#[specta::specta]
pub fn save_parcel_recording_mp4(
    app: AppHandle,
    barcode: String,
    webm_data: Vec<u8>,
    max_storage_bytes: Option<i64>,
) -> Result<SaveParcelRecordingResponse, String> {
    if barcode.trim().is_empty() {
        return Err("Barcode cannot be empty".to_string());
    }

    if barcode.chars().count() > MAX_BARCODE_LENGTH {
        return Err(format!(
            "Barcode too long (max {MAX_BARCODE_LENGTH} characters)"
        ));
    }

    if webm_data.is_empty() {
        return Err("Recording data is empty".to_string());
    }

    let root_dir = recording_root_dir(&app)?;
    let safe_barcode = sanitize_barcode(barcode.trim());
    let file_name = format!("{}_{}.mp4", now_filename_prefix(), safe_barcode);
    let temp_name = format!("{}_{}.webm", now_filename_prefix(), safe_barcode);

    let output_path = root_dir.join(&file_name);
    let temp_path = root_dir.join(temp_name);

    fs::write(&temp_path, webm_data).map_err(|e| format!("Failed to write temporary recording: {e}"))?;

    let transcode_result = transcode_webm_to_mp4(&temp_path, &output_path);

    if let Err(remove_err) = fs::remove_file(&temp_path) {
        log::warn!("Failed to clean temporary webm file: {remove_err}");
    }

    transcode_result?;

    let metadata = fs::metadata(&output_path).map_err(|e| format!("Failed to read output file metadata: {e}"))?;

    let max_bytes = match max_storage_bytes {
        Some(value) if value > 0 => value as u64,
        Some(_) => return Err("max_storage_bytes must be greater than 0".to_string()),
        None => DEFAULT_STORAGE_BYTES,
    };
    let (deleted_files, total_size_bytes) = enforce_storage_limit(&root_dir, max_bytes)?;

    let file_size_bytes = i64::try_from(metadata.len())
        .map_err(|_| "Recorded file size exceeds supported range".to_string())?;
    let total_size_bytes = i64::try_from(total_size_bytes)
        .map_err(|_| "Total recording size exceeds supported range".to_string())?;

    Ok(SaveParcelRecordingResponse {
        file_name,
        file_path: output_path.to_string_lossy().to_string(),
        file_size_bytes,
        deleted_files,
        total_size_bytes,
    })
}

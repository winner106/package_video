use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashSet;
use std::fs;
use std::io::ErrorKind;
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
    pub file_size_bytes: f64,
    pub deleted_files: Vec<String>,
    pub total_size_bytes: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ParcelRecordingItem {
    pub file_name: String,
    pub file_path: String,
    pub file_size_bytes: f64,
    pub modified_at_ms: f64,
    pub barcode: String,
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

fn configured_ffmpeg_executable(app: &AppHandle) -> Result<Option<PathBuf>, String> {
    let prefs_path = super::preferences::get_preferences_path(app)?;

    if !prefs_path.exists() {
        return Ok(None);
    }

    let content = match fs::read_to_string(&prefs_path) {
        Ok(content) => content,
        Err(error) => {
            log::warn!("Failed to read preferences for ffmpeg path: {error}");
            return Ok(None);
        }
    };

    let preferences: AppPreferences = match serde_json::from_str(&content) {
        Ok(preferences) => preferences,
        Err(error) => {
            log::warn!("Failed to parse preferences for ffmpeg path: {error}");
            return Ok(None);
        }
    };

    Ok(preferences
        .ffmpeg_executable_path
        .map(|path| path.trim().trim_matches('"').to_string())
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

#[cfg(target_os = "windows")]
fn ffmpeg_where_candidates() -> Vec<PathBuf> {
    let output = Command::new("where").arg("ffmpeg").output();

    match output {
        Ok(output) if output.status.success() => String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(str::trim)
            .map(|line| line.trim_matches('"').trim())
            .filter(|line| !line.is_empty())
            .map(PathBuf::from)
            .collect(),
        _ => Vec::new(),
    }
}

fn ffmpeg_command_candidates(preferred_executable: Option<PathBuf>) -> Vec<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Some(path) = preferred_executable {
        candidates.push(path);
    }

    if let Some(custom) = std::env::var_os("FFMPEG_PATH") {
        let custom_path = PathBuf::from(custom);
        if !custom_path.as_os_str().is_empty() {
            candidates.push(custom_path);
        }
    }

    candidates.push(PathBuf::from("ffmpeg"));
    if cfg!(target_os = "windows") {
        candidates.push(PathBuf::from("ffmpeg.exe"));

        candidates.push(PathBuf::from(r"C:\ffmpeg\bin\ffmpeg.exe"));
        candidates.push(PathBuf::from(r"C:\ProgramData\chocolatey\bin\ffmpeg.exe"));
        candidates.push(PathBuf::from(r"C:\Program Files\ffmpeg\bin\ffmpeg.exe"));
        candidates.push(PathBuf::from(r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe"));

        if let Some(user_profile) = std::env::var_os("USERPROFILE") {
            let user_home = PathBuf::from(user_profile);
            candidates.push(user_home.join("ffmpeg.exe"));
            candidates.push(user_home.join("ffmpeg/ffmpeg.exe"));
            candidates.push(user_home.join("ffmpeg/bin/ffmpeg.exe"));
            candidates.push(user_home.join("scoop/shims/ffmpeg.exe"));
            candidates.push(user_home.join("AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe"));
        }

        candidates.extend(ffmpeg_where_candidates());
    }

    if let Some(path_var) = std::env::var_os("PATH") {
        for directory in std::env::split_paths(&path_var) {
            candidates.push(directory.join("ffmpeg"));
            if cfg!(target_os = "windows") {
                candidates.push(directory.join("ffmpeg.exe"));
                candidates.push(directory.join("ffmpeg.cmd"));
                candidates.push(directory.join("ffmpeg.bat"));
            }
        }
    }

    let mut dedup = HashSet::new();
    candidates
        .into_iter()
        .filter(|path| dedup.insert(path.to_string_lossy().to_lowercase()))
        .collect()
}

#[cfg(target_os = "windows")]
fn is_cmd_wrapper(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("cmd") || ext.eq_ignore_ascii_case("bat"))
        .unwrap_or(false)
}

fn run_ffmpeg(candidate: &Path, args: &[&str]) -> std::io::Result<std::process::Output> {
    #[cfg(target_os = "windows")]
    {
        if is_cmd_wrapper(candidate) {
            return Command::new("cmd").arg("/C").arg(candidate).args(args).output();
        }
    }

    Command::new(candidate).args(args).output()
}

fn can_run_ffmpeg(candidate: &Path) -> bool {
    match run_ffmpeg(candidate, &["-version"]) {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

fn transcode_webm_to_mp4(app: &AppHandle, input_path: &Path, output_path: &Path) -> Result<(), String> {
    let preferred_executable = configured_ffmpeg_executable(app)?;
    let candidates = ffmpeg_command_candidates(preferred_executable);
    let mut attempted: Vec<String> = Vec::new();
    let input_arg = input_path.to_string_lossy().to_string();
    let output_arg = output_path.to_string_lossy().to_string();

    for candidate in candidates {
        attempted.push(candidate.to_string_lossy().to_string());

        if !can_run_ffmpeg(&candidate) {
            continue;
        }

        let output = run_ffmpeg(
            &candidate,
            &[
                "-y",
                "-i",
                input_arg.as_str(),
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                output_arg.as_str(),
            ],
        );

        match output {
            Ok(output) => {
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("ffmpeg transcoding failed: {stderr}"));
                }
                return Ok(());
            }
            Err(error) if error.kind() == ErrorKind::NotFound => {
                continue;
            }
            Err(error) => {
                return Err(format!(
                    "Failed to execute ffmpeg binary '{}': {error}",
                    candidate.display()
                ));
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let cmd_output = Command::new("cmd")
            .arg("/C")
            .arg("ffmpeg")
            .arg("-y")
            .arg("-i")
            .arg(input_arg.as_str())
            .arg("-c:v")
            .arg("libx264")
            .arg("-preset")
            .arg("veryfast")
            .arg("-pix_fmt")
            .arg("yuv420p")
            .arg("-movflags")
            .arg("+faststart")
            .arg(output_arg.as_str())
            .output();

        match cmd_output {
            Ok(output) if output.status.success() => return Ok(()),
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                if !stderr.trim().is_empty() {
                    return Err(format!("ffmpeg transcoding failed via cmd: {stderr}"));
                }
            }
            Err(_) => {
                // Continue to final not found error with attempted candidate list.
            }
        }
    }

    Err(format!(
        "Failed to execute ffmpeg: program not found. Tried: {}. Please ensure ffmpeg is in PATH or set FFMPEG_PATH to the full executable path.",
        attempted.join(", ")
    ))
}

fn extract_barcode_from_recording_file(path: &Path) -> Option<String> {
    let file_stem = path.file_stem()?.to_str()?;
    let (_, barcode_part) = file_stem.rsplit_once('_')?;

    if barcode_part.is_empty() {
        return None;
    }

    Some(barcode_part.to_string())
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
pub fn find_parcel_recordings_by_barcode(
    app: AppHandle,
    barcode: String,
) -> Result<Vec<ParcelRecordingItem>, String> {
    if barcode.trim().is_empty() {
        return Err("Barcode cannot be empty".to_string());
    }

    if barcode.chars().count() > MAX_BARCODE_LENGTH {
        return Err(format!(
            "Barcode too long (max {MAX_BARCODE_LENGTH} characters)"
        ));
    }

    let root_dir = recording_root_dir(&app)?;
    let query_barcode = sanitize_barcode(barcode.trim());
    let mut matches: Vec<(PathBuf, u64, u128, String)> = Vec::new();

    for (path, size, modified) in list_mp4_files(&root_dir)? {
        let Some(file_barcode) = extract_barcode_from_recording_file(&path) else {
            continue;
        };

        if !file_barcode.eq_ignore_ascii_case(&query_barcode) {
            continue;
        }

        matches.push((path, size, modified, file_barcode));
    }

    matches.sort_by(|a, b| b.2.cmp(&a.2));

    let recordings = matches
        .into_iter()
        .map(|(path, size, modified, file_barcode)| ParcelRecordingItem {
            file_name: path
                .file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.to_string())
                .unwrap_or_else(|| path.to_string_lossy().to_string()),
            file_path: path.to_string_lossy().to_string(),
            file_size_bytes: size as f64,
            modified_at_ms: modified as f64,
            barcode: file_barcode,
        })
        .collect();

    Ok(recordings)
}

#[tauri::command]
#[specta::specta]
pub fn save_parcel_recording_mp4(
    app: AppHandle,
    barcode: String,
    webm_data: Vec<u8>,
    max_storage_bytes: Option<f64>,
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

    let transcode_result = transcode_webm_to_mp4(&app, &temp_path, &output_path);

    if let Err(remove_err) = fs::remove_file(&temp_path) {
        log::warn!("Failed to clean temporary webm file: {remove_err}");
    }

    transcode_result?;

    let metadata = fs::metadata(&output_path).map_err(|e| format!("Failed to read output file metadata: {e}"))?;

    let max_bytes = match max_storage_bytes {
        Some(value) if !value.is_finite() => {
            return Err("max_storage_bytes must be a finite number".to_string());
        }
        Some(value) if value <= 0.0 => {
            return Err("max_storage_bytes must be greater than 0".to_string());
        }
        Some(value) if value > (u64::MAX as f64) => {
            return Err("max_storage_bytes exceeds supported range".to_string());
        }
        Some(value) => value.floor() as u64,
        None => DEFAULT_STORAGE_BYTES,
    };
    let (deleted_files, total_size_bytes) = enforce_storage_limit(&root_dir, max_bytes)?;

    Ok(SaveParcelRecordingResponse {
        file_name,
        file_path: output_path.to_string_lossy().to_string(),
        file_size_bytes: metadata.len() as f64,
        deleted_files,
        total_size_bytes: total_size_bytes as f64,
    })
}

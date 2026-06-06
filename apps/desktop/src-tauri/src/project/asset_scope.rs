//! Release waveform: asset protocol scope for App Data media + peaks `.dat`.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use super::utils::{append_desktop_log_line, open_db};
use crate::DbState;

/// Register asset:// access for project audio/peaks under App Data (release WebView).
pub fn register_project_media_asset_scope(app: &AppHandle, st: &DbState) -> Result<(), String> {
    let resolver = app.path();
    let app_data = resolver.app_data_dir().map_err(|e| e.to_string())?;

    app.asset_protocol_scope()
        .allow_directory(&st.root, true)
        .map_err(|e| format!("asset scope root {}: {e}", st.root.display()))?;

    if app_data != st.root {
        let _ = app.asset_protocol_scope().allow_directory(&app_data, true);
    }

    let mut media_files = 0usize;
    if let Ok(conn) = open_db(st) {
        let mut stmt = conn
            .prepare(
                "SELECT audio_path FROM files WHERE audio_path IS NOT NULL AND TRIM(audio_path) != ''",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        for path in rows.flatten() {
            let pb = PathBuf::from(&path);
            if pb.is_file() {
                let _ = app.asset_protocol_scope().allow_file(&pb);
                media_files += 1;
            }
        }
    }

    append_desktop_log_line(
        st,
        &format!(
            "INFO asset_scope_ok root={} media_files={}",
            st.root.display(),
            media_files
        ),
    );
    Ok(())
}

pub fn allow_project_media_file(app: &AppHandle, path: &Path) {
    if path.is_file() {
        let _ = app.asset_protocol_scope().allow_file(path);
    }
}

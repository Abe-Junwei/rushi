//! Product metadata shared by About UI and diagnostic `build-info.txt`.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;
use tauri::State;

use crate::bundled_asr_assets;
use crate::DbState;

pub const APP_PRODUCT_NAME: &str = "如是我闻";
pub const APP_IDENTIFIER: &str = "studio.lingchuang.rushi";
pub const APP_COPYRIGHT: &str = "版权所有 © 沂南灵创技术服务中心";

const THIRD_PARTY_NOTICES_FALLBACK: &str = include_str!("../resources/third-party-notices.txt");
const THIRD_PARTY_LICENSE_TEXTS_FALLBACK: &str =
    include_str!("../resources/third-party-license-texts.txt");

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThirdPartyLicenses {
    pub notices: String,
    pub license_texts: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppBuildInfo {
    pub product_name: String,
    pub version: String,
    pub identifier: String,
    pub platform_os: String,
    pub platform_arch: String,
    pub app_data_root: Option<String>,
    pub db_path: Option<String>,
}

pub fn app_version_string() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

pub fn build_app_build_info(app_data_root: Option<&Path>, db_path: Option<&Path>) -> AppBuildInfo {
    AppBuildInfo {
        product_name: APP_PRODUCT_NAME.to_string(),
        version: app_version_string(),
        identifier: APP_IDENTIFIER.to_string(),
        platform_os: std::env::consts::OS.to_string(),
        platform_arch: std::env::consts::ARCH.to_string(),
        app_data_root: app_data_root.map(|p| p.display().to_string()),
        db_path: db_path.map(|p| p.display().to_string()),
    }
}

pub fn format_build_info_text(info: &AppBuildInfo) -> String {
    format!(
        "rushi-desktop {}\nplatform: {} {}\nidentifier: {}\napp_data_root: {}\ndb_path: {}\n",
        info.version,
        info.platform_os,
        info.platform_arch,
        info.identifier,
        info.app_data_root.as_deref().unwrap_or("(unknown)"),
        info.db_path.as_deref().unwrap_or("(unknown)"),
    )
}

fn resource_roots_for_lookup() -> Vec<PathBuf> {
    bundled_asr_assets::cached_resource_roots()
        .map(|roots| roots.to_vec())
        .unwrap_or_else(|| {
            bundled_asr_assets::candidate_resource_roots_from_parts(
                None,
                &PathBuf::from(env!("CARGO_MANIFEST_DIR")),
            )
        })
}

fn resolve_bundled_resource(relative: &str) -> Option<PathBuf> {
    for root in resource_roots_for_lookup() {
        let candidate = root.join(relative);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn open_path_with_system_default(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("文件不存在: {}", path.display()));
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &path.to_string_lossy()])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn app_version() -> String {
    app_version_string()
}

#[tauri::command]
pub fn app_build_info(state: State<DbState>) -> AppBuildInfo {
    let st: &DbState = state.inner();
    build_app_build_info(Some(&st.root), Some(&st.db_path))
}

fn read_bundled_text(relative: &str, fallback: &str) -> String {
    if let Some(path) = resolve_bundled_resource(relative) {
        if let Ok(text) = fs::read_to_string(&path) {
            if !text.trim().is_empty() {
                return text;
            }
        }
    }
    fallback.to_string()
}

pub fn load_third_party_licenses() -> ThirdPartyLicenses {
    ThirdPartyLicenses {
        notices: read_bundled_text("third-party-notices.txt", THIRD_PARTY_NOTICES_FALLBACK),
        license_texts: read_bundled_text(
            "third-party-license-texts.txt",
            THIRD_PARTY_LICENSE_TEXTS_FALLBACK,
        ),
    }
}

#[tauri::command]
pub fn read_third_party_licenses() -> ThirdPartyLicenses {
    load_third_party_licenses()
}

#[tauri::command]
pub fn open_bundled_user_guide() -> Result<(), String> {
    let path = resolve_bundled_resource("user-guide-zh.md").ok_or_else(|| {
        "未找到随包 user-guide-zh.md；开发构建请确认 resources/ 已同步。".to_string()
    })?;
    open_path_with_system_default(&path)
}

#[cfg(target_os = "macos")]
pub fn attach_macos_app_menu(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{AboutMetadata, Menu, PredefinedMenuItem, Submenu};

    let about = AboutMetadata {
        name: Some(APP_PRODUCT_NAME.into()),
        version: Some(app_version_string()),
        copyright: Some(APP_COPYRIGHT.into()),
        ..Default::default()
    };
    let app_submenu = Submenu::with_items(
        app,
        APP_PRODUCT_NAME,
        true,
        &[
            &PredefinedMenuItem::about(app, None, Some(about))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, Some("退出如是我闻"))?,
        ],
    )?;
    let menu = Menu::with_items(app, &[&app_submenu])?;
    app.set_menu(menu)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_info_text_matches_diagnostic_shape() {
        let info = build_app_build_info(
            Some(Path::new("/tmp/rushi-data")),
            Some(Path::new("/tmp/rushi-data/rushi.sqlite3")),
        );
        let text = format_build_info_text(&info);
        assert!(text.starts_with("rushi-desktop "));
        assert!(text.contains("platform: "));
        assert!(text.contains("identifier: studio.lingchuang.rushi"));
        assert!(text.contains("app_data_root: /tmp/rushi-data"));
        assert!(text.contains("db_path: /tmp/rushi-data/rushi.sqlite3"));
    }

    #[test]
    fn third_party_licenses_split_has_both_sections() {
        let licenses = load_third_party_licenses();
        assert!(licenses.notices.contains("Third-Party Notices"));
        assert!(licenses.notices.contains("FFmpeg / ffprobe"));
        assert!(licenses.license_texts.contains("ISC License"));
        assert!(licenses
            .license_texts
            .contains("GNU GENERAL PUBLIC LICENSE"));
    }
}

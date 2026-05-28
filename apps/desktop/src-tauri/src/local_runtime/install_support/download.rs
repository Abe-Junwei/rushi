use super::{
    ensure_not_cancelled, is_http_source, ARTIFACT_REQUEST_TIMEOUT, HTTP_CONNECT_TIMEOUT,
    MANIFEST_FETCH_TIMEOUT,
};
use super::super::installer::progress::update_progress;
use super::super::manifest::{artifact_sources, RuntimeComponent};
use futures_util::StreamExt;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::AppHandle;

fn build_manifest_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(HTTP_CONNECT_TIMEOUT)
        .timeout(MANIFEST_FETCH_TIMEOUT)
        .build()
        .map_err(|e| format!("manifest_client_build_failed: {e}"))
}

fn build_artifact_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(HTTP_CONNECT_TIMEOUT)
        .timeout(ARTIFACT_REQUEST_TIMEOUT)
        .build()
        .map_err(|e| format!("artifact_client_build_failed: {e}"))
}

pub fn read_text_source(source: &str) -> Result<String, String> {
    if is_http_source(source) {
        return tauri::async_runtime::block_on(async move {
            let client = build_manifest_http_client()?;
            let resp = client
                .get(source)
                .send()
                .await
                .map_err(|e| format!("manifest_fetch_failed: {e}"))?;
            if !resp.status().is_success() {
                return Err(format!("manifest_http_{}", resp.status().as_u16()));
            }
            resp.text()
                .await
                .map_err(|e| format!("manifest_read_failed: {e}"))
        });
    }
    let path = source.strip_prefix("file://").unwrap_or(source);
    fs::read_to_string(path).map_err(|e| format!("manifest_read_failed: {e}"))
}

fn download_to_path(
    handle: &AppHandle,
    url: &str,
    target: &Path,
    cancel: &Arc<AtomicBool>,
    version: &str,
) -> Result<(), String> {
    ensure_not_cancelled(cancel)?;
    if is_http_source(url) {
        let url_owned = url.to_string();
        let target_path = target.to_path_buf();
        let cancel_flag = cancel.clone();
        return tauri::async_runtime::block_on(async move {
            let client = build_artifact_http_client()?;
            let resp = client
                .get(&url_owned)
                .send()
                .await
                .map_err(|e| format!("artifact_fetch_failed: {e}"))?;
            if !resp.status().is_success() {
                return Err(format!("artifact_http_{}", resp.status().as_u16()));
            }
            let total = resp.content_length();
            let mut file =
                File::create(&target_path).map_err(|e| format!("artifact_create_failed: {e}"))?;
            let mut stream = resp.bytes_stream();
            let mut downloaded = 0_u64;
            while let Some(chunk) = stream.next().await {
                if cancel_flag.load(Ordering::SeqCst) {
                    return Err("cancelled".into());
                }
                let chunk = chunk.map_err(|e| format!("artifact_stream_failed: {e}"))?;
                file.write_all(&chunk)
                    .map_err(|e| format!("artifact_write_failed: {e}"))?;
                downloaded = downloaded.saturating_add(chunk.len() as u64);
                update_progress(
                    handle,
                    "downloading",
                    "正在下载本机语音识别组件…",
                    Some(version.to_string()),
                    Some(downloaded),
                    total,
                    None,
                );
            }
            Ok(())
        });
    }

    let source_path = PathBuf::from(url.strip_prefix("file://").unwrap_or(url));
    let total = fs::metadata(&source_path)
        .map_err(|e| format!("artifact_stat_failed: {e}"))?
        .len();
    let mut src = File::open(&source_path).map_err(|e| format!("artifact_open_failed: {e}"))?;
    let mut dst = File::create(target).map_err(|e| format!("artifact_create_failed: {e}"))?;
    let mut copied = 0_u64;
    let mut buf = vec![0_u8; 1024 * 1024];
    loop {
        ensure_not_cancelled(cancel)?;
        let n = src
            .read(&mut buf)
            .map_err(|e| format!("artifact_read_failed: {e}"))?;
        if n == 0 {
            break;
        }
        dst.write_all(&buf[..n])
            .map_err(|e| format!("artifact_write_failed: {e}"))?;
        copied = copied.saturating_add(n as u64);
        update_progress(
            handle,
            "downloading",
            "正在复制本机语音识别组件…",
            Some(version.to_string()),
            Some(copied),
            Some(total),
            None,
        );
    }
    Ok(())
}

pub fn download_component_artifact(
    handle: &AppHandle,
    component: &RuntimeComponent,
    target: &Path,
    cancel: &Arc<AtomicBool>,
) -> Result<(), String> {
    let sources = artifact_sources(component);
    let mut last_error = None;
    for (index, source) in sources.iter().enumerate() {
        ensure_not_cancelled(cancel)?;
        if index > 0 {
            update_progress(
                handle,
                "downloading",
                format!(
                    "主下载源失败，正在尝试镜像源 {index}/{}…",
                    sources.len() - 1
                ),
                Some(component.version.clone()),
                None,
                component.size_bytes,
                None,
            );
        }
        let _ = fs::remove_file(target);
        match download_to_path(handle, source, target, cancel, &component.version) {
            Ok(()) => return Ok(()),
            Err(err) if err == "cancelled" => return Err(err),
            Err(err) => {
                last_error = Some(format!("{source}: {err}"));
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "artifact_fetch_failed".into()))
}

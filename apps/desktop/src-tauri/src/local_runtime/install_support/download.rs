use super::{
    ensure_not_cancelled, is_http_source, ARTIFACT_REQUEST_TIMEOUT, HTTP_CONNECT_TIMEOUT,
    MANIFEST_FETCH_TIMEOUT,
};
use super::download_resume::{
    artifact_download_paths, clear_resume_artifacts, ensure_resume_compatible, existing_part_offset,
    gc_stale_download_parts, save_resume_meta, DownloadResumeMeta,
};
use super::super::installer::progress::update_progress;
use super::super::manifest::{artifact_sources, RuntimeComponent};
use futures_util::StreamExt;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
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

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn write_resume_meta(
    meta_path: &Path,
    component: &RuntimeComponent,
    url: &str,
    total_bytes: Option<u64>,
) -> Result<(), String> {
    save_resume_meta(
        meta_path,
        &DownloadResumeMeta {
            version: component.version.clone(),
            sha256: component.sha256.trim().to_ascii_lowercase(),
            url: url.to_string(),
            total_bytes,
            updated_at_ms: now_ms(),
        },
    )
}

async fn download_http_with_resume(
    handle: &AppHandle,
    url: &str,
    target: &Path,
    meta_path: &Path,
    component: &RuntimeComponent,
    cancel: &Arc<AtomicBool>,
) -> Result<(), String> {
    let client = build_artifact_http_client()?;
    let mut force_fresh = false;

    loop {
        let mut offset = if std::mem::take(&mut force_fresh) {
            0
        } else {
            existing_part_offset(target)
        };

        if offset > 0 {
            update_progress(
                handle,
                "downloading",
                format!(
                    "正在从断点续传本机语音识别组件（已下载 {} MB）…",
                    offset / (1024 * 1024)
                ),
                Some(component.version.clone()),
                Some(offset),
                component.size_bytes,
                None,
            );
        }

        let mut req = client.get(url);
        if offset > 0 {
            req = req.header("Range", format!("bytes={offset}-"));
        }
        let resp = req
            .send()
            .await
            .map_err(|e| format!("artifact_fetch_failed: {e}"))?;
        let status = resp.status();
        let total = resp
            .content_length()
            .map(|n| n.saturating_add(if status.as_u16() == 206 { offset } else { 0 }))
            .or(component.size_bytes);

        if status.as_u16() == 416 {
            if let Some(expected) = component.size_bytes {
                if offset >= expected {
                    write_resume_meta(meta_path, component, url, Some(expected))?;
                    return Ok(());
                }
            }
            clear_resume_artifacts(target, meta_path);
            force_fresh = true;
            continue;
        }

        if !status.is_success() {
            return Err(format!("artifact_http_{}", status.as_u16()));
        }

        if status.as_u16() == 200 && offset > 0 {
            clear_resume_artifacts(target, meta_path);
            offset = 0;
        }

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("artifact_create_failed: {e}"))?;
        }
        let mut file = if offset > 0 {
            OpenOptions::new()
                .append(true)
                .open(target)
                .map_err(|e| format!("artifact_open_failed: {e}"))?
        } else {
            File::create(target).map_err(|e| format!("artifact_create_failed: {e}"))?
        };

        let resumed = offset > 0;
        let mut stream = resp.bytes_stream();
        let mut downloaded = offset;
        while let Some(chunk) = stream.next().await {
            if cancel.load(Ordering::SeqCst) {
                write_resume_meta(meta_path, component, url, total)?;
                return Err("cancelled".into());
            }
            let chunk = chunk.map_err(|e| format!("artifact_stream_failed: {e}"))?;
            file.write_all(&chunk)
                .map_err(|e| format!("artifact_write_failed: {e}"))?;
            downloaded = downloaded.saturating_add(chunk.len() as u64);
            write_resume_meta(meta_path, component, url, total)?;
            update_progress(
                handle,
                "downloading",
                if resumed {
                    "正在断点续传本机语音识别组件…".to_string()
                } else {
                    "正在下载本机语音识别组件…".to_string()
                },
                Some(component.version.clone()),
                Some(downloaded),
                total,
                None,
            );
        }
        write_resume_meta(meta_path, component, url, total)?;
        return Ok(());
    }
}

fn download_to_path(
    handle: &AppHandle,
    app_root: &Path,
    url: &str,
    target: &Path,
    meta_path: &Path,
    component: &RuntimeComponent,
    cancel: &Arc<AtomicBool>,
) -> Result<(), String> {
    ensure_not_cancelled(cancel)?;
    if is_http_source(url) {
        let url_owned = url.to_string();
        let target_path = target.to_path_buf();
        let meta_owned = meta_path.to_path_buf();
        let component_owned = component.clone();
        let cancel_flag = cancel.clone();
        let handle_owned = handle.clone();
        return tauri::async_runtime::block_on(async move {
            download_http_with_resume(
                &handle_owned,
                &url_owned,
                &target_path,
                &meta_owned,
                &component_owned,
                &cancel_flag,
            )
            .await
        });
    }

    let source_path = PathBuf::from(url.strip_prefix("file://").unwrap_or(url));
    let total = fs::metadata(&source_path)
        .map_err(|e| format!("artifact_stat_failed: {e}"))?
        .len();
    let mut src = std::fs::File::open(&source_path).map_err(|e| format!("artifact_open_failed: {e}"))?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("artifact_create_failed: {e}"))?;
    }
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
        write_resume_meta(meta_path, component, url, Some(total))?;
        update_progress(
            handle,
            "downloading",
            "正在复制本机语音识别组件…",
            Some(component.version.clone()),
            Some(copied),
            Some(total),
            None,
        );
    }
    let _ = app_root;
    Ok(())
}

pub fn download_component_artifact(
    handle: &AppHandle,
    app_root: &Path,
    component: &RuntimeComponent,
    target: &Path,
    cancel: &Arc<AtomicBool>,
) -> Result<(), String> {
    let (_, meta_path) = artifact_download_paths(app_root, component);
    gc_stale_download_parts(app_root, component);
    ensure_resume_compatible(target, &meta_path, component)?;
    let sources = artifact_sources(component);
    let mut last_error = None;
    for (index, source) in sources.iter().enumerate() {
        ensure_not_cancelled(cancel)?;
        if index > 0 {
            update_progress(
                handle,
                "downloading",
                format!(
                    "主下载源失败，正在尝试镜像源 {index}/{}（保留已下载字节）…",
                    sources.len() - 1
                ),
                Some(component.version.clone()),
                Some(existing_part_offset(target)),
                component.size_bytes,
                None,
            );
        }
        match download_to_path(
            handle,
            app_root,
            source,
            target,
            &meta_path,
            component,
            cancel,
        ) {
            Ok(()) => return Ok(()),
            Err(err) if err == "cancelled" => return Err(err),
            Err(err) => {
                last_error = Some(format!("{source}: {err}"));
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "artifact_fetch_failed".into()))
}

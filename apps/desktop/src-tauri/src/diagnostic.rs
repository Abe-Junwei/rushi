//! P4: export a small diagnostic zip (version, platform, optional SQLite copy,
//! recent edit_log TSV, tail of logs/*.log under app data).

use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::ops::Deref;
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OpenFlags};
use tauri::{AppHandle, Manager, State};
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;
use zip::ZipWriter;

use crate::diagnostic_db_sanitize::{
    copy_sanitized_diagnostic_db, redact_diagnostic_log_tail, redact_edit_log_detail_cell,
};
use crate::DbState;

const MAX_DB_BYTES: u64 = 5 * 1024 * 1024;
const MAX_LOG_TAIL_BYTES: usize = 256 * 1024;

fn zip_opts() -> SimpleFileOptions {
    SimpleFileOptions::default().compression_method(CompressionMethod::Deflated)
}

#[tauri::command]
pub fn export_diagnostic_bundle(
    app: AppHandle,
    state: State<DbState>,
) -> Result<Option<String>, String> {
    let st: &DbState = state.deref();
    let picked = rfd::FileDialog::new()
        .add_filter("ZIP", &["zip"])
        .set_file_name("rushi-diagnostic.zip")
        .save_file();
    let Some(zip_path) = picked else {
        return Ok(None);
    };

    let tmp_path: PathBuf = zip_path.with_extension("zip.part");
    let file = File::create(&tmp_path).map_err(|e| format!("创建 zip 失败: {e}"))?;
    let mut zip = ZipWriter::new(file);

    let version = env!("CARGO_PKG_VERSION");
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    let db_path = st.db_path.display().to_string();
    let root = st.root.display().to_string();

    let meta = format!(
        "rushi-desktop {version}\nplatform: {os} {arch}\napp_data_root: {root}\ndb_path: {db_path}\n",
    );
    zip.start_file("build-info.txt", zip_opts())
        .map_err(|e| e.to_string())?;
    zip.write_all(meta.as_bytes()).map_err(|e| e.to_string())?;

    let manifest_probe = crate::local_runtime::catalog::diagnose_configured_manifest();
    let installed_runtime = crate::local_runtime::integrity::inspect_installed_runtime(&st.root);
    let install_progress = crate::local_runtime::installer::install_progress(&app);
    let runtime_source = match installed_runtime.status {
        crate::local_runtime::integrity::InstalledRuntimeStatus::Installed
        | crate::local_runtime::integrity::InstalledRuntimeStatus::Corrupt => "app_data",
        crate::local_runtime::integrity::InstalledRuntimeStatus::Missing
            if crate::asr_sidecar::bundled_sidecar_resources_present(&app) =>
        {
            "bundled"
        }
        crate::local_runtime::integrity::InstalledRuntimeStatus::Missing => "missing",
    };
    let local_runtime_note = format!(
        "manifest_source: {}\nmanifest_status: {}\nmanifest_issue: {}\nmanifest_signature_key_id: {}\navailable_version: {}\nruntime_source: {}\ncurrent_version: {}\nprevious_version: {}\nlast_verify_error: {}\nlast_install_phase: {}\ninstall_progress_phase: {}\ninstall_progress_version: {}\ninstall_progress_error: {}\n",
        manifest_probe.source.as_deref().unwrap_or("(missing)"),
        manifest_probe.status,
        manifest_probe.blocking_issue.as_deref().unwrap_or("(none)"),
        manifest_probe.signature_key_id.as_deref().unwrap_or("(none)"),
        manifest_probe.available_version.as_deref().unwrap_or("(none)"),
        runtime_source,
        installed_runtime.version.as_deref().unwrap_or("(none)"),
        installed_runtime.previous_version.as_deref().unwrap_or("(none)"),
        installed_runtime.last_verify_error.as_deref().unwrap_or("(none)"),
        installed_runtime.last_install_phase.as_deref().unwrap_or("(none)"),
        install_progress.phase,
        install_progress.version.as_deref().unwrap_or("(none)"),
        install_progress.error.as_deref().unwrap_or("(none)"),
    );
    zip.start_file("local-runtime.txt", zip_opts())
        .map_err(|e| e.to_string())?;
    zip.write_all(local_runtime_note.as_bytes())
        .map_err(|e| e.to_string())?;

    let hub_model = crate::local_asr_model::read_hub_model_pref(st);
    let bundled_launch = app
        .try_state::<crate::asr_sidecar::BundledAsrLaunchState>()
        .and_then(|st| st.0.lock().ok().map(|g| g.clone()))
        .unwrap_or_default();
    let asr_port_probe = tauri::async_runtime::block_on(crate::asr_sidecar::probe_asr_port());
    let asr_setup_note = format!(
        "hub_model_pref: {}\nbundled_launch_attempted: {}\nbundled_launch_success: {}\nbundled_launch_detail: {}\nasr_port_status: {:?}\nasr_port_detail: {}\n",
        hub_model.as_deref().unwrap_or("(none)"),
        bundled_launch.attempted,
        bundled_launch.success,
        bundled_launch.detail.as_deref().unwrap_or("(none)"),
        asr_port_probe.status,
        asr_port_probe.detail.as_deref().unwrap_or("(none)"),
    );
    zip.start_file("asr-setup.txt", zip_opts())
        .map_err(|e| e.to_string())?;
    zip.write_all(asr_setup_note.as_bytes())
        .map_err(|e| e.to_string())?;

    let mut include_db = false;
    let mut sanitized_tmp: Option<PathBuf> = None;
    let db_note = if let Ok(meta_db) = fs::metadata(&st.db_path) {
        let len = meta_db.len();
        if len <= MAX_DB_BYTES {
            match copy_sanitized_diagnostic_db(&st.db_path) {
                Ok(tmp) => {
                    include_db = true;
                    sanitized_tmp = Some(tmp);
                    format!("included rushi.sqlite3 ({len} bytes, transcript redacted)\n")
                }
                Err(e) => format!("skipped rushi.sqlite3 (sanitize failed: {e})\n"),
            }
        } else {
            format!("skipped rushi.sqlite3 (size {len} > {MAX_DB_BYTES})\n")
        }
    } else {
        "db file not found or unreadable\n".to_string()
    };

    zip.start_file("database-readme.txt", zip_opts())
        .map_err(|e| e.to_string())?;
    zip.write_all(db_note.as_bytes())
        .map_err(|e| e.to_string())?;

    if include_db {
        let db_src = sanitized_tmp.as_ref().unwrap_or(&st.db_path);
        let bytes = fs::read(db_src).map_err(|e| e.to_string())?;
        zip.start_file("rushi.sqlite3", zip_opts())
            .map_err(|e| e.to_string())?;
        zip.write_all(&bytes).map_err(|e| e.to_string())?;
    }

    let db_for_edit_log = sanitized_tmp.as_deref().unwrap_or(st.db_path.as_path());
    match Connection::open_with_flags(db_for_edit_log, OpenFlags::SQLITE_OPEN_READ_ONLY) {
        Ok(conn) => {
            if let Err(e) = zip_recent_edit_log_tsv(&conn, &mut zip) {
                let note = format!("could not export edit_log: {e}\n");
                zip.start_file("recent_edit_log-readme.txt", zip_opts())
                    .map_err(|e| e.to_string())?;
                zip.write_all(note.as_bytes()).map_err(|e| e.to_string())?;
            }
        }
        Err(e) => {
            let note = format!("could not open db read-only for edit_log: {e}\n");
            zip.start_file("recent_edit_log-readme.txt", zip_opts())
                .map_err(|e| e.to_string())?;
            zip.write_all(note.as_bytes()).map_err(|e| e.to_string())?;
        }
    }

    let logs_dir = st.root.join("logs");
    let mut logs_note = String::from(
        "Tails are UTF-8 text, up to 256KiB each (first line may be trimmed if mid-file cut).\n",
    );
    if logs_dir.is_dir() {
        if let Ok(rd) = fs::read_dir(&logs_dir) {
            for ent in rd.flatten() {
                let p = ent.path();
                let Ok(sm) = fs::symlink_metadata(&p) else {
                    continue;
                };
                if sm.file_type().is_symlink() {
                    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("?");
                    logs_note.push_str(&format!("skip symlink: {name}\n"));
                    continue;
                }
                if !sm.is_file() {
                    continue;
                }
                let is_log = p
                    .extension()
                    .and_then(|x| x.to_str())
                    .map(|x| x.eq_ignore_ascii_case("log"))
                    == Some(true);
                if !is_log {
                    continue;
                }
                let name = p
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown.log");
                match read_file_tail_utf8(&p, MAX_LOG_TAIL_BYTES) {
                    Ok(content) => {
                        let redacted = redact_diagnostic_log_tail(&content);
                        let zip_name = format!("logs/{name}");
                        zip.start_file(zip_name, zip_opts())
                            .map_err(|e| e.to_string())?;
                        zip.write_all(redacted.as_bytes())
                            .map_err(|e| e.to_string())?;
                        logs_note.push_str(&format!("included tail: {name}\n"));
                    }
                    Err(e) => {
                        logs_note.push_str(&format!("skip {name}: {e}\n"));
                    }
                }
            }
        }
    } else {
        logs_note.push_str("logs/ directory does not exist yet.\n");
    }
    zip.start_file("logs-readme.txt", zip_opts())
        .map_err(|e| e.to_string())?;
    zip.write_all(logs_note.as_bytes())
        .map_err(|e| e.to_string())?;

    zip.start_file("diagnostic-contents.txt", zip_opts())
        .map_err(|e| e.to_string())?;
    zip.write_all(
        b"Files in this zip:\n\
- build-info.txt - version, OS, app_data_root, db_path\n\
- local-runtime.txt - manifest source/status, runtime source, current/previous version, verify/install context, live installer progress\n\
- asr-setup.txt - hub model pref, bundled launch report, loopback port probe\n\
- database-readme.txt - whether rushi.sqlite3 is embedded\n\
- rushi.sqlite3 - optional sanitized copy (segment text and names redacted)\n\
- recent_edit_log.tsv - last 500 edit_log rows (detail redacted)\n\
- logs/*.log - tail of each .log file (secrets/transcript snippets redacted)\n\
- logs-readme.txt - which log tails were included\n",
    )
    .map_err(|e| e.to_string())?;

    zip.finish().map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        e.to_string()
    })?;
    fs::rename(&tmp_path, &zip_path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        format!("无法将诊断包移动到目标路径: {e}")
    })?;
    if let Some(tmp_db) = sanitized_tmp {
        let _ = fs::remove_file(tmp_db);
    }
    Ok(Some(zip_path.to_string_lossy().to_string()))
}

fn zip_recent_edit_log_tsv(conn: &Connection, zip: &mut ZipWriter<File>) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, at_ms, kind, detail FROM edit_log ORDER BY id DESC LIMIT 500",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut body = String::from("id\tproject_id\tat_ms\tkind\tdetail\n");
    for row in rows {
        let (id, pid, at_ms, kind, detail) = row.map_err(|e| e.to_string())?;
        let detail_redacted = redact_edit_log_detail_cell(&detail);
        let detail_esc = detail_redacted.replace(['\t', '\n', '\r'], " ");
        body.push_str(&format!("{id}\t{pid}\t{at_ms}\t{kind}\t{detail_esc}\n"));
    }
    zip.start_file("recent_edit_log.tsv", zip_opts())
        .map_err(|e| e.to_string())?;
    zip.write_all(body.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

fn read_file_tail_utf8(path: &Path, max_bytes: usize) -> std::io::Result<String> {
    let mut f = File::open(path)?;
    let len = f.metadata()?.len() as usize;
    let start = len.saturating_sub(max_bytes);
    let mut buf = vec![0u8; len.saturating_sub(start)];
    if start > 0 {
        f.seek(SeekFrom::Start(start as u64))?;
    }
    f.read_exact(&mut buf)?;
    let mut s = String::from_utf8_lossy(&buf).into_owned();
    if start > 0 {
        if let Some(i) = s.find('\n') {
            s = s[i + 1..].to_string();
        }
    }
    Ok(s)
}

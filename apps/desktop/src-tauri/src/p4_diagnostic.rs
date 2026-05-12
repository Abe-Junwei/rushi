//! P4: export a small diagnostic zip (version, platform, optional SQLite copy,
//! recent edit_log TSV, tail of logs/*.log under app data).

use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::ops::Deref;
use std::path::Path;

use rusqlite::{Connection, OpenFlags};
use tauri::State;
use zip::write::FileOptions;
use zip::CompressionMethod;
use zip::ZipWriter;

use crate::DbState;

const MAX_DB_BYTES: u64 = 5 * 1024 * 1024;
const MAX_LOG_TAIL_BYTES: usize = 256 * 1024;

fn zip_opts() -> FileOptions {
    FileOptions::default().compression_method(CompressionMethod::Deflated)
}

#[tauri::command]
pub fn p4_export_diagnostic_bundle(state: State<DbState>) -> Result<Option<String>, String> {
    let st: &DbState = state.deref();
    let picked = rfd::FileDialog::new()
        .add_filter("ZIP", &["zip"])
        .set_file_name("rushi-diagnostic.zip")
        .save_file();
    let Some(zip_path) = picked else {
        return Ok(None);
    };

    let file = File::create(&zip_path).map_err(|e| format!("创建 zip 失败: {e}"))?;
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

    let mut include_db = false;
    let db_note = if let Ok(meta_db) = fs::metadata(&st.db_path) {
        let len = meta_db.len();
        if len <= MAX_DB_BYTES {
            include_db = true;
            format!("included rushi.sqlite3 ({len} bytes)\n")
        } else {
            format!("skipped rushi.sqlite3 (size {len} > {MAX_DB_BYTES})\n")
        }
    } else {
        "db file not found or unreadable\n".to_string()
    };

    zip.start_file("database-readme.txt", zip_opts())
        .map_err(|e| e.to_string())?;
    zip.write_all(db_note.as_bytes()).map_err(|e| e.to_string())?;

    if include_db {
        let bytes = fs::read(&st.db_path).map_err(|e| e.to_string())?;
        zip.start_file("rushi.sqlite3", zip_opts())
            .map_err(|e| e.to_string())?;
        zip.write_all(&bytes).map_err(|e| e.to_string())?;
    }

    match Connection::open_with_flags(&st.db_path, OpenFlags::SQLITE_OPEN_READ_ONLY) {
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
                if !p.is_file() {
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
                let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("unknown.log");
                match read_file_tail_utf8(&p, MAX_LOG_TAIL_BYTES) {
                    Ok(content) => {
                        let zip_name = format!("logs/{name}");
                        zip.start_file(zip_name, zip_opts())
                            .map_err(|e| e.to_string())?;
                        zip.write_all(content.as_bytes())
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
- database-readme.txt - whether rushi.sqlite3 is embedded\n\
- rushi.sqlite3 - optional copy (small DB only)\n\
- recent_edit_log.tsv - last 500 rows from SQLite edit_log (tab-separated)\n\
- logs/*.log - tail of each .log file under app_data_root/logs\n\
- logs-readme.txt - which log tails were included\n",
    )
    .map_err(|e| e.to_string())?;

    zip.finish().map_err(|e| e.to_string())?;
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
        let detail_esc = detail
            .replace('\t', " ")
            .replace('\n', " ")
            .replace('\r', " ");
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
    let start = if len > max_bytes { len - max_bytes } else { 0 };
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

use rusqlite::Connection;

use super::super::columns::table_columns;
use crate::project::file_name_unique::unique_file_name;

pub(super) fn migrate_files_import_provenance(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "files")?;
    if cols.is_empty() {
        return Ok(());
    }
    if !cols.iter().any(|c| c == "import_source_path") {
        conn.execute("ALTER TABLE files ADD COLUMN import_source_path TEXT", [])?;
    }
    if !cols.iter().any(|c| c == "import_content_sha256") {
        conn.execute(
            "ALTER TABLE files ADD COLUMN import_content_sha256 TEXT",
            [],
        )?;
    }
    if !cols.iter().any(|c| c == "import_source_size") {
        conn.execute(
            "ALTER TABLE files ADD COLUMN import_source_size INTEGER",
            [],
        )?;
    }
    if !cols.iter().any(|c| c == "import_source_modified_ms") {
        conn.execute(
            "ALTER TABLE files ADD COLUMN import_source_modified_ms INTEGER",
            [],
        )?;
    }
    // SHA256 backfill runs deferred after pool open (see bootstrap_db_at) so migrate never blocks on hashing.
    Ok(())
}

/// R3 决策：`files.name` 加全局 UNIQUE 索引防并发写入产生重名（历史仅靠应用层
/// `unique_file_name` advisory 检查，存在竞态窗口）。若历史数据已有重名，迁移时
/// 保留每组中最早创建的一条，其余按 Finder 风格追加 ` (2)` 等后缀去重，并写入
/// `edit_log` 留痕，再建唯一索引。
pub(crate) fn migrate_files_name_unique(conn: &Connection) -> rusqlite::Result<()> {
    let cols = table_columns(conn, "files")?;
    if cols.is_empty() {
        return Ok(());
    }
    let index_exists = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_files_name_unique'",
        [],
        |row| row.get::<_, i64>(0),
    )? > 0;
    if index_exists {
        return Ok(());
    }

    let mut dup_stmt = conn.prepare(
        "SELECT id, name, project_id FROM files WHERE name IN (
            SELECT name FROM files GROUP BY name HAVING COUNT(*) > 1
        ) ORDER BY name, created_at_ms ASC, id ASC",
    )?;
    let duplicates: Vec<(String, String, String)> = dup_stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    drop(dup_stmt);

    let mut kept_names: std::collections::HashSet<String> = std::collections::HashSet::new();
    for (file_id, name, project_id) in duplicates {
        if kept_names.insert(name.clone()) {
            // Earliest-created row in this duplicate group keeps its name.
            continue;
        }
        let renamed = unique_file_name(conn, &name, Some(file_id.as_str()))
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::other(e))))?;
        conn.execute(
            "UPDATE files SET name = ?1 WHERE id = ?2",
            rusqlite::params![renamed, file_id],
        )?;
        let detail = serde_json::json!({
            "file_id": file_id,
            "old_name": name,
            "new_name": renamed,
        })
        .to_string();
        conn.execute(
            "INSERT INTO edit_log (project_id, at_ms, kind, detail) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![
                project_id,
                chrono::Utc::now().timestamp_millis(),
                "migration_dedupe_file_name",
                detail,
            ],
        )?;
    }

    conn.execute_batch("CREATE UNIQUE INDEX IF NOT EXISTS idx_files_name_unique ON files(name);")?;
    Ok(())
}

use std::path::Path;
use std::time::Duration;

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;

use super::migrate;

pub type DbPool = Pool<SqliteConnectionManager>;

/// Shared PRAGMA for any non-pooled SQLite connection (WAL + busy_timeout + FK).
pub fn configure_sqlite_connection(conn: &Connection) -> rusqlite::Result<()> {
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.busy_timeout(Duration::from_millis(5000))?;
    Ok(())
}

/// Read-only opens: busy_timeout only (no journal_mode change on RO handles).
pub fn configure_sqlite_connection_readonly(conn: &Connection) -> rusqlite::Result<()> {
    conn.busy_timeout(Duration::from_millis(5000))?;
    Ok(())
}

fn configure_pooled_connection(conn: &mut Connection) -> rusqlite::Result<()> {
    configure_sqlite_connection(conn)
}

pub fn open_pool(db_path: &Path) -> Result<DbPool, String> {
    let manager = SqliteConnectionManager::file(db_path).with_init(configure_pooled_connection);
    Pool::builder()
        .max_size(8)
        .build(manager)
        .map_err(|e| e.to_string())
}

/// Migrate (idempotent), then return a WAL-enabled connection pool.
pub fn bootstrap_db_at(db_path: &Path) -> Result<DbPool, String> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        migrate(&conn).map_err(|e| e.to_string())?;
    }
    let pool = open_pool(db_path)?;
    // Defer SHA256 provenance backfill so startup migrate is not blocked hashing every audio file.
    spawn_import_provenance_backfill(pool.clone());
    Ok(pool)
}

fn spawn_import_provenance_backfill(pool: DbPool) {
    std::thread::spawn(move || {
        let conn = match pool.get() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[db] backfill_files_import_provenance: pool get failed: {e}");
                return;
            }
        };
        if let Err(e) = crate::project::import_duplicate::backfill_files_import_provenance(&conn) {
            eprintln!("[db] backfill_files_import_provenance: {e}");
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn bootstrap_db_at_enables_wal_on_pooled_connections() {
        let root = std::env::temp_dir().join(format!("rushi-db-pool-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let db_path = root.join("rushi.sqlite3");
        let pool = bootstrap_db_at(&db_path).expect("bootstrap pool");
        let conn = pool.get().expect("pool conn");
        let mode: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .expect("journal_mode");
        assert_eq!(mode.to_ascii_lowercase(), "wal");
        let _ = fs::remove_dir_all(&root);
    }
}

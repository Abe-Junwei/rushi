pub(crate) mod correction_memory;
pub(crate) mod edit_log;
pub(crate) mod files;
pub(crate) mod glossary;
pub(crate) mod projects;
pub(crate) mod segments;

use rusqlite::Connection;

pub(super) fn run_incremental(conn: &Connection) -> rusqlite::Result<()> {
    segments::migrate_segments_p2(conn)?;
    segments::migrate_segments_uid(conn)?;
    segments::migrate_segments_kind(conn)?;
    segments::migrate_segments_text_stage(conn)?;
    segments::migrate_segments_annotation(conn)?;
    segments::migrate_segments_frozen(conn)?;
    glossary::migrate_glossary_p2(conn)?;
    glossary::migrate_glossary_gly2(conn)?;
    glossary::migrate_glossary_gly3(conn)?;
    correction_memory::migrate_correction_memory_p2(conn)?;
    edit_log::migrate_edit_log_snapshots(conn)?;
    files::migrate_files_import_provenance(conn)?;
    files::migrate_files_name_unique(conn)?;
    projects::migrate_projects_metadata(conn)?;
    Ok(())
}

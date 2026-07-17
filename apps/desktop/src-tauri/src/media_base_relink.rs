//! Best-effort relink when the media base directory itself is unreachable (deleted / moved /
//! drive unmounted outside the app). Split out from `media_base_relocate` (which handles the
//! *normal* case where the source directory still exists) so neither file grows past the
//! architecture guard's line threshold.
//!
//! See [`docs/execution/specs/user-library-location-slice4-relink-research.md`] for the
//! industry precedent (Lightroom "Find Missing Folder" / Resolve "Change Source Folder" /
//! Zotero Linked Attachment Base Directory auto-relink) this mirrors: repoint the base first,
//! don't require the old location to still exist.

use crate::media_base_dir::audio_project_dir;
use crate::media_base_relocate::{
    list_audio_rows, paths_same_file, resolve_for_relocate, store_absolute_under_dest,
};
use crate::project::utils::open_db;
use crate::DbState;
use rusqlite::params;
use std::path::Path;

/// Best-effort relink when the *source* media base itself is unreachable. There is nothing to
/// copy from, so unlike `relocate_all_to` this never fails the whole commit: rows whose file
/// already sits at `dest_base` under the expected `projects/{id}/{filename}` layout get
/// relinked; everything else is left untouched and will surface as a normal per-file
/// "无法解析" error when opened — same UX as any other missing-media case, not a new failure mode.
pub(crate) fn relink_from_missing_source(st: &DbState, dest_base: &Path) {
    let Ok(rows) = list_audio_rows(st) else {
        return;
    };
    let Ok(conn) = open_db(st) else { return };
    for (file_id, project_id, audio_path) in rows {
        let dest_proj = audio_project_dir(dest_base, &project_id);
        let Ok(resolved) = resolve_for_relocate(st, &file_id, &audio_path, &dest_proj) else {
            continue;
        };
        let Some(file_name) = resolved.file_name() else {
            continue;
        };
        let dest_audio = dest_proj.join(file_name);
        if !paths_same_file(&resolved, &dest_audio) {
            // Source unreachable means the only trustworthy match is one already sitting
            // at the destination; anything else would require a move we can't verify.
            continue;
        }
        let Ok(stored) = store_absolute_under_dest(&dest_audio) else {
            continue;
        };
        let _ = conn.execute(
            "UPDATE files SET audio_path = ?1, updated_at_ms = ?2 WHERE id = ?3",
            params![
                stored,
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(0),
                file_id
            ],
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media_base_dir::write_media_base_pref;
    use crate::media_base_relocate::apply_media_base_dir_change;
    use std::fs;
    use std::path::PathBuf;
    use uuid::Uuid;

    fn temp_state() -> (PathBuf, DbState) {
        let tmp = std::env::temp_dir().join(format!("rushi-relink-{}", Uuid::new_v4()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        let st = DbState::open_test_db_at(tmp.clone(), tmp.join("app.db"));
        (tmp, st)
    }

    fn insert_row(st: &DbState, project_id: &str, file_id: &str, audio_path: &str) {
        let conn = open_db(st).unwrap();
        let t = 1_i64;
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES (?1, 'p', ?2, ?2)",
            params![project_id, t],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, audio_path, created_at_ms, updated_at_ms) \
             VALUES (?1, ?2, 'n', 'audio_only', ?3, ?4, ?4)",
            params![file_id, project_id, audio_path, t],
        )
        .unwrap();
    }

    #[test]
    fn restore_default_relinks_when_custom_base_deleted_but_files_already_at_dest() {
        let (tmp, st) = temp_state();
        let media_gone = tmp.join("gone");
        fs::create_dir_all(&media_gone).unwrap();
        write_media_base_pref(&st, media_gone.to_str().unwrap()).unwrap();

        let project_id = Uuid::new_v4().to_string();
        let file_id = Uuid::new_v4().to_string();
        // The user manually copied the file to the app_data root's project layout
        // (e.g. restoring from a backup) after the custom base directory vanished.
        let dest_audio = audio_project_dir(&st.root, &project_id).join(format!("{file_id}.wav"));
        fs::create_dir_all(dest_audio.parent().unwrap()).unwrap();
        fs::write(&dest_audio, b"wav").unwrap();
        insert_row(
            &st,
            &project_id,
            &file_id,
            &format!("projects/{project_id}/{file_id}.wav"),
        );

        fs::remove_dir_all(&media_gone).unwrap();
        assert!(crate::media_base_dir::resolve_media_base(&st).is_err());

        let info = apply_media_base_dir_change(None, true, &st).unwrap();
        assert!(!info.unavailable);
        assert!(!info.is_custom);

        let resolved = crate::media_base_dir::resolve_audio_path(
            &st,
            &format!("projects/{project_id}/{file_id}.wav"),
        )
        .unwrap();
        assert_eq!(resolved, fs::canonicalize(&dest_audio).unwrap());
        let _ = fs::remove_dir_all(tmp);
    }

    #[test]
    fn restore_default_succeeds_even_when_file_unrecoverable_at_dest() {
        let (tmp, st) = temp_state();
        let media_gone = tmp.join("gone");
        fs::create_dir_all(&media_gone).unwrap();
        write_media_base_pref(&st, media_gone.to_str().unwrap()).unwrap();

        let project_id = Uuid::new_v4().to_string();
        let file_id = Uuid::new_v4().to_string();
        insert_row(
            &st,
            &project_id,
            &file_id,
            &format!("projects/{project_id}/{file_id}.wav"),
        );

        fs::remove_dir_all(&media_gone).unwrap();

        // Must not dead-end: switching back to default succeeds even though the file
        // can't be found anywhere; it will surface as a normal per-file resolve error.
        let info = apply_media_base_dir_change(None, true, &st).unwrap();
        assert!(!info.unavailable);
        assert!(!info.is_custom);
        let _ = fs::remove_dir_all(tmp);
    }

    #[test]
    fn pick_new_dir_relinks_when_old_custom_base_deleted() {
        let (tmp, st) = temp_state();
        let media_gone = tmp.join("gone");
        let media_new = tmp.join("new-location");
        fs::create_dir_all(&media_gone).unwrap();
        fs::create_dir_all(&media_new).unwrap();
        write_media_base_pref(&st, media_gone.to_str().unwrap()).unwrap();

        let project_id = Uuid::new_v4().to_string();
        let file_id = Uuid::new_v4().to_string();
        // User already moved the media by hand to `media_new` before reconnecting in-app.
        let dest_audio = audio_project_dir(&media_new, &project_id).join(format!("{file_id}.wav"));
        fs::create_dir_all(dest_audio.parent().unwrap()).unwrap();
        fs::write(&dest_audio, b"wav").unwrap();
        insert_row(
            &st,
            &project_id,
            &file_id,
            &format!("projects/{project_id}/{file_id}.wav"),
        );

        fs::remove_dir_all(&media_gone).unwrap();

        let info =
            apply_media_base_dir_change(Some(media_new.to_str().unwrap().to_string()), true, &st)
                .unwrap();
        assert!(!info.unavailable);
        assert_eq!(
            fs::canonicalize(&info.media_base_dir).unwrap(),
            fs::canonicalize(&media_new).unwrap()
        );

        let resolved = crate::media_base_dir::resolve_audio_path(
            &st,
            &format!("projects/{project_id}/{file_id}.wav"),
        )
        .unwrap();
        assert_eq!(resolved, fs::canonicalize(&dest_audio).unwrap());
        let _ = fs::remove_dir_all(tmp);
    }
}

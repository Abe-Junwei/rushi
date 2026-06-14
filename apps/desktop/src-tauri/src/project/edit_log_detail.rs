use super::types::SegmentDto;
use rusqlite::Connection;
use serde::Serialize;
use std::collections::HashMap;

const MAX_CHANGES: usize = 24;
const SNIPPET_CHARS: usize = 72;

#[derive(Debug, Clone, Serialize)]
pub(crate) struct TextChangeRow {
    segment_idx: i32,
    uid: String,
    before: String,
    after: String,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct CorrectionPairRow {
    before: String,
    after: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SaveSegmentsEditDetail {
    pub op: &'static str,
    pub file_id: String,
    pub count: usize,
    pub at_ms: i64,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub text_changes: Vec<TextChangeRow>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub correction_pairs: Vec<CorrectionPairRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RestoreFromEditLogDetail {
    pub op: &'static str,
    pub file_id: String,
    pub source_edit_log_id: i64,
    pub count: usize,
    pub at_ms: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_summary: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub text_changes: Vec<TextChangeRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

fn read_edit_log_summary(conn: &Connection, edit_log_id: i64) -> Option<String> {
    let detail: String = conn
        .query_row(
            "SELECT detail FROM edit_log WHERE id = ?1",
            rusqlite::params![edit_log_id],
            |r| r.get(0),
        )
        .ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&detail).ok()?;
    parsed
        .get("summary")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn preview_snippet(text: &str) -> String {
    let t = text.replace(['\n', '\r'], " ");
    let chars: Vec<char> = t.chars().collect();
    if chars.len() <= SNIPPET_CHARS {
        return t;
    }
    let head: String = chars.into_iter().take(SNIPPET_CHARS).collect();
    format!("{head}…")
}

pub(crate) fn load_segment_text_by_uid(
    conn: &Connection,
    file_id: &str,
) -> Result<HashMap<String, (i32, String)>, String> {
    let mut out = HashMap::new();
    let mut stmt = conn
        .prepare("SELECT uid, idx, text FROM segments WHERE file_id = ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([file_id], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, i32>(1)?,
                r.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    for row in rows {
        let (uid, idx, text) = row.map_err(|e| e.to_string())?;
        out.insert(uid, (idx, text));
    }
    Ok(out)
}

fn collect_text_changes(
    old_by_uid: &HashMap<String, (i32, String)>,
    segments: &[SegmentDto],
) -> Vec<TextChangeRow> {
    let mut changes: Vec<TextChangeRow> = Vec::new();
    for s in segments {
        let uid = match s.uid.as_deref().filter(|u| !u.trim().is_empty()) {
            Some(u) => u.to_string(),
            None => continue,
        };
        let after = s.text.as_str();
        let (before, idx) = match old_by_uid.get(&uid) {
            Some((idx, text)) => (text.as_str(), *idx),
            None => ("", s.idx),
        };
        if before == after {
            continue;
        }
        changes.push(TextChangeRow {
            segment_idx: idx,
            uid,
            before: preview_snippet(before),
            after: preview_snippet(after),
        });
        if changes.len() >= MAX_CHANGES {
            break;
        }
    }
    changes.sort_by_key(|c| c.segment_idx);
    changes
}

fn build_summary(
    text_changes: &[TextChangeRow],
    correction_pairs: &[CorrectionPairRow],
) -> Option<String> {
    if let Some(p) = correction_pairs.first() {
        let mut s = format!("纠错记忆：「{}」→「{}」", p.before, p.after);
        if correction_pairs.len() > 1 {
            s.push_str(&format!(" 等 {} 条", correction_pairs.len()));
        }
        return Some(s);
    }
    let c = text_changes.first()?;
    let mut s = format!(
        "语段 {}：「{}」→「{}」",
        c.segment_idx + 1,
        c.before,
        c.after
    );
    if text_changes.len() > 1 {
        s.push_str(&format!(" 等 {} 处正文", text_changes.len()));
    }
    Some(s)
}

pub fn build_restore_from_edit_log_detail(
    conn: &Connection,
    file_id: &str,
    source_edit_log_id: i64,
    restored_segments: &[SegmentDto],
    at_ms: i64,
) -> Result<RestoreFromEditLogDetail, String> {
    let old_by_uid = load_segment_text_by_uid(conn, file_id)?;
    let text_changes = collect_text_changes(&old_by_uid, restored_segments);
    let source_summary = read_edit_log_summary(conn, source_edit_log_id);
    let summary = match build_summary(&text_changes, &[]) {
        Some(mut s) => {
            s.insert_str(0, "恢复：");
            Some(s)
        }
        None => source_summary
            .as_ref()
            .map(|src| format!("恢复到：{src}"))
            .or_else(|| Some(format!("恢复到历史记录 #{source_edit_log_id}"))),
    };
    Ok(RestoreFromEditLogDetail {
        op: "restore_from_edit_log",
        file_id: file_id.to_string(),
        source_edit_log_id,
        count: restored_segments.len(),
        at_ms,
        source_summary,
        text_changes,
        summary,
    })
}

pub fn build_save_segments_edit_detail_from_baseline(
    old_by_uid: &HashMap<String, (i32, String)>,
    file_id: &str,
    segments: &[SegmentDto],
    at_ms: i64,
    explicit_pairs: &[(String, String)],
) -> Result<SaveSegmentsEditDetail, String> {
    let text_changes = collect_text_changes(old_by_uid, segments);
    let correction_pairs: Vec<CorrectionPairRow> = explicit_pairs
        .iter()
        .map(|(before, after)| CorrectionPairRow {
            before: preview_snippet(before),
            after: preview_snippet(after),
        })
        .collect();
    let summary = build_summary(&text_changes, &correction_pairs);
    Ok(SaveSegmentsEditDetail {
        op: "save_segments",
        file_id: file_id.to_string(),
        count: segments.len(),
        at_ms,
        text_changes,
        correction_pairs,
        summary,
    })
}

#[cfg(test)]
pub fn build_save_segments_edit_detail(
    conn: &Connection,
    file_id: &str,
    segments: &[SegmentDto],
    at_ms: i64,
    explicit_pairs: &[(String, String)],
) -> Result<SaveSegmentsEditDetail, String> {
    let old_by_uid = load_segment_text_by_uid(conn, file_id)?;
    build_save_segments_edit_detail_from_baseline(
        &old_by_uid,
        file_id,
        segments,
        at_ms,
        explicit_pairs,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::DbState;
    use rusqlite::params;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};
    use uuid::Uuid;

    fn test_state() -> DbState {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("rushi_edit_log_{unique}"));
        fs::create_dir_all(&root).unwrap();
        let db_path = root.join("rushi.sqlite3");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        db::migrate(&conn).unwrap();
        drop(conn);
        DbState { root, db_path }
    }

    #[test]
    fn build_detail_includes_text_change() {
        let st = test_state();
        let conn = rusqlite::Connection::open(&st.db_path).unwrap();
        let file_id = Uuid::new_v4().to_string();
        let uid = Uuid::new_v4().to_string();
        let t = 1_i64;
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES ('p','P',1,1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
             VALUES (?1,'p','f','text',1,1)",
            params![&file_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO segments (file_id, uid, idx, start_sec, end_sec, text, low_confidence) \
             VALUES (?1, ?2, 0, 0, 1, '肩背胸襟向两臂', 0)",
            params![&file_id, &uid],
        )
        .unwrap();

        let segments = vec![SegmentDto {
            uid: Some(uid.clone()),
            idx: 0,
            start_sec: 0.0,
            end_sec: 1.0,
            text: "肩背胸膺向两臂".to_string(),
            confidence: None,
            low_confidence: false,
            detail: None,
            kind: None,
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
            annotation: None,
        }];
        let detail = build_save_segments_edit_detail(&conn, &file_id, &segments, t, &[]).unwrap();
        assert_eq!(detail.text_changes.len(), 1);
        assert!(detail.text_changes[0].before.contains("胸襟"));
        assert!(detail.text_changes[0].after.contains("胸膺"));
        assert!(detail.summary.as_ref().unwrap().contains("胸膺"));
    }

    #[test]
    fn build_restore_detail_lists_text_diff_against_current_db() {
        let st = test_state();
        let conn = rusqlite::Connection::open(&st.db_path).unwrap();
        let file_id = Uuid::new_v4().to_string();
        let uid = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES ('p','P',1,1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) \
             VALUES (?1,'p','f','text',1,1)",
            params![&file_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO segments (file_id, uid, idx, start_sec, end_sec, text, low_confidence) \
             VALUES (?1, ?2, 0, 0, 1, '胸膺', 0)",
            params![&file_id, &uid],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO edit_log (project_id, at_ms, kind, detail) VALUES ('p', 1, 'save_segments', ?1)",
            params![serde_json::json!({
                "summary": "语段 1：「胸襟」→「胸膺」",
            })
            .to_string()],
        )
        .unwrap();
        let source_id = conn.last_insert_rowid();

        let restored = vec![SegmentDto {
            uid: Some(uid.clone()),
            idx: 0,
            start_sec: 0.0,
            end_sec: 1.0,
            text: "胸襟".to_string(),
            confidence: None,
            low_confidence: false,
            detail: None,
            kind: None,
            text_stage: "auto_transcribe".to_string(),
            finalize_via: None,
            annotation: None,
        }];
        let detail =
            build_restore_from_edit_log_detail(&conn, &file_id, source_id, &restored, 2).unwrap();
        assert_eq!(detail.text_changes.len(), 1);
        assert_eq!(detail.text_changes[0].before, "胸膺");
        assert_eq!(detail.text_changes[0].after, "胸襟");
        assert!(detail.summary.as_ref().unwrap().starts_with("恢复："));
        assert!(detail.source_summary.as_ref().unwrap().contains("胸膺"));
    }
}

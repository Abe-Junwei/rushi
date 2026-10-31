//! Audit regressions for empty-save wipe + poll-fail in-flight release.
use super::save_transcribe_segments;
use crate::asr_sidecar::warm;
use crate::project::transcribe_timeline::{
    fail_and_persist_active_timeline, store_active_timeline, TranscribeTimelineRecorder,
};
use crate::project::utils::{file_detail_from_conn, open_db};
use crate::DbState;
use std::fs;

fn state_with_file() -> DbState {
    let root = std::env::temp_dir().join(format!("rushi-audit-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    let st = DbState::open_test_db(root);
    let conn = open_db(&st).unwrap();
    conn.execute(
        "INSERT INTO projects (id, name, created_at_ms, updated_at_ms) VALUES ('audit-project', 'Audit', 0, 0)",
        [],
    ).unwrap();
    conn.execute(
        "INSERT INTO files (id, project_id, name, file_type, created_at_ms, updated_at_ms) VALUES ('audit-file', 'audit-project', 'audit.wav', 'paired', 0, 0)",
        [],
    ).unwrap();
    st
}

#[tokio::test]
async fn audit_empty_transcribe_preserves_previous_segments() {
    let st = state_with_file();
    let mut warnings = vec![];
    let old = serde_json::json!({"start_sec": 0.0, "end_sec": 1.0, "text": "保留旧正文"});
    save_transcribe_segments(
        &st,
        "audit-file",
        &[old],
        None,
        &mut warnings,
        Some(10.0),
        None,
    )
    .await
    .unwrap();
    let before = file_detail_from_conn(&open_db(&st).unwrap(), "audit-file").unwrap();
    assert_eq!(before.segments.len(), 1);
    let result = save_transcribe_segments(
        &st,
        "audit-file",
        &[],
        None,
        &mut warnings,
        Some(10.0),
        None,
    )
    .await;
    let after = file_detail_from_conn(&open_db(&st).unwrap(), "audit-file").unwrap();
    let root = st.root.clone();
    drop(st);
    fs::remove_dir_all(root).unwrap();
    assert_eq!(
        after.segments.len(),
        before.segments.len(),
        "AUD-01: empty result erased prior segments; save={result:?}"
    );
    assert!(
        result.is_err(),
        "empty transcription must not be committed as success"
    );
}

#[test]
fn audit_poll_failure_releases_in_flight() {
    assert!(
        !warm::transcribe_in_flight(),
        "run audit repros serially in a fresh test process"
    );
    let st = state_with_file();
    warm::inc_transcribe_in_flight();
    store_active_timeline(
        "audit-job",
        TranscribeTimelineRecorder::new("audit-file", "local"),
    );
    let result = fail_and_persist_active_timeline(&st, "audit-job", "status HTTP 503");
    let still_in_flight = warm::transcribe_in_flight();
    if still_in_flight {
        warm::dec_transcribe_in_flight();
    }
    let root = st.root.clone();
    drop(st);
    fs::remove_dir_all(root).unwrap();
    result.unwrap();
    assert!(
        !still_in_flight,
        "AUD-02: failed job still prevents idle recycle"
    );
}

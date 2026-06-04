use super::correction_learn::is_correction_memory_stable;
use super::correction_types::{CorrectionMemoryEntryRow, CorrectionRuleRow, CORRECTION_MEMORY_STABLE_HIT};
use crate::project::utils::now_ms;
use rusqlite::{params, Connection};

const CORRECTION_MEMORY_LIST_LIMIT: usize = 200;

pub fn delete_correction_memory_entry(
    conn: &Connection,
    wrong: &str,
    right: &str,
) -> Result<(), String> {
    let wrong = wrong.trim();
    let right = right.trim();
    if wrong.is_empty() || right.is_empty() {
        return Err("请选择要删除的纠错记忆。".to_string());
    }
    let n = conn
        .execute(
            "DELETE FROM correction_memory WHERE before_text = ?1 AND after_text = ?2",
            params![wrong, right],
        )
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("未找到该条纠错记忆。".to_string());
    }
    Ok(())
}

/// Manual create/update from 热词与记忆 UI. Renaming wrong/right deletes the old key first.
pub fn save_correction_memory_entry(
    conn: &Connection,
    wrong: &str,
    right: &str,
    accepted_as_rule: bool,
    replace_wrong: Option<&str>,
    replace_right: Option<&str>,
) -> Result<(), String> {
    let wrong = wrong.trim();
    let right = right.trim();
    if wrong.is_empty() || right.is_empty() || wrong == right {
        return Err("错词与正词均不能为空，且不能相同。".to_string());
    }
    if let (Some(ow), Some(or)) = (replace_wrong, replace_right) {
        let ow = ow.trim();
        let or = or.trim();
        if !ow.is_empty() && !or.is_empty() && (ow != wrong || or != right) {
            let _ = conn.execute(
                "DELETE FROM correction_memory WHERE before_text = ?1 AND after_text = ?2",
                params![ow, or],
            );
        }
    }
    let at_ms = now_ms();
    super::correction_learn::upsert_correction_memory(&conn, wrong, right, at_ms)?;
    if accepted_as_rule {
        super::correction_learn::accept_correction_rule(&conn, wrong, right, at_ms)?;
    }
    Ok(())
}

pub fn list_correction_memory_entries(
    conn: &Connection,
) -> Result<Vec<CorrectionMemoryEntryRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT before_text, after_text, hit_count, accepted_as_rule, updated_at_ms \
             FROM correction_memory \
             ORDER BY updated_at_ms DESC \
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![CORRECTION_MEMORY_LIST_LIMIT as i64], |r| {
            let wrong: String = r.get(0)?;
            let right: String = r.get(1)?;
            let hit_count: i32 = r.get(2)?;
            let accepted_as_rule: i32 = r.get(3)?;
            let updated_at_ms: i64 = r.get(4)?;
            let accepted = accepted_as_rule != 0;
            Ok(CorrectionMemoryEntryRow {
                wrong,
                right,
                hit_count,
                accepted_as_rule: accepted,
                updated_at_ms,
                is_stable: is_correction_memory_stable(hit_count, accepted),
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        let row = row.map_err(|e| e.to_string())?;
        let wrong = row.wrong.trim().to_string();
        let right = row.right.trim().to_string();
        if wrong.is_empty() || right.is_empty() || wrong == right {
            continue;
        }
        out.push(CorrectionMemoryEntryRow {
            wrong,
            right,
            hit_count: row.hit_count,
            accepted_as_rule: row.accepted_as_rule,
            updated_at_ms: row.updated_at_ms,
            is_stable: row.is_stable,
        });
    }
    Ok(out)
}

pub fn list_stable_correction_rules(conn: &Connection) -> Result<Vec<CorrectionRuleRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT before_text, after_text, hit_count, accepted_as_rule FROM correction_memory \
             WHERE accepted_as_rule = 1 OR hit_count >= ?1 \
             ORDER BY length(before_text) DESC, accepted_as_rule DESC, hit_count DESC, updated_at_ms DESC \
             LIMIT 80",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![CORRECTION_MEMORY_STABLE_HIT], |r| {
            Ok(CorrectionRuleRow {
                wrong: r.get(0)?,
                right: r.get(1)?,
                hit_count: r.get(2)?,
                accepted_as_rule: r.get::<_, i32>(3)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        let row = row.map_err(|e| e.to_string())?;
        let wrong = row.wrong.trim().to_string();
        let right = row.right.trim().to_string();
        if wrong.is_empty() || right.is_empty() || wrong == right {
            continue;
        }
        out.push(CorrectionRuleRow {
            wrong,
            right,
            hit_count: row.hit_count,
            accepted_as_rule: row.accepted_as_rule,
        });
    }
    Ok(out)
}

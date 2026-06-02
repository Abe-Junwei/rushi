//! R3t-E: assemble LexiconPack from glossary_terms + correction_memory.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

pub const GLOSSARY_CANONICAL_LIMIT: usize = 200;
pub const CORRECTION_RULES_LIMIT: usize = 40;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionRule {
    pub wrong: String,
    pub right: String,
    pub source: String,
    pub weight: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LexiconPackMeta {
    pub glossary_count: usize,
    pub rules_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub truncated: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LexiconPack {
    pub glossary_canonical: Vec<String>,
    pub correction_rules: Vec<CorrectionRule>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pack_meta: Option<LexiconPackMeta>,
}

pub fn assemble_lexicon_pack(conn: &Connection) -> Result<LexiconPack, String> {
    let mut glossary_canonical = Vec::new();
    let glossary_total: usize = {
        let mut stmt = conn
            .prepare("SELECT COUNT(*) FROM glossary_terms WHERE trim(term) != ''")
            .map_err(|e| e.to_string())?;
        stmt.query_row([], |r| r.get::<_, i64>(0))
            .map_err(|e| e.to_string())? as usize
    };
    {
        let mut stmt = conn
            .prepare(&format!(
                "SELECT term FROM glossary_terms WHERE trim(term) != '' ORDER BY term ASC LIMIT {}",
                GLOSSARY_CANONICAL_LIMIT
            ))
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        for row in rows {
            let term = row.map_err(|e| e.to_string())?.trim().to_string();
            if !term.is_empty() {
                glossary_canonical.push(term);
            }
        }
    }

    let mut correction_rules = Vec::new();
    {
        let mut stmt = conn
            .prepare(
                "SELECT before_text, after_text, accepted_as_rule FROM correction_memory \
                 WHERE accepted_as_rule = 1 OR hit_count >= 2 \
                 ORDER BY accepted_as_rule DESC, hit_count DESC, updated_at_ms DESC \
                 LIMIT ?1",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![CORRECTION_RULES_LIMIT as i64], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i32>(2)? != 0,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (wrong, right, accepted) = row.map_err(|e| e.to_string())?;
            let wrong = wrong.trim().to_string();
            let right = right.trim().to_string();
            if wrong.is_empty() || right.is_empty() || wrong == right {
                continue;
            }
            correction_rules.push(CorrectionRule {
                wrong,
                right,
                source: "memory".to_string(),
                weight: if accepted {
                    "high".to_string()
                } else {
                    "medium".to_string()
                },
            });
        }
    }

    let glossary_truncated = glossary_total > glossary_canonical.len();
    let pack_meta = LexiconPackMeta {
        glossary_count: glossary_canonical.len(),
        rules_count: correction_rules.len(),
        truncated: if glossary_truncated { Some(true) } else { None },
    };

    Ok(LexiconPack {
        glossary_canonical,
        correction_rules,
        pack_meta: Some(pack_meta),
    })
}

pub fn lexicon_pack_is_usable(pack: &LexiconPack) -> bool {
    !pack.glossary_canonical.is_empty() || !pack.correction_rules.is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn mem_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        db::migrate(&conn).expect("migrate");
        conn
    }

    #[test]
    fn assembles_glossary_and_rules_with_truncation_meta() {
        let conn = mem_db();
        for i in 0..3 {
            conn.execute(
                "INSERT INTO glossary_terms (term, created_at_ms, updated_at_ms) VALUES (?1, 1, 1)",
                params![format!("术语{i}")],
            )
            .unwrap();
        }
        conn.execute(
            "INSERT INTO correction_memory (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms) \
             VALUES ('错', '对', 2, 0, 1, 1)",
            [],
        )
        .unwrap();
        let pack = assemble_lexicon_pack(&conn).unwrap();
        assert_eq!(pack.glossary_canonical.len(), 3);
        assert_eq!(pack.correction_rules.len(), 1);
        assert_eq!(pack.correction_rules[0].weight, "medium");
    }

    #[test]
    fn accepted_rule_is_high_weight() {
        let conn = mem_db();
        conn.execute(
            "INSERT INTO correction_memory (before_text, after_text, hit_count, accepted_as_rule, created_at_ms, updated_at_ms) \
             VALUES ('a', 'b', 1, 1, 1, 1)",
            [],
        )
        .unwrap();
        let pack = assemble_lexicon_pack(&conn).unwrap();
        assert_eq!(pack.correction_rules[0].weight, "high");
    }
}

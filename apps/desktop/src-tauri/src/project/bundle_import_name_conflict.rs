//! Content-package import: preview global `files.name` conflicts and plan resolutions.
//! Apply (delete + import) lives in `export_cmd` to avoid module cycles.

use crate::command_error::{CommandError, CommandResult};
use crate::DbState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::path::Path;
use zip::ZipArchive;

use super::file_name_unique::{split_file_stem_ext, unique_file_name};
use super::library_bundle_cmd::LIBRARY_BUNDLE_KIND;
use super::project_bundle_cmd::{
    peek_exchange_bundle_kind, read_zip_bytes, read_zip_json, ProjectBundleDocument,
    ProjectBundleManifest, PROJECT_BUNDLE_KIND, PROJECT_BUNDLE_VERSION, PROJECT_BUNDLE_VERSION_V1,
};
use super::utils::open_db;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleFileNameConflict {
    pub id: String,
    pub incoming_name: String,
    pub suggested_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub existing_file_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub existing_project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub existing_project_name: Option<String>,
    pub source_project_label: String,
    /// Nested project `original_id` for library; project `original_id` for single.
    pub source_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleFileNameResolution {
    pub id: String,
    /// `overwrite` | `rename`
    pub action: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rename_to: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeBundleImportPreview {
    pub zip_path: String,
    pub kind: String,
    pub conflicts: Vec<BundleFileNameConflict>,
}

#[derive(Debug, Clone)]
struct IncomingRef {
    id: String,
    incoming_name: String,
    source_project_label: String,
    source_key: String,
}

fn lookup_existing_by_name(
    conn: &rusqlite::Connection,
    name: &str,
) -> Result<Option<(String, String, String)>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT f.id, f.project_id, p.name FROM files f \
             JOIN projects p ON p.id = f.project_id WHERE f.name = ?1 LIMIT 1",
        )
        .map_err(|e| e.to_string())?;
    match stmt.query_row(params![name], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
        ))
    }) {
        Ok(row) => Ok(Some(row)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn list_names_from_project_zip(zip_path: &Path) -> CommandResult<(String, String, Vec<String>)> {
    let file = File::open(zip_path).map_err(CommandError::BundleOpen)?;
    let mut archive = ZipArchive::new(file).map_err(CommandError::BundleRead)?;
    let manifest: ProjectBundleManifest = read_zip_json(&mut archive, "manifest.json")?;
    if manifest.kind != PROJECT_BUNDLE_KIND {
        return Err(CommandError::BundleUnsupportedKind);
    }
    let label = if manifest.project.name.trim().is_empty() {
        manifest.project.original_id.clone()
    } else {
        manifest.project.name.clone()
    };
    let source_key = manifest.project.original_id.clone();
    let names = match manifest.version {
        PROJECT_BUNDLE_VERSION_V1 => {
            let doc: ProjectBundleDocument = read_zip_json(&mut archive, "project.json")?;
            let name = if doc.name.trim().is_empty() {
                label.clone()
            } else {
                doc.name.trim().to_string()
            };
            vec![name]
        }
        PROJECT_BUNDLE_VERSION => {
            if manifest.files.is_empty() {
                return Err(CommandError::BundleNoExportableAudio);
            }
            manifest.files.iter().map(|f| f.name.clone()).collect()
        }
        found => {
            return Err(CommandError::BundleUnsupportedVersion {
                found,
                supported: PROJECT_BUNDLE_VERSION,
            })
        }
    };
    Ok((source_key, label, names))
}

#[derive(Debug, Deserialize)]
struct LibraryManifestPeek {
    kind: String,
    version: u32,
    projects: Vec<LibraryProjectPeek>,
}

#[derive(Debug, Deserialize)]
struct LibraryProjectPeek {
    original_id: String,
    name: String,
    entry: String,
}

fn collect_library_incomings(zip_path: &Path) -> CommandResult<Vec<IncomingRef>> {
    let file = File::open(zip_path).map_err(CommandError::BundleOpen)?;
    let mut archive = ZipArchive::new(file).map_err(CommandError::BundleRead)?;
    let manifest: LibraryManifestPeek = read_zip_json(&mut archive, "manifest.json")?;
    if manifest.kind != LIBRARY_BUNDLE_KIND {
        return Err(CommandError::BundleUnsupportedKind);
    }
    if manifest.version != 1 {
        return Err(CommandError::BundleUnsupportedVersion {
            found: manifest.version,
            supported: 1,
        });
    }

    let staging = zip_path.with_extension("name-conflict-staging");
    let _ = fs::remove_dir_all(&staging);
    fs::create_dir_all(&staging).map_err(CommandError::BundleCreateProjectDir)?;

    let mut out = Vec::new();
    let mut idx = 0usize;
    for entry in &manifest.projects {
        let label = if entry.name.trim().is_empty() {
            entry.original_id.clone()
        } else {
            entry.name.clone()
        };
        if entry.entry.contains("..") || !entry.entry.starts_with("projects/") {
            continue;
        }
        let bytes = match read_zip_bytes(&mut archive, &entry.entry) {
            Ok(b) => b,
            Err(_) => continue,
        };
        let nested_path = staging.join(format!("{}.zip", entry.original_id));
        if fs::write(&nested_path, &bytes).is_err() {
            continue;
        }
        let (_sk, _lbl, names) = list_names_from_project_zip(&nested_path)?;
        for name in names {
            out.push(IncomingRef {
                id: format!("c{idx}"),
                incoming_name: name,
                source_project_label: label.clone(),
                source_key: entry.original_id.clone(),
            });
            idx += 1;
        }
    }
    let _ = fs::remove_dir_all(&staging);
    Ok(out)
}

fn collect_project_incomings(zip_path: &Path) -> CommandResult<Vec<IncomingRef>> {
    let (source_key, label, names) = list_names_from_project_zip(zip_path)?;
    Ok(names
        .into_iter()
        .enumerate()
        .map(|(idx, name)| IncomingRef {
            id: format!("c{idx}"),
            incoming_name: name,
            source_project_label: label.clone(),
            source_key: source_key.clone(),
        })
        .collect())
}

fn suggest_names_for_conflicts(
    conn: &rusqlite::Connection,
    conflict_names: &[(String, String)],
) -> Result<HashMap<String, String>, String> {
    let mut reserved: HashSet<String> = HashSet::new();
    let mut out = HashMap::new();
    for (id, incoming) in conflict_names {
        let mut candidate = unique_file_name(conn, incoming, None)?;
        let mut guard = 0u32;
        while reserved.contains(&candidate) {
            let (stem, ext) = split_file_stem_ext(&candidate);
            guard = guard.saturating_add(1);
            candidate = format!("{stem} ({}){ext}", 2 + guard);
            if guard > 10_000 {
                return Err("无法生成不冲突的文件名。".into());
            }
        }
        reserved.insert(candidate.clone());
        out.insert(id.clone(), candidate);
    }
    Ok(out)
}

pub(super) fn preview_exchange_bundle_at(
    st: &DbState,
    zip_path: &Path,
) -> CommandResult<ExchangeBundleImportPreview> {
    let kind = peek_exchange_bundle_kind(zip_path)?;
    let incomings = match kind.as_str() {
        k if k == PROJECT_BUNDLE_KIND => collect_project_incomings(zip_path)?,
        k if k == LIBRARY_BUNDLE_KIND => collect_library_incomings(zip_path)?,
        _ => return Err(CommandError::BundleUnsupportedKind),
    };

    let conn = open_db(st).map_err(CommandError::db_pool)?;
    let mut name_counts: HashMap<String, usize> = HashMap::new();
    for item in &incomings {
        *name_counts.entry(item.incoming_name.clone()).or_insert(0) += 1;
    }

    let mut conflict_refs = Vec::new();
    for item in &incomings {
        let batch_dup = name_counts.get(&item.incoming_name).copied().unwrap_or(0) > 1;
        let existing = lookup_existing_by_name(&conn, &item.incoming_name)
            .map_err(|detail| CommandError::ImportProjectBundle { detail })?;
        if existing.is_some() || batch_dup {
            conflict_refs.push(item.clone());
        }
    }

    let suggestions = suggest_names_for_conflicts(
        &conn,
        &conflict_refs
            .iter()
            .map(|c| (c.id.clone(), c.incoming_name.clone()))
            .collect::<Vec<_>>(),
    )
    .map_err(|detail| CommandError::ImportProjectBundle { detail })?;

    let mut conflicts = Vec::new();
    for item in conflict_refs {
        let existing = lookup_existing_by_name(&conn, &item.incoming_name)
            .map_err(|detail| CommandError::ImportProjectBundle { detail })?;
        let suggested = suggestions
            .get(&item.id)
            .cloned()
            .unwrap_or_else(|| item.incoming_name.clone());
        conflicts.push(BundleFileNameConflict {
            id: item.id,
            incoming_name: item.incoming_name,
            suggested_name: suggested,
            existing_file_id: existing.as_ref().map(|e| e.0.clone()),
            existing_project_id: existing.as_ref().map(|e| e.1.clone()),
            existing_project_name: existing.as_ref().map(|e| e.2.clone()),
            source_project_label: item.source_project_label,
            source_key: item.source_key,
        });
    }

    Ok(ExchangeBundleImportPreview {
        zip_path: zip_path.to_string_lossy().to_string(),
        kind,
        conflicts,
    })
}

/// `(source_key, incoming_name) -> final_name` rename map, plus file ids to overwrite.
pub(super) type BundleRenamePlan = (HashMap<(String, String), String>, Vec<String>);

/// Build rename map `(source_key, incoming_name) -> final_name` and overwrite file ids.
pub(super) fn plan_from_resolutions(
    preview: &ExchangeBundleImportPreview,
    resolutions: &[BundleFileNameResolution],
) -> CommandResult<BundleRenamePlan> {
    if preview.conflicts.is_empty() {
        return Ok((HashMap::new(), Vec::new()));
    }
    let mut res_map: HashMap<&str, &BundleFileNameResolution> = HashMap::new();
    for r in resolutions {
        res_map.insert(r.id.as_str(), r);
    }
    for c in &preview.conflicts {
        if !res_map.contains_key(c.id.as_str()) {
            return Err(CommandError::ImportProjectBundle {
                detail: format!(
                    "尚有文件名冲突未选择处理方式（共 {} 项），请先完成确认。",
                    preview.conflicts.len()
                ),
            });
        }
    }

    let mut rename_map = HashMap::new();
    let mut overwrite_ids = Vec::new();
    let mut finals: HashSet<String> = HashSet::new();

    for c in &preview.conflicts {
        let r = res_map[c.id.as_str()];
        match r.action.as_str() {
            "overwrite" => {
                let Some(fid) = c.existing_file_id.as_ref() else {
                    return Err(CommandError::ImportProjectBundle {
                        detail: format!(
                            "「{}」无库内占用文件，不能覆盖，请选择重命名。",
                            c.incoming_name
                        ),
                    });
                };
                overwrite_ids.push(fid.clone());
                if !finals.insert(c.incoming_name.clone()) {
                    return Err(CommandError::ImportProjectBundle {
                        detail: format!(
                            "多个冲突项覆盖后仍使用同名「{}」，请改为重命名。",
                            c.incoming_name
                        ),
                    });
                }
                rename_map.insert(
                    (c.source_key.clone(), c.incoming_name.clone()),
                    c.incoming_name.clone(),
                );
            }
            "rename" => {
                let name = r
                    .rename_to
                    .as_deref()
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .unwrap_or(c.suggested_name.as_str())
                    .to_string();
                if name.is_empty() {
                    return Err(CommandError::ImportProjectBundle {
                        detail: "重命名不能为空。".into(),
                    });
                }
                if !finals.insert(name.clone()) {
                    return Err(CommandError::ImportProjectBundle {
                        detail: format!("重命名目标「{name}」重复，请为每项选择不同名称。"),
                    });
                }
                rename_map.insert((c.source_key.clone(), c.incoming_name.clone()), name);
            }
            other => {
                return Err(CommandError::ImportProjectBundle {
                    detail: format!("未知的冲突处理方式：{other}"),
                });
            }
        }
    }

    overwrite_ids.sort();
    overwrite_ids.dedup();
    Ok((rename_map, overwrite_ids))
}

pub(super) fn lookup_existing_name_public(
    conn: &rusqlite::Connection,
    name: &str,
) -> Result<Option<(String, String, String)>, String> {
    lookup_existing_by_name(conn, name)
}

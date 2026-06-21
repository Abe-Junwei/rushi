//! Seed marker read/write for bundled ASR models.

use std::fs;
use std::path::Path;

use serde::Deserialize;
use serde_json::json;

use super::{BundledAsrModelsSeedResult, OfflineAsrModelsPackManifest, ResolvedPackModelSpec};

pub(crate) const SEED_MARKER_FILE: &str = ".rushi-bundled-seed.json";

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct SeedMarker {
    pub pack_version: u32,
    pub bundle_id: String,
    #[serde(default)]
    pub rushi_version: Option<String>,
    pub seeded_at: String,
}

pub fn read_seed_marker(models_root: &Path) -> Result<Option<SeedMarker>, String> {
    let path = models_root.join(SEED_MARKER_FILE);
    if !path.is_file() {
        return Ok(None);
    }
    let body = fs::read_to_string(&path).map_err(|e| format!("读取 seed marker 失败: {e}"))?;
    serde_json::from_str(&body)
        .map(Some)
        .map_err(|e| format!("seed marker 格式无效: {e}"))
}

pub fn write_seed_marker(
    models_root: &Path,
    manifest: &OfflineAsrModelsPackManifest,
) -> Result<(), String> {
    let marker = models_root.join(SEED_MARKER_FILE);
    let body = json!({
        "pack_version": manifest.pack_version,
        "bundle_id": manifest.bundle_id,
        "rushi_version": manifest.rushi_version,
        "seeded_at": chrono::Local::now().to_rfc3339(),
    });
    let serialized = serde_json::to_string_pretty(&body).map_err(|e| e.to_string())?;
    let tmp = marker.with_extension("json.tmp");
    fs::write(&tmp, serialized).map_err(|e| format!("写入 seed marker 失败: {e}"))?;
    fs::rename(&tmp, &marker).map_err(|e| format!("写入 seed marker 失败: {e}"))?;
    Ok(())
}

pub fn try_skip_reseed(
    models_root: &Path,
    modelscope_cache: &Path,
    manifest: &OfflineAsrModelsPackManifest,
    specs: &[ResolvedPackModelSpec],
) -> Result<Option<BundledAsrModelsSeedResult>, String> {
    let Some(marker) = read_seed_marker(models_root)? else {
        return Ok(None);
    };
    if marker.pack_version != manifest.pack_version || marker.bundle_id != manifest.bundle_id {
        return Ok(None);
    }
    super::manifest::validate_manifest_models_cached(modelscope_cache, specs)?;
    Ok(Some(BundledAsrModelsSeedResult {
        status: "skipped_reseed".to_string(),
        imported_bytes: 0,
        models_root: models_root.to_string_lossy().to_string(),
        modelscope_cache: modelscope_cache.to_string_lossy().to_string(),
        pack_version: manifest.pack_version,
        bundle_id: manifest.bundle_id.clone(),
        seeded_at: marker.seeded_at,
        skipped_reseed: true,
    }))
}

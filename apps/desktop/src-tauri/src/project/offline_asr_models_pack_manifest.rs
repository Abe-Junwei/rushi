//! Shared offline ASR models pack manifest (Route E) — template is build + import truth.

use serde::{Deserialize, Serialize};

use crate::local_asr_model::{
    DEFAULT_FUNASR_HUB_MODEL_ID, DEFAULT_FUNASR_PUNC_MODEL_ID, DEFAULT_FUNASR_VAD_MODEL_ID,
};

const MANIFEST_TEMPLATE: &str =
    include_str!("../../../../../resources/offline-asr-models-pack-manifest.template.json");

pub const OFFLINE_ASR_MODELS_PACK_VERSION: u32 = 1;
pub const DEFAULT_OFFLINE_ASR_BUNDLE_ID: &str = "default-paraformer-v1";

const RECOGNIZER_MIN_WEIGHT_BYTES: u64 = 100 * 1024 * 1024;
const AUX_MIN_WEIGHT_BYTES: u64 = 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OfflineAsrModelsPackManifest {
    pub pack_version: u32,
    pub bundle_id: String,
    pub models: Vec<OfflineAsrModelsPackModelSpec>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rushi_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OfflineAsrModelsPackModelSpec {
    pub hub_id: String,
    #[serde(default)]
    pub required_files: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_weight_bytes: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedPackModelSpec {
    pub hub_id: String,
    pub required_files: Vec<String>,
    pub min_weight_bytes: u64,
    pub weight_file: String,
}

pub fn embedded_offline_asr_models_pack_manifest(
    rushi_version: Option<&str>,
) -> OfflineAsrModelsPackManifest {
    let mut manifest: OfflineAsrModelsPackManifest =
        serde_json::from_str(MANIFEST_TEMPLATE).expect("offline pack manifest template must parse");
    if let Some(version) = rushi_version {
        manifest.rushi_version = Some(version.to_string());
    }
    manifest
}

#[allow(dead_code)]
pub fn default_offline_asr_models_pack_manifest(rushi_version: &str) -> OfflineAsrModelsPackManifest {
    embedded_offline_asr_models_pack_manifest(Some(rushi_version))
}

pub fn resolve_model_specs(manifest: &OfflineAsrModelsPackManifest) -> Result<Vec<ResolvedPackModelSpec>, String> {
    if manifest.pack_version != OFFLINE_ASR_MODELS_PACK_VERSION {
        return Err(format!(
            "不支持的离线包版本 {}（期望 {}）。",
            manifest.pack_version, OFFLINE_ASR_MODELS_PACK_VERSION
        ));
    }
    if manifest.bundle_id.trim().is_empty() {
        return Err("离线包 manifest 缺少 bundle_id。".to_string());
    }
    if manifest.bundle_id != DEFAULT_OFFLINE_ASR_BUNDLE_ID {
        return Err(format!(
            "不支持的离线包 bundle_id「{}」（期望 {}）。",
            manifest.bundle_id, DEFAULT_OFFLINE_ASR_BUNDLE_ID
        ));
    }
    if manifest.models.is_empty() {
        return Err("离线包 manifest 未列出任何模型。".to_string());
    }
    manifest
        .models
        .iter()
        .map(|entry| {
            let hub_id = entry.hub_id.trim();
            if hub_id.is_empty() {
                return Err("离线包 manifest 含空 hub_id。".to_string());
            }
            let required_files = if entry.required_files.is_empty() {
                default_required_files(hub_id)
            } else {
                entry.required_files.clone()
            };
            if required_files.is_empty() {
                return Err(format!("离线包 manifest 无法推断 {hub_id} 的 required_files。"));
            }
            let min_weight_bytes = entry
                .min_weight_bytes
                .unwrap_or_else(|| default_min_weight_bytes(hub_id));
            let weight_file = required_files
                .iter()
                .find(|name| name.ends_with(".pt") || name.ends_with(".onnx"))
                .cloned()
                .unwrap_or_else(|| "model.pt".to_string());
            Ok(ResolvedPackModelSpec {
                hub_id: hub_id.to_string(),
                required_files,
                min_weight_bytes,
                weight_file,
            })
        })
        .collect()
}

fn default_required_files(hub_id: &str) -> Vec<String> {
    if hub_id == DEFAULT_FUNASR_VAD_MODEL_ID {
        return vec!["model.pt".to_string()];
    }
    if hub_id == DEFAULT_FUNASR_PUNC_MODEL_ID {
        return vec!["model.pt".to_string(), "config.yaml".to_string()];
    }
    vec![
        "model.pt".to_string(),
        "config.yaml".to_string(),
        "tokens.json".to_string(),
    ]
}

fn default_min_weight_bytes(hub_id: &str) -> u64 {
    if hub_id == DEFAULT_FUNASR_HUB_MODEL_ID {
        RECOGNIZER_MIN_WEIGHT_BYTES
    } else {
        AUX_MIN_WEIGHT_BYTES
    }
}

//! Shared bundled ASR models manifest (Plan B) — template is build + seed truth.

use std::path::{Component, Path};

use serde::{Deserialize, Serialize};

use crate::local_asr_model::{
    DEFAULT_FUNASR_HUB_MODEL_ID, DEFAULT_FUNASR_PUNC_MODEL_ID, DEFAULT_FUNASR_VAD_MODEL_ID,
};

pub const BUNDLED_ASR_MODELS_PACK_VERSION: u32 = 1;
pub const DEFAULT_BUNDLED_ASR_BUNDLE_ID: &str = "default-paraformer-v1";

const RECOGNIZER_MIN_WEIGHT_BYTES: u64 = 100 * 1024 * 1024;
const AUX_MIN_WEIGHT_BYTES: u64 = 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BundledAsrModelsManifest {
    pub pack_version: u32,
    pub bundle_id: String,
    pub models: Vec<BundledAsrModelSpec>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rushi_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BundledAsrModelSpec {
    pub hub_id: String,
    #[serde(default)]
    pub required_files: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_weight_bytes: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedBundledAsrModelSpec {
    pub hub_id: String,
    pub required_files: Vec<String>,
    pub min_weight_bytes: u64,
    pub weight_file: String,
}


/// Reject manifest-relative paths that could escape a model directory (`../`, absolute, etc.).
pub fn sanitize_manifest_rel_path(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("内置语音模型包 manifest 含空文件路径。".to_string());
    }
    for component in Path::new(trimmed).components() {
        match component {
            Component::Normal(_) | Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(format!("内置语音模型包 manifest 含非法路径: {trimmed}"));
            }
        }
    }
    Ok(trimmed.to_string())
}

pub fn resolve_model_specs(
    manifest: &BundledAsrModelsManifest,
) -> Result<Vec<ResolvedBundledAsrModelSpec>, String> {
    if manifest.pack_version != BUNDLED_ASR_MODELS_PACK_VERSION {
        return Err(format!(
            "不支持的模型包版本 {}（期望 {}）。",
            manifest.pack_version, BUNDLED_ASR_MODELS_PACK_VERSION
        ));
    }
    if manifest.bundle_id.trim().is_empty() {
        return Err("内置语音模型包 manifest 缺少 bundle_id。".to_string());
    }
    if manifest.bundle_id != DEFAULT_BUNDLED_ASR_BUNDLE_ID {
        return Err(format!(
            "不支持的模型包 bundle_id「{}」（期望 {}）。",
            manifest.bundle_id, DEFAULT_BUNDLED_ASR_BUNDLE_ID
        ));
    }
    if manifest.models.is_empty() {
        return Err("内置语音模型包 manifest 未列出任何模型。".to_string());
    }
    manifest
        .models
        .iter()
        .map(|entry| {
            let hub_id = entry.hub_id.trim();
            if hub_id.is_empty() {
                return Err("内置语音模型包 manifest 含空 hub_id。".to_string());
            }
            let required_files = if entry.required_files.is_empty() {
                default_required_files(hub_id)
            } else {
                entry
                    .required_files
                    .iter()
                    .map(|rel| sanitize_manifest_rel_path(rel))
                    .collect::<Result<Vec<_>, _>>()?
            };
            if required_files.is_empty() {
                return Err(format!(
                    "内置语音模型包 manifest 无法推断 {hub_id} 的 required_files。"
                ));
            }
            let min_weight_bytes = entry
                .min_weight_bytes
                .unwrap_or_else(|| default_min_weight_bytes(hub_id));
            let weight_file = required_files
                .iter()
                .find(|name| name.ends_with(".pt") || name.ends_with(".onnx"))
                .cloned()
                .unwrap_or_else(|| "model.pt".to_string());
            sanitize_manifest_rel_path(&weight_file)?;
            Ok(ResolvedBundledAsrModelSpec {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_manifest_rel_path_rejects_traversal() {
        assert!(sanitize_manifest_rel_path("../model.pt").is_err());
        assert!(sanitize_manifest_rel_path("").is_err());
        assert_eq!(sanitize_manifest_rel_path("model.pt").unwrap(), "model.pt");
    }
}

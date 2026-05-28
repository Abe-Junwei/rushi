use super::config::{configured_manifest_source, validate_manifest_source_policy};
use super::issues::manifest_blocking_issue;
use super::signature::verify_manifest_signature;
use super::types::ManifestProbe;
use crate::local_runtime::install_support::read_text_source;
use crate::local_runtime::manifest::{
    current_platform_key, is_shell_version_compatible, parse_signed_manifest,
    select_asr_sidecar_component,
};

pub fn diagnose_configured_manifest() -> ManifestProbe {
    let Some(source) = configured_manifest_source() else {
        return ManifestProbe {
            source: None,
            status: "missing".into(),
            available_version: None,
            available_size_bytes: None,
            blocking_issue: manifest_blocking_issue("local_runtime_manifest_missing"),
            signature_key_id: None,
        };
    };
    if let Err(err) = validate_manifest_source_policy(&source) {
        return ManifestProbe {
            source: Some(source),
            status: "source_rejected".into(),
            available_version: None,
            available_size_bytes: None,
            blocking_issue: manifest_blocking_issue(&err),
            signature_key_id: None,
        };
    }
    let body = match read_text_source(&source) {
        Ok(body) => body,
        Err(err) => {
            return ManifestProbe {
                source: Some(source),
                status: "error".into(),
                available_version: None,
                available_size_bytes: None,
                blocking_issue: manifest_blocking_issue(&err),
                signature_key_id: None,
            }
        }
    };
    let parsed = match parse_signed_manifest(&body) {
        Ok(parsed) => parsed,
        Err(err) => {
            return ManifestProbe {
                source: Some(source),
                status: "error".into(),
                available_version: None,
                available_size_bytes: None,
                blocking_issue: manifest_blocking_issue(&err),
                signature_key_id: None,
            }
        }
    };
    if let Err(err) = verify_manifest_signature(
        &parsed.signature.key_id,
        &parsed.signature.algorithm,
        &parsed.signature.signature,
        &parsed.canonical_payload,
    ) {
        return ManifestProbe {
            source: Some(source),
            status: "signature_invalid".into(),
            available_version: None,
            available_size_bytes: None,
            blocking_issue: manifest_blocking_issue(&err),
            signature_key_id: Some(parsed.signature.key_id),
        };
    }
    let Some(component) = select_asr_sidecar_component(&parsed.manifest, &current_platform_key())
    else {
        return ManifestProbe {
            source: Some(source),
            status: "error".into(),
            available_version: None,
            available_size_bytes: None,
            blocking_issue: Some("当前 manifest 不包含本平台的语音识别组件。".into()),
            signature_key_id: Some(parsed.signature.key_id),
        };
    };
    if let Some(min_shell_version) = component.min_shell_version.as_deref() {
        if !is_shell_version_compatible(env!("CARGO_PKG_VERSION"), min_shell_version) {
            return ManifestProbe {
                source: Some(source),
                status: "incompatible".into(),
                available_version: Some(component.version.clone()),
                available_size_bytes: component.size_bytes,
                blocking_issue: Some(format!(
                    "当前桌面壳版本 {} 低于侧车要求，无法下载安装该组件。请先升级应用。",
                    env!("CARGO_PKG_VERSION")
                )),
                signature_key_id: Some(parsed.signature.key_id),
            };
        }
    }
    ManifestProbe {
        source: Some(source),
        status: "ok".into(),
        available_version: Some(component.version.clone()),
        available_size_bytes: component.size_bytes,
        blocking_issue: None,
        signature_key_id: Some(parsed.signature.key_id),
    }
}

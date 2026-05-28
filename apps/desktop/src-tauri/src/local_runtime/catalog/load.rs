use super::config::{configured_manifest_source, validate_manifest_source_policy};
use super::signature::verify_manifest_signature;
use super::types::LoadedRuntimeManifest;
use crate::local_runtime::install_support::read_text_source;
use crate::local_runtime::manifest::parse_signed_manifest;

pub fn load_configured_manifest() -> Result<LoadedRuntimeManifest, String> {
    let source =
        configured_manifest_source().ok_or_else(|| "local_runtime_manifest_missing".to_string())?;
    validate_manifest_source_policy(&source)?;
    let body = read_text_source(&source)?;
    let parsed = parse_signed_manifest(&body)?;
    verify_manifest_signature(
        &parsed.signature.key_id,
        &parsed.signature.algorithm,
        &parsed.signature.signature,
        &parsed.canonical_payload,
    )?;
    Ok(LoadedRuntimeManifest {
        source,
        manifest: parsed.manifest,
        signature_key_id: parsed.signature.key_id,
    })
}

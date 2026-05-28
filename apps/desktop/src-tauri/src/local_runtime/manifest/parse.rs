use super::types::{
    ParsedSignedManifest, RawRuntimeManifestPayload, RawSignedRuntimeManifest, RuntimeComponent,
    RuntimeManifest,
};

fn convert_payload(raw: RawRuntimeManifestPayload) -> Result<RuntimeManifest, String> {
    let mut components = Vec::with_capacity(raw.components.len());
    for component in raw.components {
        components.push(RuntimeComponent::try_from(component)?);
    }
    Ok(RuntimeManifest {
        manifest_version: raw.manifest_version,
        published_at: raw.published_at,
        components,
    })
}

#[allow(dead_code)]
pub fn parse_manifest(body: &str) -> Result<RuntimeManifest, String> {
    let raw: RawRuntimeManifestPayload =
        serde_json::from_str(body).map_err(|e| format!("manifest_parse_failed: {e}"))?;
    convert_payload(raw)
}

pub fn parse_signed_manifest(body: &str) -> Result<ParsedSignedManifest, String> {
    let raw: RawSignedRuntimeManifest =
        serde_json::from_str(body).map_err(|e| format!("manifest_parse_failed: {e}"))?;
    let canonical_payload = serde_json::to_vec(&raw.payload)
        .map_err(|e| format!("manifest_canonicalize_failed: {e}"))?;
    let manifest = convert_payload(raw.payload)?;
    Ok(ParsedSignedManifest {
        manifest,
        signature: raw.signature,
        canonical_payload,
    })
}

pub fn select_asr_sidecar_component<'a>(
    manifest: &'a RuntimeManifest,
    platform: &str,
) -> Option<&'a RuntimeComponent> {
    manifest
        .components
        .iter()
        .find(|component| component.id == "asr-sidecar" && component.platform == platform)
}

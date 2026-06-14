use super::types::{
    ManifestSignature, ParsedSignedManifest, RawRuntimeManifestPayload, RuntimeComponent,
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

#[cfg(test)]
pub fn parse_manifest(body: &str) -> Result<RuntimeManifest, String> {
    let raw: RawRuntimeManifestPayload =
        serde_json::from_str(body).map_err(|e| format!("manifest_parse_failed: {e}"))?;
    convert_payload(raw)
}

fn signed_payload_bytes(root: &serde_json::Value) -> Result<Vec<u8>, String> {
    let obj = root
        .as_object()
        .ok_or_else(|| "manifest_root_not_object".to_string())?;
    if !obj.contains_key("signature") {
        return Err("manifest_signature_missing".to_string());
    }
    let mut unsigned = root.clone();
    if let Some(unsigned_obj) = unsigned.as_object_mut() {
        unsigned_obj.remove("signature");
    }
    serde_json::to_vec(&unsigned).map_err(|e| format!("manifest_canonicalize_failed: {e}"))
}

pub fn parse_signed_manifest(body: &str) -> Result<ParsedSignedManifest, String> {
    let root: serde_json::Value =
        serde_json::from_str(body).map_err(|e| format!("manifest_parse_failed: {e}"))?;
    let signature: ManifestSignature = serde_json::from_value(
        root.get("signature")
            .cloned()
            .ok_or_else(|| "manifest_signature_missing".to_string())?,
    )
    .map_err(|e| format!("manifest_signature_parse_failed: {e}"))?;
    let canonical_payload = signed_payload_bytes(&root)?;
    let mut unsigned = root;
    if let Some(obj) = unsigned.as_object_mut() {
        obj.remove("signature");
    }
    let payload: RawRuntimeManifestPayload =
        serde_json::from_value(unsigned).map_err(|e| format!("manifest_parse_failed: {e}"))?;
    let manifest = convert_payload(payload)?;
    Ok(ParsedSignedManifest {
        manifest,
        signature,
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

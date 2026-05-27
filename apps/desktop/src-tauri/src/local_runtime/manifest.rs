use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RuntimeManifest {
    pub manifest_version: u32,
    pub published_at: Option<String>,
    pub components: Vec<RuntimeComponent>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct RuntimeArtifact {
    pub url: String,
    pub sha256: String,
    #[serde(default)]
    pub size_bytes: Option<u64>,
    #[serde(default)]
    pub format: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct ManifestSignature {
    pub key_id: String,
    pub algorithm: String,
    pub signature: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RuntimeComponent {
    pub id: String,
    pub version: String,
    pub platform: String,
    pub url: String,
    pub sha256: String,
    pub exe_relpath: String,
    pub min_shell_version: Option<String>,
    pub mirror_urls: Vec<String>,
    pub size_bytes: Option<u64>,
    pub format: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ParsedSignedManifest {
    pub manifest: RuntimeManifest,
    pub signature: ManifestSignature,
    pub canonical_payload: Vec<u8>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
struct RawRuntimeComponent {
    pub id: String,
    pub version: String,
    pub platform: String,
    pub artifact: RuntimeArtifact,
    pub exe_relpath: String,
    #[serde(default)]
    pub min_shell_version: Option<String>,
    #[serde(default)]
    pub mirror_urls: Vec<String>,
}

impl TryFrom<RawRuntimeComponent> for RuntimeComponent {
    type Error = String;

    fn try_from(raw: RawRuntimeComponent) -> Result<Self, Self::Error> {
        Ok(Self {
            id: raw.id,
            version: raw.version,
            platform: raw.platform,
            url: raw.artifact.url,
            sha256: raw.artifact.sha256,
            exe_relpath: raw.exe_relpath,
            min_shell_version: raw.min_shell_version,
            mirror_urls: raw.mirror_urls,
            size_bytes: raw.artifact.size_bytes,
            format: raw.artifact.format,
        })
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
struct RawRuntimeManifestPayload {
    pub manifest_version: u32,
    #[serde(default)]
    pub published_at: Option<String>,
    #[serde(default)]
    pub components: Vec<RawRuntimeComponent>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
struct RawSignedRuntimeManifest {
    #[serde(flatten)]
    pub payload: RawRuntimeManifestPayload,
    pub signature: ManifestSignature,
}

pub fn current_platform_key() -> String {
    let os = match std::env::consts::OS {
        "macos" => "darwin",
        other => other,
    };
    let arch = match std::env::consts::ARCH {
        "aarch64" => "arm64",
        other => other,
    };
    format!("{os}-{arch}")
}

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

#[derive(Clone, Debug, PartialEq, Eq)]
struct ParsedVersion {
    core: Vec<u64>,
    prerelease: Option<Vec<String>>,
}

fn parse_version_parts(version: &str) -> Option<ParsedVersion> {
    let trimmed = version.trim();
    let without_build = trimmed.split('+').next()?.trim();
    let mut parts = without_build.splitn(2, '-');
    let core = parts.next()?.trim();
    if core.is_empty() {
        return None;
    }
    let core = core
        .split('.')
        .map(|part| part.trim().parse::<u64>().ok())
        .collect::<Option<Vec<_>>>()?;
    let prerelease = parts.next().map(|tail| {
        tail.split('.')
            .map(|part| part.trim().to_string())
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>()
    });
    Some(ParsedVersion { core, prerelease })
}

fn compare_prerelease_part(current: &str, min_required: &str) -> std::cmp::Ordering {
    let current_num = current.parse::<u64>();
    let min_num = min_required.parse::<u64>();
    match (current_num, min_num) {
        (Ok(a), Ok(b)) => a.cmp(&b),
        (Ok(_), Err(_)) => std::cmp::Ordering::Less,
        (Err(_), Ok(_)) => std::cmp::Ordering::Greater,
        (Err(_), Err(_)) => current.cmp(min_required),
    }
}

pub fn is_shell_version_compatible(current: &str, min_required: &str) -> bool {
    let Some(current_parts) = parse_version_parts(current) else {
        return false;
    };
    let Some(min_parts) = parse_version_parts(min_required) else {
        return false;
    };
    let max_len = current_parts.core.len().max(min_parts.core.len());
    for idx in 0..max_len {
        let current_part = *current_parts.core.get(idx).unwrap_or(&0);
        let min_part = *min_parts.core.get(idx).unwrap_or(&0);
        if current_part > min_part {
            return true;
        }
        if current_part < min_part {
            return false;
        }
    }

    match (&current_parts.prerelease, &min_parts.prerelease) {
        (None, None) => true,
        (None, Some(_)) => true,
        (Some(_), None) => false,
        (Some(current_pre), Some(min_pre)) => {
            let max_len = current_pre.len().max(min_pre.len());
            for idx in 0..max_len {
                match (current_pre.get(idx), min_pre.get(idx)) {
                    (Some(current_part), Some(min_part)) => {
                        let ordering = compare_prerelease_part(current_part, min_part);
                        if ordering.is_gt() {
                            return true;
                        }
                        if ordering.is_lt() {
                            return false;
                        }
                    }
                    (Some(_), None) => return true,
                    (None, Some(_)) => return false,
                    (None, None) => return true,
                }
            }
            true
        }
    }
}

pub fn artifact_sources(component: &RuntimeComponent) -> Vec<String> {
    let mut sources = Vec::with_capacity(1 + component.mirror_urls.len());
    for source in std::iter::once(&component.url).chain(component.mirror_urls.iter()) {
        let trimmed = source.trim();
        if trimmed.is_empty() {
            continue;
        }
        if !sources.iter().any(|existing| existing == trimmed) {
            sources.push(trimmed.to_string());
        }
    }
    sources
}

#[cfg(test)]
mod tests {
    use super::{
        artifact_sources, current_platform_key, is_shell_version_compatible, parse_manifest,
        parse_signed_manifest, select_asr_sidecar_component,
    };

    #[test]
    fn parse_manifest_and_select_component() {
        let manifest = parse_manifest(
            r#"{
              "manifest_version": 1,
              "components": [
                {
                  "id": "asr-sidecar",
                  "version": "0.1.0",
                  "platform": "darwin-arm64",
                  "artifact": {
                    "url": "https://example.invalid/asr.zip",
                    "sha256": "abc",
                    "size_bytes": 123,
                    "format": "zip-onedir"
                  },
                  "exe_relpath": "rushi-asr-sidecar/rushi-asr-sidecar"
                }
              ]
            }"#,
        )
        .unwrap();
        let component = select_asr_sidecar_component(&manifest, "darwin-arm64").unwrap();
        assert_eq!(component.version, "0.1.0");
    }

    #[test]
    fn parse_signed_manifest_extracts_signature_and_payload() {
        let signed = parse_signed_manifest(
            r#"{
              "manifest_version": 1,
              "published_at": "2026-05-26T00:00:00Z",
              "components": [
                {
                  "id": "asr-sidecar",
                  "version": "0.1.0",
                  "platform": "darwin-arm64",
                  "artifact": {
                    "url": "https://example.invalid/asr.zip",
                    "sha256": "abc",
                    "size_bytes": 123,
                    "format": "zip-onedir"
                  },
                  "exe_relpath": "rushi-asr-sidecar/rushi-asr-sidecar"
                }
              ],
              "signature": {
                "key_id": "fixture",
                "algorithm": "ed25519",
                "signature": "ZmFrZQ=="
              }
            }"#,
        )
        .unwrap();
        assert_eq!(signed.signature.key_id, "fixture");
        assert_eq!(
            signed.manifest.published_at.as_deref(),
            Some("2026-05-26T00:00:00Z")
        );
        assert!(!signed.canonical_payload.is_empty());
    }

    #[test]
    fn parse_manifest_rejects_legacy_flat_artifact_fields() {
        let err = parse_manifest(
            r#"{
              "manifest_version": 1,
              "components": [
                {
                  "id": "asr-sidecar",
                  "version": "0.1.0",
                  "platform": "darwin-arm64",
                  "url": "https://example.invalid/asr.zip",
                  "sha256": "abc",
                  "exe_relpath": "rushi-asr-sidecar/rushi-asr-sidecar"
                }
              ]
            }"#,
        )
        .unwrap_err();
        assert!(err.contains("manifest_parse_failed"));
    }

    #[test]
    fn platform_key_uses_expected_aliases() {
        let key = current_platform_key();
        assert!(key.contains('-'));
    }

    #[test]
    fn shell_version_compatibility_uses_semver_order() {
        assert!(is_shell_version_compatible("0.2.0", "0.2.0"));
        assert!(is_shell_version_compatible("0.2.1", "0.2.0"));
        assert!(is_shell_version_compatible("1.0.0", "0.9.9"));
        assert!(!is_shell_version_compatible("0.1.9", "0.2.0"));
        assert!(!is_shell_version_compatible("0.2.0-beta.1", "0.2.0"));
    }

    #[test]
    fn artifact_sources_preserves_primary_then_mirrors_without_duplicates() {
        let manifest = parse_manifest(
            r#"{
              "manifest_version": 1,
              "components": [
                {
                  "id": "asr-sidecar",
                  "version": "0.1.0",
                  "platform": "darwin-arm64",
                  "artifact": {
                    "url": "https://primary.invalid/asr.zip",
                    "sha256": "abc"
                  },
                  "exe_relpath": "rushi-asr-sidecar/rushi-asr-sidecar",
                  "mirror_urls": [
                    "https://mirror-1.invalid/asr.zip",
                    "https://primary.invalid/asr.zip",
                    "  ",
                    "https://mirror-2.invalid/asr.zip"
                  ]
                }
              ]
            }"#,
        )
        .unwrap();
        let component = select_asr_sidecar_component(&manifest, "darwin-arm64").unwrap();
        assert_eq!(
            artifact_sources(component),
            vec![
                "https://primary.invalid/asr.zip".to_string(),
                "https://mirror-1.invalid/asr.zip".to_string(),
                "https://mirror-2.invalid/asr.zip".to_string(),
            ]
        );
    }
}

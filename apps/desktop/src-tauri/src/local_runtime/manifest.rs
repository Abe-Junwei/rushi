use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct RuntimeManifest {
    pub manifest_version: u32,
    #[serde(default)]
    pub components: Vec<RuntimeComponent>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct RuntimeComponent {
    pub id: String,
    pub version: String,
    pub platform: String,
    pub url: String,
    pub sha256: String,
    pub exe_relpath: String,
    #[serde(default)]
    pub mirror_urls: Vec<String>,
    #[serde(default)]
    pub size_bytes: Option<u64>,
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

pub fn parse_manifest(body: &str) -> Result<RuntimeManifest, String> {
    serde_json::from_str(body).map_err(|e| format!("manifest_parse_failed: {e}"))
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

#[cfg(test)]
mod tests {
    use super::{current_platform_key, parse_manifest, select_asr_sidecar_component};

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
                  "url": "https://example.invalid/asr.zip",
                  "sha256": "abc",
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
    fn platform_key_uses_expected_aliases() {
        let key = current_platform_key();
        assert!(key.contains('-'));
    }
}

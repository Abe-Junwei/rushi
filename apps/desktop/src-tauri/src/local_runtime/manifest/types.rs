use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RuntimeManifest {
    pub manifest_version: u32,
    pub published_at: Option<String>,
    pub components: Vec<RuntimeComponent>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct RuntimeArtifact {
    pub url: String,
    pub sha256: String,
    #[serde(default)]
    pub size_bytes: Option<u64>,
    #[serde(default)]
    pub format: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
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
#[serde(deny_unknown_fields)]
pub(crate) struct RawRuntimeComponent {
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
#[serde(deny_unknown_fields)]
pub(crate) struct RawRuntimeManifestPayload {
    pub manifest_version: u32,
    #[serde(default)]
    pub published_at: Option<String>,
    #[serde(default)]
    pub components: Vec<RawRuntimeComponent>,
}

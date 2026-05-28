use super::super::manifest::RuntimeManifest;

#[derive(Clone, Debug)]
pub struct LoadedRuntimeManifest {
    pub source: String,
    pub manifest: RuntimeManifest,
    pub signature_key_id: String,
}

#[derive(Clone, Debug)]
pub struct ManifestProbe {
    pub source: Option<String>,
    pub status: String,
    pub available_version: Option<String>,
    pub available_size_bytes: Option<u64>,
    pub blocking_issue: Option<String>,
    pub signature_key_id: Option<String>,
}

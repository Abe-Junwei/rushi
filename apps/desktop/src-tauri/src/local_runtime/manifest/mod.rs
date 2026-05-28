mod artifacts;
mod parse;
mod platform;
mod types;
mod version;

#[cfg(test)]
mod tests;

pub use artifacts::artifact_sources;
pub use parse::{parse_manifest, parse_signed_manifest, select_asr_sidecar_component};
pub use platform::current_platform_key;
pub use types::{
    ManifestSignature, ParsedSignedManifest, RuntimeArtifact, RuntimeComponent, RuntimeManifest,
};
pub use version::is_shell_version_compatible;

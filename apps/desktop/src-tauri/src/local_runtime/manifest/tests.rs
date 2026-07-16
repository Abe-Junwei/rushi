use super::parse::parse_manifest;
use crate::local_runtime::manifest::{
    artifact_sources, current_platform_key, is_shell_version_compatible, parse_signed_manifest,
    select_asr_sidecar_component, select_asr_sidecar_cuda_component,
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
fn select_asr_sidecar_cuda_component_by_id() {
    let manifest = parse_manifest(
        r#"{
              "manifest_version": 1,
              "components": [
                {
                  "id": "asr-sidecar",
                  "version": "0.1.0",
                  "platform": "windows-x86_64",
                  "artifact": {
                    "url": "https://example.invalid/asr.zip",
                    "sha256": "abc"
                  },
                  "exe_relpath": "rushi-asr-sidecar/rushi-asr-sidecar.exe"
                },
                {
                  "id": "asr-sidecar-cuda",
                  "version": "1.0.0",
                  "platform": "windows-x86_64",
                  "artifact": {
                    "url": "https://example.invalid/asr-cuda.zip",
                    "sha256": "def",
                    "size_bytes": 999,
                    "format": "zip-onedir"
                  },
                  "exe_relpath": "rushi-asr-sidecar-cuda/rushi-asr-sidecar-cuda.exe"
                }
              ]
            }"#,
    )
    .unwrap();
    let cuda = select_asr_sidecar_cuda_component(&manifest, "windows-x86_64").unwrap();
    assert_eq!(cuda.version, "1.0.0");
    assert_eq!(
        cuda.exe_relpath,
        "rushi-asr-sidecar-cuda/rushi-asr-sidecar-cuda.exe"
    );
    assert!(select_asr_sidecar_cuda_component(&manifest, "darwin-arm64").is_none());
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
fn parse_signed_manifest_rejects_unknown_top_level_field() {
    let err = parse_signed_manifest(
        r#"{
              "manifest_version": 1,
              "components": [],
              "unexpected_field": true,
              "signature": {
                "key_id": "fixture",
                "algorithm": "ed25519",
                "signature": "ZmFrZQ=="
              }
            }"#,
    )
    .unwrap_err();
    assert!(err.contains("manifest_parse_failed"));
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

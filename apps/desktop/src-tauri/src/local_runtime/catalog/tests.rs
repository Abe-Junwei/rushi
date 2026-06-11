use super::{diagnose_configured_manifest, load_configured_manifest};
use super::test_support::env_test_lock;
use crate::local_runtime::manifest::current_platform_key;
use base64::Engine;
use ed25519_dalek::{Signer, SigningKey};
use serde_json::json;
use std::fs;
use uuid::Uuid;

const FIXTURE_KEY_ID: &str = "rushi-runtime-fixture-v1";
const FIXTURE_PRIVATE_KEY_HEX: &str =
    "93c68519a9caa35b3d667513e02fc64e4117ab7483321f9ac92cea336a6c5ade";

fn write_manifest(url: &str) -> String {
    let private_key_bytes: [u8; 32] = hex::decode(FIXTURE_PRIVATE_KEY_HEX)
        .unwrap()
        .try_into()
        .unwrap();
    let signing_key = SigningKey::from_bytes(&private_key_bytes);
    let unsigned = json!({
        "manifest_version": 1,
        "published_at": "2026-05-26T00:00:00Z",
        "components": [{
            "id": "asr-sidecar",
            "version": "0.1.0",
            "platform": current_platform_key(),
            "artifact": {
                "url": url,
                "sha256": "abc",
                "size_bytes": 123,
                "format": "zip-onedir",
            },
            "exe_relpath": if cfg!(target_os = "windows") {
                "rushi-asr-sidecar/rushi-asr-sidecar.exe"
            } else {
                "rushi-asr-sidecar/rushi-asr-sidecar"
            },
            "min_shell_version": "0.0.1",
            "mirror_urls": [],
        }],
    });
    let canonical = serde_json::to_vec(&unsigned).unwrap();
    let signature = signing_key.sign(&canonical);
    let body = json!({
        "manifest_version": unsigned["manifest_version"].clone(),
        "published_at": unsigned["published_at"].clone(),
        "components": unsigned["components"].clone(),
        "signature": {
            "key_id": FIXTURE_KEY_ID,
            "algorithm": "ed25519",
            "signature": base64::engine::general_purpose::STANDARD.encode(signature.to_bytes()),
        }
    });
    let path = std::env::temp_dir().join(format!(
        "rushi-local-runtime-manifest-{}.json",
        Uuid::new_v4()
    ));
    fs::write(&path, serde_json::to_vec_pretty(&body).unwrap()).unwrap();
    path.to_string_lossy().to_string()
}

#[test]
fn load_configured_manifest_accepts_signed_fixture_manifest_in_debug_policy() {
    let _guard = env_test_lock();
    let path = write_manifest("https://example.invalid/asr.zip");
    std::env::set_var("RUSHI_LOCAL_RUNTIME_MANIFEST_URL", &path);
    let loaded = load_configured_manifest().unwrap();
    assert_eq!(loaded.signature_key_id, FIXTURE_KEY_ID);
    assert_eq!(loaded.manifest.components.len(), 1);
    std::env::remove_var("RUSHI_LOCAL_RUNTIME_MANIFEST_URL");
    let _ = fs::remove_file(path);
}

#[test]
fn diagnose_manifest_rejects_http_source_when_insecure_policy_disabled() {
    let _guard = env_test_lock();
    std::env::set_var(
        "RUSHI_LOCAL_RUNTIME_MANIFEST_URL",
        "http://example.invalid/manifest.json",
    );
    std::env::set_var("RUSHI_LOCAL_RUNTIME_ALLOW_INSECURE_MANIFEST", "0");
    let probe = diagnose_configured_manifest();
    assert_eq!(probe.status, "source_rejected");
    std::env::remove_var("RUSHI_LOCAL_RUNTIME_MANIFEST_URL");
    std::env::remove_var("RUSHI_LOCAL_RUNTIME_ALLOW_INSECURE_MANIFEST");
}

#[test]
fn diagnose_manifest_rejects_tampered_signature() {
    let _guard = env_test_lock();
    let path = write_manifest("https://example.invalid/asr.zip");
    let mut body = serde_json::from_slice::<serde_json::Value>(&fs::read(&path).unwrap()).unwrap();
    body["components"][0]["version"] = serde_json::Value::String("0.2.0".into());
    fs::write(&path, serde_json::to_vec_pretty(&body).unwrap()).unwrap();
    std::env::set_var("RUSHI_LOCAL_RUNTIME_MANIFEST_URL", &path);
    let probe = diagnose_configured_manifest();
    assert_eq!(probe.status, "signature_invalid");
    std::env::remove_var("RUSHI_LOCAL_RUNTIME_MANIFEST_URL");
    let _ = fs::remove_file(path);
}

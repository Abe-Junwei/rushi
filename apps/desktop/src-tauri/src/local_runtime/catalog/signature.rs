use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};

use super::config::insecure_manifest_source_allowed;

const RELEASE_MANIFEST_KEY_ID: &str = "rushi-runtime-release-v1";
const RELEASE_MANIFEST_PUBLIC_KEY_HEX: &str =
    "65fb88580ec0f3e1ef458c076086923ead7a8ec6b568f1a52acb4bbca59cfe50";
const FIXTURE_MANIFEST_KEY_ID: &str = "rushi-runtime-fixture-v1";
#[cfg(debug_assertions)]
const FIXTURE_MANIFEST_PUBLIC_KEY_HEX: &str =
    "a7ae302ffd9688b1d22107d177680db6b2708e7870dcfab12b0592a0cbb659f3";

fn verifying_key_from_hex(hex_value: &str) -> Result<VerifyingKey, String> {
    let raw = hex::decode(hex_value)
        .map_err(|e| format!("local_runtime_manifest_key_decode_failed:{e}"))?;
    let key_bytes: [u8; 32] = raw
        .try_into()
        .map_err(|_| "local_runtime_manifest_key_length_invalid".to_string())?;
    VerifyingKey::from_bytes(&key_bytes)
        .map_err(|e| format!("local_runtime_manifest_key_invalid:{e}"))
}

fn resolve_pinned_manifest_key(key_id: &str) -> Result<VerifyingKey, String> {
    match key_id {
        RELEASE_MANIFEST_KEY_ID => verifying_key_from_hex(RELEASE_MANIFEST_PUBLIC_KEY_HEX),
        #[cfg(debug_assertions)]
        FIXTURE_MANIFEST_KEY_ID if insecure_manifest_source_allowed() => {
            verifying_key_from_hex(FIXTURE_MANIFEST_PUBLIC_KEY_HEX)
        }
        FIXTURE_MANIFEST_KEY_ID => Err("local_runtime_manifest_fixture_key_not_allowed".into()),
        _ => Err("local_runtime_manifest_key_unknown".into()),
    }
}

pub(crate) fn verify_manifest_signature(
    key_id: &str,
    algorithm: &str,
    signature: &str,
    payload: &[u8],
) -> Result<(), String> {
    if algorithm != "ed25519" {
        return Err("local_runtime_manifest_signature_algorithm_unsupported".into());
    }
    let verifying_key = resolve_pinned_manifest_key(key_id)?;
    let signature_bytes = BASE64_STANDARD
        .decode(signature)
        .map_err(|e| format!("local_runtime_manifest_signature_decode_failed:{e}"))?;
    let signature = Signature::from_slice(&signature_bytes)
        .map_err(|e| format!("local_runtime_manifest_signature_invalid:{e}"))?;
    verifying_key
        .verify(payload, &signature)
        .map_err(|_| "local_runtime_manifest_signature_mismatch".to_string())
}

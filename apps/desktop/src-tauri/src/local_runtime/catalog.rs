use super::install_support::read_text_source;
use super::manifest::{
    current_platform_key, is_shell_version_compatible, parse_signed_manifest,
    select_asr_sidecar_component, RuntimeManifest,
};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};

const MANIFEST_URL_ENV: &str = "RUSHI_LOCAL_RUNTIME_MANIFEST_URL";
const ALLOW_INSECURE_MANIFEST_ENV: &str = "RUSHI_LOCAL_RUNTIME_ALLOW_INSECURE_MANIFEST";
const RELEASE_MANIFEST_KEY_ID: &str = "rushi-runtime-release-v1";
const RELEASE_MANIFEST_PUBLIC_KEY_HEX: &str =
    "e606847c5f1e9e9e701982aaeeb374673e6d0c0f2d495af59cc2ddb12576f94a";
const FIXTURE_MANIFEST_KEY_ID: &str = "rushi-runtime-fixture-v1";
const FIXTURE_MANIFEST_PUBLIC_KEY_HEX: &str =
    "a7ae302ffd9688b1d22107d177680db6b2708e7870dcfab12b0592a0cbb659f3";

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

pub fn configured_manifest_source() -> Option<String> {
    let raw = std::env::var(MANIFEST_URL_ENV).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

pub fn insecure_manifest_source_allowed() -> bool {
    match std::env::var(ALLOW_INSECURE_MANIFEST_ENV).ok().as_deref() {
        Some("1") => true,
        Some("0") => false,
        _ => cfg!(debug_assertions),
    }
}

fn is_https_source(source: &str) -> bool {
    source.strip_prefix("https://").is_some()
}

fn validate_manifest_source_policy(source: &str) -> Result<(), String> {
    if is_https_source(source) || insecure_manifest_source_allowed() {
        Ok(())
    } else {
        Err("local_runtime_manifest_source_rejected".into())
    }
}

fn verifying_key_from_hex(hex_value: &str) -> Result<VerifyingKey, String> {
    let raw = hex::decode(hex_value).map_err(|e| format!("local_runtime_manifest_key_decode_failed:{e}"))?;
    let key_bytes: [u8; 32] = raw
        .try_into()
        .map_err(|_| "local_runtime_manifest_key_length_invalid".to_string())?;
    VerifyingKey::from_bytes(&key_bytes)
        .map_err(|e| format!("local_runtime_manifest_key_invalid:{e}"))
}

fn resolve_pinned_manifest_key(key_id: &str) -> Result<VerifyingKey, String> {
    match key_id {
        RELEASE_MANIFEST_KEY_ID => verifying_key_from_hex(RELEASE_MANIFEST_PUBLIC_KEY_HEX),
        FIXTURE_MANIFEST_KEY_ID if insecure_manifest_source_allowed() => {
            verifying_key_from_hex(FIXTURE_MANIFEST_PUBLIC_KEY_HEX)
        }
        FIXTURE_MANIFEST_KEY_ID => Err("local_runtime_manifest_fixture_key_not_allowed".into()),
        _ => Err("local_runtime_manifest_key_unknown".into()),
    }
}

fn verify_manifest_signature(key_id: &str, algorithm: &str, signature: &str, payload: &[u8]) -> Result<(), String> {
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

pub fn load_configured_manifest() -> Result<LoadedRuntimeManifest, String> {
    let source = configured_manifest_source().ok_or_else(|| "local_runtime_manifest_missing".to_string())?;
    validate_manifest_source_policy(&source)?;
    let body = read_text_source(&source)?;
    let parsed = parse_signed_manifest(&body)?;
    verify_manifest_signature(
        &parsed.signature.key_id,
        &parsed.signature.algorithm,
        &parsed.signature.signature,
        &parsed.canonical_payload,
    )?;
    Ok(LoadedRuntimeManifest {
        source,
        manifest: parsed.manifest,
        signature_key_id: parsed.signature.key_id,
    })
}

pub fn manifest_blocking_issue(error: &str) -> Option<String> {
    match error {
        "local_runtime_manifest_missing" => {
            Some("未配置本机语音识别组件 manifest，无法应用内下载安装侧车。".into())
        }
        "local_runtime_manifest_source_rejected" => Some(
            "当前 manifest 下载源不符合发行策略。Release 模式仅允许 HTTPS；`file://` / 明文 HTTP 仅限开发或内测显式开启。"
                .into(),
        ),
        "local_runtime_manifest_fixture_key_not_allowed" => Some(
            "当前 manifest 使用了仅限开发/fixture 的签名 key，Release 策略下不可接受。".into(),
        ),
        "local_runtime_manifest_key_unknown" => {
            Some("当前 manifest 使用了未受信任的签名 key。".into())
        }
        "local_runtime_manifest_signature_algorithm_unsupported" => {
            Some("当前 manifest 使用了桌面壳尚未支持的签名算法。".into())
        }
        "local_runtime_manifest_signature_mismatch" => {
            Some("当前 manifest 签名校验失败，已拒绝下载安装。".into())
        }
        _ if error.strip_prefix("manifest_fetch_failed:").is_some()
            || error.strip_prefix("manifest_http_").is_some()
            || error.strip_prefix("manifest_client_build_failed:").is_some() =>
        {
            Some("无法下载本机语音识别组件 manifest，请检查下载源或网络后重试。".into())
        }
        _ if error.strip_prefix("manifest_read_failed:").is_some() => {
            Some("无法读取本机语音识别组件 manifest，请检查下载源是否可访问。".into())
        }
        _ if error.strip_prefix("manifest_parse_failed:").is_some() => {
            Some("本机语音识别组件 manifest 结构无效，无法继续安装。".into())
        }
        _ if error
            .strip_prefix("local_runtime_manifest_signature_decode_failed:")
            .is_some()
            || error
                .strip_prefix("local_runtime_manifest_signature_invalid:")
                .is_some()
            || error.strip_prefix("local_runtime_manifest_key_").is_some() =>
        {
            Some("当前 manifest 的签名元数据无效，已拒绝下载安装。".into())
        }
        _ => None,
    }
}

pub fn diagnose_configured_manifest() -> ManifestProbe {
    let Some(source) = configured_manifest_source() else {
        return ManifestProbe {
            source: None,
            status: "missing".into(),
            available_version: None,
            available_size_bytes: None,
            blocking_issue: manifest_blocking_issue("local_runtime_manifest_missing"),
            signature_key_id: None,
        };
    };
    if let Err(err) = validate_manifest_source_policy(&source) {
        return ManifestProbe {
            source: Some(source),
            status: "source_rejected".into(),
            available_version: None,
            available_size_bytes: None,
            blocking_issue: manifest_blocking_issue(&err),
            signature_key_id: None,
        };
    }
    let body = match read_text_source(&source) {
        Ok(body) => body,
        Err(err) => {
            return ManifestProbe {
                source: Some(source),
                status: "error".into(),
                available_version: None,
                available_size_bytes: None,
                blocking_issue: manifest_blocking_issue(&err),
                signature_key_id: None,
            }
        }
    };
    let parsed = match parse_signed_manifest(&body) {
        Ok(parsed) => parsed,
        Err(err) => {
            return ManifestProbe {
                source: Some(source),
                status: "error".into(),
                available_version: None,
                available_size_bytes: None,
                blocking_issue: manifest_blocking_issue(&err),
                signature_key_id: None,
            }
        }
    };
    if let Err(err) = verify_manifest_signature(
        &parsed.signature.key_id,
        &parsed.signature.algorithm,
        &parsed.signature.signature,
        &parsed.canonical_payload,
    ) {
        return ManifestProbe {
            source: Some(source),
            status: "signature_invalid".into(),
            available_version: None,
            available_size_bytes: None,
            blocking_issue: manifest_blocking_issue(&err),
            signature_key_id: Some(parsed.signature.key_id),
        };
    }
    let Some(component) = select_asr_sidecar_component(&parsed.manifest, &current_platform_key()) else {
        return ManifestProbe {
            source: Some(source),
            status: "error".into(),
            available_version: None,
            available_size_bytes: None,
            blocking_issue: Some("当前 manifest 不包含本平台的语音识别组件。".into()),
            signature_key_id: Some(parsed.signature.key_id),
        };
    };
    if let Some(min_shell_version) = component.min_shell_version.as_deref() {
        if !is_shell_version_compatible(env!("CARGO_PKG_VERSION"), min_shell_version) {
            return ManifestProbe {
                source: Some(source),
                status: "incompatible".into(),
                available_version: Some(component.version.clone()),
                available_size_bytes: component.size_bytes,
                blocking_issue: Some(format!(
                    "当前桌面壳版本 {} 低于侧车要求，无法下载安装该组件。请先升级应用。",
                    env!("CARGO_PKG_VERSION")
                )),
                signature_key_id: Some(parsed.signature.key_id),
            };
        }
    }
    ManifestProbe {
        source: Some(source),
        status: "ok".into(),
        available_version: Some(component.version.clone()),
        available_size_bytes: component.size_bytes,
        blocking_issue: None,
        signature_key_id: Some(parsed.signature.key_id),
    }
}

#[cfg(test)]
mod tests {
    use super::{diagnose_configured_manifest, load_configured_manifest};
    use base64::Engine;
    use ed25519_dalek::{Signer, SigningKey};
    use serde::Serialize;
    use serde_json::json;
    use std::fs;
    use uuid::Uuid;

    const FIXTURE_KEY_ID: &str = "rushi-runtime-fixture-v1";
    const FIXTURE_PRIVATE_KEY_HEX: &str =
        "93c68519a9caa35b3d667513e02fc64e4117ab7483321f9ac92cea336a6c5ade";

    #[derive(Serialize)]
    struct Artifact<'a> {
        url: &'a str,
        sha256: &'a str,
        size_bytes: u64,
        format: &'a str,
    }

    #[derive(Serialize)]
    struct Component<'a> {
        id: &'a str,
        version: &'a str,
        platform: String,
        artifact: Artifact<'a>,
        exe_relpath: &'a str,
        min_shell_version: &'a str,
        mirror_urls: Vec<&'a str>,
    }

    #[derive(Serialize)]
    struct Payload<'a> {
        manifest_version: u32,
        published_at: &'a str,
        components: Vec<Component<'a>>,
    }

    fn write_manifest(url: &str) -> String {
        let private_key_bytes: [u8; 32] = hex::decode(FIXTURE_PRIVATE_KEY_HEX)
            .unwrap()
            .try_into()
            .unwrap();
        let signing_key = SigningKey::from_bytes(&private_key_bytes);
        let payload = Payload {
            manifest_version: 1,
            published_at: "2026-05-26T00:00:00Z",
            components: vec![Component {
                id: "asr-sidecar",
                version: "0.1.0",
                platform: super::current_platform_key(),
                artifact: Artifact {
                    url,
                    sha256: "abc",
                    size_bytes: 123,
                    format: "zip-onedir",
                },
                exe_relpath: if cfg!(target_os = "windows") {
                    "rushi-asr-sidecar/rushi-asr-sidecar.exe"
                } else {
                    "rushi-asr-sidecar/rushi-asr-sidecar"
                },
                min_shell_version: "0.0.1",
                mirror_urls: vec![],
            }],
        };
        let canonical = serde_json::to_vec(&payload).unwrap();
        let signature = signing_key.sign(&canonical);
        let body = json!({
            "manifest_version": payload.manifest_version,
            "published_at": payload.published_at,
            "components": payload.components,
            "signature": {
                "key_id": FIXTURE_KEY_ID,
                "algorithm": "ed25519",
                "signature": base64::engine::general_purpose::STANDARD.encode(signature.to_bytes()),
            }
        });
        let path = std::env::temp_dir().join(format!("rushi-local-runtime-manifest-{}.json", Uuid::new_v4()));
        fs::write(&path, serde_json::to_vec_pretty(&body).unwrap()).unwrap();
        path.to_string_lossy().to_string()
    }

    #[test]
    fn load_configured_manifest_accepts_signed_fixture_manifest_in_debug_policy() {
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
        std::env::set_var("RUSHI_LOCAL_RUNTIME_MANIFEST_URL", "http://example.invalid/manifest.json");
        std::env::set_var("RUSHI_LOCAL_RUNTIME_ALLOW_INSECURE_MANIFEST", "0");
        let probe = diagnose_configured_manifest();
        assert_eq!(probe.status, "source_rejected");
        std::env::remove_var("RUSHI_LOCAL_RUNTIME_MANIFEST_URL");
        std::env::remove_var("RUSHI_LOCAL_RUNTIME_ALLOW_INSECURE_MANIFEST");
    }

    #[test]
    fn diagnose_manifest_rejects_tampered_signature() {
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
}

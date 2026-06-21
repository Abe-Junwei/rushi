use std::fs;
use std::path::PathBuf;
use std::sync::Mutex as TestSerialMutex;

use super::{marker::SEED_MARKER_FILE, seed_bundled_asr_models_at};
use crate::local_asr_model::{
    DEFAULT_FUNASR_HUB_MODEL_ID, DEFAULT_FUNASR_PUNC_MODEL_ID, DEFAULT_FUNASR_VAD_MODEL_ID,
};
use crate::project::bundled_asr_models_manifest::{
    BundledAsrModelsManifest, BundledAsrModelSpec, DEFAULT_BUNDLED_ASR_BUNDLE_ID,
    BUNDLED_ASR_MODELS_PACK_VERSION,
};

static TEST_SERIAL: TestSerialMutex<()> = TestSerialMutex::new(());

fn run_serial(test: impl FnOnce()) {
    let _guard = TEST_SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    test();
}

fn temp_dir(prefix: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("{prefix}-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn write_manifest(root: &std::path::Path, manifest: &BundledAsrModelsManifest) {
    fs::write(
        root.join("manifest.json"),
        serde_json::to_string_pretty(manifest).unwrap(),
    )
    .unwrap();
}

fn write_fake_model(root: &std::path::Path, hub_id: &str, weight_bytes: u64) {
    let parts: Vec<_> = hub_id.split('/').collect();
    let dir = root.join("modelscope/models").join(parts[0]).join(parts[1]);
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("config.yaml"), "model: test\n").unwrap();
    if hub_id == DEFAULT_FUNASR_HUB_MODEL_ID {
        fs::write(dir.join("tokens.json"), "[]").unwrap();
    }
    let mut weight = vec![0_u8; weight_bytes as usize];
    if let Some(byte) = weight.last_mut() {
        *byte = 1;
    }
    fs::write(dir.join("model.pt"), weight).unwrap();
}

fn triplet_manifest() -> BundledAsrModelsManifest {
    BundledAsrModelsManifest {
        pack_version: BUNDLED_ASR_MODELS_PACK_VERSION,
        bundle_id: DEFAULT_BUNDLED_ASR_BUNDLE_ID.to_string(),
        rushi_version: Some("0.0.0".to_string()),
        models: vec![
            BundledAsrModelSpec {
                hub_id: DEFAULT_FUNASR_HUB_MODEL_ID.to_string(),
                required_files: vec![
                    "model.pt".to_string(),
                    "config.yaml".to_string(),
                    "tokens.json".to_string(),
                ],
                min_weight_bytes: Some(8),
            },
            BundledAsrModelSpec {
                hub_id: DEFAULT_FUNASR_VAD_MODEL_ID.to_string(),
                required_files: vec!["model.pt".to_string()],
                min_weight_bytes: Some(1),
            },
            BundledAsrModelSpec {
                hub_id: DEFAULT_FUNASR_PUNC_MODEL_ID.to_string(),
                required_files: vec!["model.pt".to_string(), "config.yaml".to_string()],
                min_weight_bytes: Some(1),
            },
        ],
    }
}

#[test]
fn seed_from_directory_populates_modelscope_cache() {
    run_serial(|| {
        let pack = temp_dir("bundled-seed-src");
        let dest_root = temp_dir("bundled-seed-dest");
        let manifest = triplet_manifest();
        write_manifest(&pack, &manifest);
        write_fake_model(&pack, DEFAULT_FUNASR_HUB_MODEL_ID, 16);
        write_fake_model(&pack, DEFAULT_FUNASR_VAD_MODEL_ID, 4);
        write_fake_model(&pack, DEFAULT_FUNASR_PUNC_MODEL_ID, 4);

        let result = seed_bundled_asr_models_at(&dest_root, &pack, None).unwrap();
        assert_eq!(result.bundle_id, DEFAULT_BUNDLED_ASR_BUNDLE_ID);
        assert!(result.imported_bytes > 0);
        assert!(!result.skipped_reseed);
        assert!(dest_root.join(SEED_MARKER_FILE).is_file());

        let _ = fs::remove_dir_all(pack);
        let _ = fs::remove_dir_all(dest_root);
    });
}

#[test]
fn skips_reseed_when_marker_and_models_complete() {
    run_serial(|| {
        let pack = temp_dir("bundled-seed-skip-src");
        let dest_root = temp_dir("bundled-seed-skip-dest");
        let manifest = triplet_manifest();
        write_manifest(&pack, &manifest);
        write_fake_model(&pack, DEFAULT_FUNASR_HUB_MODEL_ID, 16);
        write_fake_model(&pack, DEFAULT_FUNASR_VAD_MODEL_ID, 4);
        write_fake_model(&pack, DEFAULT_FUNASR_PUNC_MODEL_ID, 4);

        let first = seed_bundled_asr_models_at(&dest_root, &pack, None).unwrap();
        assert!(first.imported_bytes > 0);

        let second = seed_bundled_asr_models_at(&dest_root, &pack, None).unwrap();
        assert!(second.skipped_reseed);
        assert_eq!(second.imported_bytes, 0);

        let _ = fs::remove_dir_all(pack);
        let _ = fs::remove_dir_all(dest_root);
    });
}

#[test]
fn rejects_parallel_seed_while_lock_held() {
    run_serial(|| {
        let _guard = super::acquire_seed_lock().unwrap();
        let dest_root = temp_dir("bundled-seed-lock");
        let pack = temp_dir("bundled-seed-lock-src");
        let manifest = triplet_manifest();
        write_manifest(&pack, &manifest);
        write_fake_model(&pack, DEFAULT_FUNASR_HUB_MODEL_ID, 4);
        let err = seed_bundled_asr_models_at(&dest_root, &pack, None).unwrap_err();
        assert!(err.contains("正在准备"));
        let _ = fs::remove_dir_all(pack);
        let _ = fs::remove_dir_all(dest_root);
    });
}

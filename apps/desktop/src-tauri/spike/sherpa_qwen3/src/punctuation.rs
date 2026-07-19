use std::path::Path;

use sherpa_onnx::{OfflinePunctuation, OfflinePunctuationConfig, OfflinePunctuationModelConfig};

use crate::{err, SpikeResult};

pub struct PunctuationRestorer {
    inner: OfflinePunctuation,
}

impl PunctuationRestorer {
    pub fn create(model: &Path, provider: &str, num_threads: i32) -> SpikeResult<Self> {
        if !model.is_file() {
            return Err(err(format!(
                "punctuation model not found: {}",
                model.display()
            )));
        }
        let config = OfflinePunctuationConfig {
            model: OfflinePunctuationModelConfig {
                ct_transformer: Some(model.display().to_string()),
                num_threads,
                provider: Some(provider.to_string()),
                debug: false,
            },
        };
        let inner = OfflinePunctuation::create(&config)
            .ok_or_else(|| err("create offline punctuation failed".to_string()))?;
        Ok(Self { inner })
    }

    pub fn add(&self, text: &str) -> SpikeResult<String> {
        if text.trim().is_empty() {
            return Ok(String::new());
        }
        self.inner
            .add_punctuation(text)
            .ok_or_else(|| err("offline punctuation returned no result".to_string()))
    }
}

//! 百炼 Fun-ASR 入口：录音文件异步 Job（`dashscope_file_asr`）。

use std::path::Path;
use std::time::Duration;

use crate::online_stt_bridge::OnlineTranscribeBridge;
use crate::project::stt_vocabulary::SttVocabularyPlan;
use crate::project::transcribe_cancel_cmd::TranscribeCancelPoll;

/// 阿里云百炼 Fun-ASR 录音文件异步转写（临时 OSS 上传 + Job 轮询 + `sentences[]`）。
pub async fn transcribe_dashscope_asr(
    client: &reqwest::Client,
    audio_path: &Path,
    bridge: &OnlineTranscribeBridge,
    vocabulary: &SttVocabularyPlan,
    timeout: Duration,
    log: &impl Fn(&str),
    cancel: TranscribeCancelPoll<'_>,
) -> Result<serde_json::Value, String> {
    super::dashscope_file_asr::transcribe_dashscope_file_asr(
        client, audio_path, bridge, vocabulary, timeout, log, cancel,
    )
    .await
}

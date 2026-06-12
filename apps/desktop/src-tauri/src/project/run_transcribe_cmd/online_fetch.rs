use super::helpers::record_transcribe_err;
use super::super::stt_vocabulary::SttVocabularyPlan;
use super::super::transcribe::{
    post_transcribe_multipart, TranscribeHttpOptions, TranscribeRequestAuth,
};
use super::super::transcribe_cancel_cmd::TranscribeCancelPoll;
use super::super::transcribe_native_online::{transcribe_assemblyai_native, transcribe_openai_native};
use super::super::transcribe_timeline::{TranscribeTimelineRecorder, STAGE_TRANSCRIBE};
use super::super::utils::append_desktop_log_line;
use crate::online_stt_bridge::{is_allowed_stt_transcribe_url, OnlineTranscribeBridge};
use crate::DbState;
use std::path::Path;
use std::time::Duration;

pub(crate) async fn fetch_online_transcribe_json(
    st: &DbState,
    tl: &mut TranscribeTimelineRecorder,
    audio_path: &Path,
    hotwords: &str,
    vocabulary: &SttVocabularyPlan,
    o: &OnlineTranscribeBridge,
    cancel: TranscribeCancelPoll<'_>,
) -> Result<serde_json::Value, String> {
    let timeout_s = o.timeout_sec.unwrap_or(600).clamp(30, 600);
    let dur = Duration::from_secs(timeout_s);
    match o.native_adapter.as_deref() {
        Some("openaiAudio") => {
            tl.begin_stage(STAGE_TRANSCRIBE);
            transcribe_openai_native(st, audio_path, vocabulary, o, dur, cancel)
                .await
                .map_err(|e| record_transcribe_err(tl, e))
        }
        Some("assemblyai") => {
            tl.begin_stage(STAGE_TRANSCRIBE);
            transcribe_assemblyai_native(st, audio_path, vocabulary, o, dur, cancel)
                .await
                .map_err(|e| record_transcribe_err(tl, e))
        }
        Some(adapter @ ("dashscopeAsr" | "deepgramListen")) => {
            tl.begin_stage(STAGE_TRANSCRIBE);
            let client = crate::stt_native::http_client();
            let log = |line: &str| append_desktop_log_line(st, line);
            crate::stt_native::dispatch_native(
                adapter,
                client,
                audio_path,
                crate::stt_native::NativeTranscribeDispatch {
                    bridge: o,
                    vocabulary,
                    timeout: dur,
                    cancel,
                },
                &log,
            )
            .await
            .map_err(|e| record_transcribe_err(tl, e))
        }
        _ => {
            let url = o.transcribe_url.trim();
            if url.is_empty() {
                return Err(record_transcribe_err(tl, "在线转写 URL 为空".to_string()));
            }
            if !is_allowed_stt_transcribe_url(url) {
                return Err(record_transcribe_err(
                    tl,
                    "在线转写 URL 须为 https，或 http 且主机为 localhost / 127.0.0.1 / ::1".to_string(),
                ));
            }
            let auth = o.authorization.as_deref();
            let app_k = o.app_key.as_deref().and_then(|s| {
                let t = s.trim();
                if t.is_empty() {
                    None
                } else {
                    Some(t)
                }
            });
            append_desktop_log_line(st, "INFO transcribe online_multipart");
            post_transcribe_multipart(
                st,
                url,
                audio_path,
                hotwords.to_string(),
                TranscribeHttpOptions {
                    auth: TranscribeRequestAuth {
                        authorization: auth,
                        app_key: app_k,
                    },
                    timeout: dur,
                    cancel,
                },
                Some(tl),
            )
            .await
        }
    }
}

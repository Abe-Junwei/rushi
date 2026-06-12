use super::super::transcribe_cancel_cmd::TRANSCRIBE_CANCELLED_MESSAGE;
use super::super::transcribe_timeline::{
    infer_failed_stage_from_message, infer_transcribe_error_code, TranscribeTimelineRecorder,
};

pub(crate) struct TranscribeInFlightGuard;

impl Drop for TranscribeInFlightGuard {
    fn drop(&mut self) {
        crate::asr_sidecar::warm::dec_transcribe_in_flight();
    }
}

pub(crate) fn record_transcribe_err(tl: &mut TranscribeTimelineRecorder, err: String) -> String {
    let outcome = tl.snapshot().outcome;
    if err == TRANSCRIBE_CANCELLED_MESSAGE {
        return err;
    }
    if outcome != "failed" && outcome != "cancelled" {
        let stage = infer_failed_stage_from_message(&err);
        let code = infer_transcribe_error_code(&err);
        tl.fail_stage(stage, code, &err);
    }
    err
}

pub(crate) fn apply_windowed_warning(tl: &mut TranscribeTimelineRecorder, warnings: &[String]) {
    for w in warnings {
        if let Some(rest) = w.strip_prefix("transcribe_windowed:windows=") {
            if let Ok(total) = rest.parse::<u32>() {
                tl.set_window_count_only(total);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::record_transcribe_err;
    use crate::project::transcribe_cancel_cmd::TRANSCRIBE_CANCELLED_MESSAGE;
    use crate::project::transcribe_timeline::{TranscribeTimelineRecorder, STAGE_TRANSCRIBE};

    #[test]
    fn record_transcribe_err_skips_cancel_message() {
        let mut tl = TranscribeTimelineRecorder::new("file-1", "online");
        tl.begin_stage(STAGE_TRANSCRIBE);
        let msg = record_transcribe_err(&mut tl, TRANSCRIBE_CANCELLED_MESSAGE.to_string());
        assert_eq!(msg, TRANSCRIBE_CANCELLED_MESSAGE);
        assert_ne!(tl.snapshot().outcome, "failed");
        assert!(tl.snapshot().failed_stage.is_none());
    }
}

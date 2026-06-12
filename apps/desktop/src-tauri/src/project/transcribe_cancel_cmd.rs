//! Online transcribe cancel registry (Q-STT-CANCEL-1 / Step 7a).
//! Mirrors `PostprocessCancelState` + `Abortable` pattern from postprocess commands.

use futures_util::future::{AbortHandle, Abortable};
use std::collections::HashMap;
use std::future::Future;
use std::sync::Mutex;
use std::time::Duration;
use tauri::State;

pub const TRANSCRIBE_CANCELLED_MESSAGE: &str = "转写已取消";

/// Optional cancel registration passed into adapter HTTP/poll paths (Steps 7b–d).
pub(crate) type TranscribeCancelPoll<'a> = Option<(&'a TranscribeCancelState, &'a str)>;

/// Returns `Err` when `project_cancel_transcribe` removed the request handle.
pub(crate) fn ensure_transcribe_not_cancelled(ctx: TranscribeCancelPoll<'_>) -> Result<(), String> {
    let Some((state, request_id)) = ctx else {
        return Ok(());
    };
    let registered = state
        .0
        .lock()
        .map_err(|_| "转写取消状态不可用。")?
        .contains_key(request_id);
    if registered {
        Ok(())
    } else {
        Err(TRANSCRIBE_CANCELLED_MESSAGE.to_string())
    }
}

/// Poll interval sleep with periodic cancel checks (250ms slices).
pub(crate) async fn transcribe_poll_wait(
    duration: Duration,
    ctx: TranscribeCancelPoll<'_>,
) -> Result<(), String> {
    let Some(_) = ctx else {
        tokio::time::sleep(duration).await;
        return Ok(());
    };
    let deadline = tokio::time::Instant::now() + duration;
    loop {
        ensure_transcribe_not_cancelled(ctx)?;
        let now = tokio::time::Instant::now();
        if now >= deadline {
            return Ok(());
        }
        let slice = std::cmp::min(deadline - now, Duration::from_millis(250));
        tokio::time::sleep(slice).await;
    }
}

#[derive(Default)]
pub struct TranscribeCancelState(pub Mutex<HashMap<String, AbortHandle>>);

#[tauri::command]
pub fn project_cancel_transcribe(
    cancel_state: State<'_, TranscribeCancelState>,
    request_id: String,
) -> Result<bool, String> {
    transcribe_cancel_by_request_id(&cancel_state, request_id.trim())
}

pub(crate) fn transcribe_cancel_by_request_id(
    cancel_state: &TranscribeCancelState,
    request_id: &str,
) -> Result<bool, String> {
    if request_id.is_empty() {
        return Err("缺少转写请求 id。".to_string());
    }
    let handle = cancel_state
        .0
        .lock()
        .map_err(|_| "转写取消状态不可用。")?
        .remove(request_id);
    if let Some(handle) = handle {
        handle.abort();
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Wrap an online transcribe future with optional `request_id` cancel registration.
pub(crate) async fn run_transcribe_abortable<Fut, T>(
    cancel_state: &TranscribeCancelState,
    request_id: Option<&str>,
    future: Fut,
) -> Result<T, String>
where
    Fut: Future<Output = Result<T, String>>,
{
    let Some(id) = request_id.map(str::trim).filter(|x| !x.is_empty()) else {
        return future.await;
    };
    let (handle, registration) = AbortHandle::new_pair();
    {
        let mut handles = cancel_state.0.lock().map_err(|_| "转写取消状态不可用。")?;
        if let Some(previous) = handles.insert(id.to_string(), handle) {
            previous.abort();
        }
    }
    let out = Abortable::new(future, registration).await;
    if let Ok(mut handles) = cancel_state.0.lock() {
        handles.remove(id);
    }
    match out {
        Ok(result) => result,
        Err(_) => Err(TRANSCRIBE_CANCELLED_MESSAGE.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_by_request_id_rejects_empty_id() {
        let state = TranscribeCancelState::default();
        assert!(transcribe_cancel_by_request_id(&state, "").is_err());
    }

    #[test]
    fn cancel_by_request_id_returns_false_when_not_registered() {
        let state = TranscribeCancelState::default();
        assert!(!transcribe_cancel_by_request_id(&state, "missing").unwrap());
    }

    #[test]
    fn ensure_not_cancelled_when_unregistered() {
        let state = TranscribeCancelState::default();
        let (handle, _reg) = AbortHandle::new_pair();
        state.0.lock().unwrap().insert("job-1".to_string(), handle);
        assert!(ensure_transcribe_not_cancelled(Some((&state, "job-1"))).is_ok());
        assert!(transcribe_cancel_by_request_id(&state, "job-1").unwrap());
        assert_eq!(
            ensure_transcribe_not_cancelled(Some((&state, "job-1"))).unwrap_err(),
            TRANSCRIBE_CANCELLED_MESSAGE
        );
    }

    #[test]
    fn ensure_not_cancelled_skips_when_no_ctx() {
        let state = TranscribeCancelState::default();
        assert!(ensure_transcribe_not_cancelled(None).is_ok());
        drop(state);
    }

    fn cancel_test_runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .build()
            .expect("tokio runtime")
    }

    #[test]
    fn poll_wait_completes_after_duration_without_cancel_ctx() {
        let rt = cancel_test_runtime();
        rt.block_on(async {
            let started = tokio::time::Instant::now();
            transcribe_poll_wait(Duration::from_millis(120), None)
                .await
                .expect("no cancel ctx");
            assert!(started.elapsed() >= Duration::from_millis(100));
        });
    }

    #[test]
    fn poll_wait_returns_cancelled_when_handle_removed_mid_wait() {
        let rt = cancel_test_runtime();
        rt.block_on(async {
            let state = TranscribeCancelState::default();
            let (handle, _reg) = AbortHandle::new_pair();
            state
                .0
                .lock()
                .unwrap()
                .insert("poll-job".to_string(), handle);
            let started = tokio::time::Instant::now();
            let poll = transcribe_poll_wait(Duration::from_secs(2), Some((&state, "poll-job")));
            let cancel = async {
                tokio::time::sleep(Duration::from_millis(50)).await;
                assert!(transcribe_cancel_by_request_id(&state, "poll-job").unwrap());
            };
            let (poll_out, _) = tokio::join!(poll, cancel);
            assert_eq!(poll_out.unwrap_err(), TRANSCRIBE_CANCELLED_MESSAGE);
            assert!(started.elapsed() < Duration::from_secs(1));
        });
    }

    #[test]
    fn run_transcribe_abortable_maps_external_cancel_to_message() {
        let rt = cancel_test_runtime();
        rt.block_on(async {
            let state = TranscribeCancelState::default();
            let worker = run_transcribe_abortable(&state, Some("online-stt-1"), async {
                tokio::time::sleep(Duration::from_secs(5)).await;
                Ok::<(), String>(())
            });
            let cancel = async {
                tokio::time::sleep(Duration::from_millis(50)).await;
                assert!(transcribe_cancel_by_request_id(&state, "online-stt-1").unwrap());
            };
            let (out, _) = tokio::join!(worker, cancel);
            assert_eq!(out.unwrap_err(), TRANSCRIBE_CANCELLED_MESSAGE);
        });
    }
}

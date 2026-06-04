use super::postprocess_types::{PostprocessCancelAutoPunctuateRequest, PostprocessCancelState};
use tauri::State;

#[tauri::command]
pub fn postprocess_cancel_auto_punctuate(
    cancel_state: State<'_, PostprocessCancelState>,
    req: PostprocessCancelAutoPunctuateRequest,
) -> Result<bool, String> {
    postprocess_cancel_by_request_id(&cancel_state, req.request_id.trim(), "自动标点")
}

#[tauri::command]
pub fn postprocess_cancel_export_polish(
    cancel_state: State<'_, PostprocessCancelState>,
    req: PostprocessCancelAutoPunctuateRequest,
) -> Result<bool, String> {
    postprocess_cancel_by_request_id(&cancel_state, req.request_id.trim(), "导出润色")
}

pub(crate) fn postprocess_cancel_by_request_id(
    cancel_state: &PostprocessCancelState,
    request_id: &str,
    label: &str,
) -> Result<bool, String> {
    if request_id.is_empty() {
        return Err(format!("缺少{label}请求 id。"));
    }
    let handle = cancel_state
        .0
        .lock()
        .map_err(|_| format!("{label}取消状态不可用。"))?
        .remove(request_id);
    if let Some(handle) = handle {
        handle.abort();
        Ok(true)
    } else {
        Ok(false)
    }
}

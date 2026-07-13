use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAudioSnapshot {
    pub playing: bool,
    pub current_time_sec: f64,
    pub duration_sec: f64,
    pub rate: f32,
    pub path: String,
}

/// Ordered engine → frontend events via `tauri::ipc::Channel`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    tag = "event",
    content = "data"
)]
pub enum NativeAudioEvent {
    Ready {
        duration_sec: f64,
    },
    Playing,
    Paused,
    Seeked {
        sec: f64,
    },
    TimeUpdate {
        sec: f64,
    },
    Ended,
    /// Soft underrun after consecutive empty output callbacks.
    Underrun {
        consecutive: u32,
    },
    /// Default output route changed (CoreAudio may auto-reroute).
    DeviceChanged {
        message: String,
    },
    Error {
        message: String,
    },
}

#[cfg(test)]
mod tests {
    use super::NativeAudioEvent;

    #[test]
    fn event_serde_camel_case_contract() {
        let ready = serde_json::to_value(NativeAudioEvent::Ready { duration_sec: 12.5 }).unwrap();
        assert_eq!(ready["event"], "ready");
        assert_eq!(ready["data"]["durationSec"], 12.5);

        let time = serde_json::to_value(NativeAudioEvent::TimeUpdate { sec: 1.25 }).unwrap();
        assert_eq!(time["event"], "timeUpdate");
        assert_eq!(time["data"]["sec"], 1.25);

        let seeked = serde_json::to_value(NativeAudioEvent::Seeked { sec: 3.0 }).unwrap();
        assert_eq!(seeked["event"], "seeked");

        let err = serde_json::to_value(NativeAudioEvent::Error {
            message: "boom".into(),
        })
        .unwrap();
        assert_eq!(err["event"], "error");
        assert_eq!(err["data"]["message"], "boom");

        for unit in [
            NativeAudioEvent::Playing,
            NativeAudioEvent::Paused,
            NativeAudioEvent::Ended,
        ] {
            let v = serde_json::to_value(&unit).unwrap();
            assert!(v.get("event").is_some());
        }

        let underrun = serde_json::to_value(NativeAudioEvent::Underrun { consecutive: 3 }).unwrap();
        assert_eq!(underrun["event"], "underrun");
        assert_eq!(underrun["data"]["consecutive"], 3);

        let device = serde_json::to_value(NativeAudioEvent::DeviceChanged {
            message: "default output device changed".into(),
        })
        .unwrap();
        assert_eq!(device["event"], "deviceChanged");
        assert_eq!(device["data"]["message"], "default output device changed");
    }
}

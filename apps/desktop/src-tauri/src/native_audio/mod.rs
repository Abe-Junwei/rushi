//! Native audio playback (S4): CPAL output + Symphonia decode.
//! Spec: docs/execution/specs/wkwebview-native-audio-engine-research.md
//! ADR: docs/adr/0008-native-audio-playback-transport.md

pub mod commands;
mod clock;
mod decode;
mod engine;
mod events;
mod output;
mod types;

pub use engine::NativeAudioState;

pub fn shutdown(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Some(st) = app.try_state::<NativeAudioState>() {
        st.stop();
    }
}

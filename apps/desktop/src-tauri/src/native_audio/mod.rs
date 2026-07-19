//! Native audio playback (S4): CPAL output + Symphonia decode.
//! Spec: docs/execution/specs/wkwebview-native-audio-engine-research.md
//! ADR: docs/adr/0008-native-audio-playback-transport.md

mod clock;
pub mod commands;
mod decode;
mod engine;
mod events;
mod output;
mod signalsmith_tempo;
mod tempo;
mod tempo_processor;
mod types;

#[cfg(test)]
mod fixture_tests;

pub use engine::NativeAudioState;

pub fn shutdown(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Some(st) = app.try_state::<NativeAudioState>() {
        st.stop();
    }
}

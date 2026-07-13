use tauri::ipc::Channel;

use super::types::NativeAudioEvent;

/// Thin wrapper so engine/decode can emit without holding UI types elsewhere.
#[derive(Clone)]
pub(crate) struct EventEmitter {
    channel: Channel<NativeAudioEvent>,
}

impl EventEmitter {
    pub(crate) fn new(channel: Channel<NativeAudioEvent>) -> Self {
        Self { channel }
    }

    pub(crate) fn emit(&self, event: NativeAudioEvent) {
        let _ = self.channel.send(event);
    }
}

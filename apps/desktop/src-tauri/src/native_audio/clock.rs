use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};

/// Shared playhead / transport flags between engine, decode, and CPAL callback.
pub(crate) struct SharedClock {
    pub playing: AtomicBool,
    pub play_requested: AtomicBool,
    pub buffer_ready: AtomicBool,
    pub stop: AtomicBool,
    pub seek_seq: AtomicU64,
    pub drain_seq: AtomicU64,
    pub rate_seq: AtomicU64,
    /// Output is flushing stale ring PCM after seek/rebuild; decode must not push.
    pub drain_pending: AtomicBool,
    pub position_us: AtomicU64,
    pub duration_us: AtomicU64,
    pub rate_milli: AtomicU32,
    pub output_sample_rate: AtomicU32,
    pub output_channels: AtomicU32,
    /// Demuxer hit EOF; next Play must re-seek before decoding again.
    pub at_eof: AtomicBool,
    /// Set when decode/output reports a soft underrun (telemetry / Error event).
    pub underrun: AtomicBool,
    pub underrun_reported: AtomicBool,
    pub queued_samples: AtomicU64,
}

impl SharedClock {
    pub(crate) fn new(duration_sec: f64, sample_rate: u32, channels: u32) -> Self {
        Self {
            playing: AtomicBool::new(false),
            play_requested: AtomicBool::new(false),
            buffer_ready: AtomicBool::new(false),
            stop: AtomicBool::new(false),
            seek_seq: AtomicU64::new(0),
            drain_seq: AtomicU64::new(0),
            rate_seq: AtomicU64::new(0),
            drain_pending: AtomicBool::new(false),
            position_us: AtomicU64::new(0),
            duration_us: AtomicU64::new((duration_sec.max(0.0) * 1_000_000.0) as u64),
            rate_milli: AtomicU32::new(1000),
            output_sample_rate: AtomicU32::new(sample_rate.max(1)),
            output_channels: AtomicU32::new(channels.max(1)),
            at_eof: AtomicBool::new(false),
            underrun: AtomicBool::new(false),
            underrun_reported: AtomicBool::new(false),
            queued_samples: AtomicU64::new(0),
        }
    }

    pub(crate) fn current_time_sec(&self) -> f64 {
        self.position_us.load(Ordering::Relaxed) as f64 / 1_000_000.0
    }

    pub(crate) fn duration_sec(&self) -> f64 {
        self.duration_us.load(Ordering::Relaxed) as f64 / 1_000_000.0
    }

    pub(crate) fn rate(&self) -> f32 {
        self.rate_milli.load(Ordering::Relaxed) as f32 / 1000.0
    }

    pub(crate) fn decrement_queued_samples(&self, n: u64) {
        let _ = self
            .queued_samples
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |cur| {
                Some(cur.saturating_sub(n))
            });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_clock_rate_roundtrip() {
        let c = SharedClock::new(10.0, 48000, 2);
        c.rate_milli.store(1500, Ordering::SeqCst);
        assert!((c.rate() - 1.5).abs() < 0.001);
    }
}

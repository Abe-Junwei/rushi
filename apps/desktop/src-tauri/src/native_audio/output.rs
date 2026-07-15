//! CPAL output callback — Consumer is owned here (SPSC, no Mutex).

use std::sync::atomic::Ordering;
use std::sync::mpsc::Sender;
use std::sync::Arc;

use cpal::traits::DeviceTrait;
use cpal::{Device, ErrorKind, SampleFormat, Stream, StreamConfig};
use ringbuf::traits::Consumer;

use super::clock::SharedClock;

/// Soft stream faults forwarded from the CPAL error callback to the engine thread.
#[derive(Debug, Clone)]
pub(crate) enum StreamFault {
    DeviceChanged(String),
    StreamInvalidated(String),
    DeviceNotAvailable(String),
    DeviceBusy(String),
    PermissionDenied(String),
    Xrun(String),
    Other(String),
}

/// Cap seek/rebuild ring drains so a full RING_CAPACITY flush cannot stall CoreAudio.
const MAX_DRAIN_SAMPLES_PER_CALLBACK: usize = 16_384;

pub(crate) fn build_output_stream(
    device: &Device,
    sample_format: SampleFormat,
    config: StreamConfig,
    clock: Arc<SharedClock>,
    cons: impl Consumer<Item = f32> + Send + 'static,
    fault_tx: Sender<StreamFault>,
) -> Result<Stream, String> {
    let last_drain = 0u64;
    let err_fn = move |e: cpal::Error| {
        let kind = e.kind();
        let msg = e.to_string();
        let fault = match kind {
            ErrorKind::DeviceChanged => StreamFault::DeviceChanged(msg),
            ErrorKind::StreamInvalidated => StreamFault::StreamInvalidated(msg),
            ErrorKind::DeviceNotAvailable => StreamFault::DeviceNotAvailable(msg),
            ErrorKind::DeviceBusy => StreamFault::DeviceBusy(msg),
            ErrorKind::PermissionDenied => StreamFault::PermissionDenied(msg),
            ErrorKind::Xrun => StreamFault::Xrun(msg),
            _ => StreamFault::Other(msg),
        };
        let _ = fault_tx.send(fault);
    };

    let stream = match sample_format {
        SampleFormat::F32 => {
            let mut cons = cons;
            let mut last_drain = last_drain;
            let clock_cb = Arc::clone(&clock);
            device.build_output_stream(
                config,
                move |data: &mut [f32], _| {
                    write_output(data, &clock_cb, &mut cons, &mut last_drain, |s| s)
                },
                err_fn,
                None,
            )
        }
        SampleFormat::I16 => {
            let mut cons = cons;
            let mut last_drain = last_drain;
            let clock_cb = Arc::clone(&clock);
            device.build_output_stream(
                config,
                move |data: &mut [i16], _| {
                    write_output(data, &clock_cb, &mut cons, &mut last_drain, |s| {
                        (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16
                    })
                },
                err_fn,
                None,
            )
        }
        SampleFormat::U16 => {
            let mut cons = cons;
            let mut last_drain = last_drain;
            let clock_cb = Arc::clone(&clock);
            device.build_output_stream(
                config,
                move |data: &mut [u16], _| {
                    write_output(data, &clock_cb, &mut cons, &mut last_drain, |s| {
                        (((s.clamp(-1.0, 1.0) + 1.0) * 0.5) * u16::MAX as f32) as u16
                    })
                },
                err_fn,
                None,
            )
        }
        other => {
            return Err(format!("不支持的输出采样格式: {other:?}"));
        }
    };
    stream.map_err(|e| format!("创建音频输出流失败: {e}"))
}

fn write_output<T>(
    data: &mut [T],
    clock: &SharedClock,
    cons: &mut impl Consumer<Item = f32>,
    last_drain: &mut u64,
    map: impl Fn(f32) -> T,
) {
    let playing = clock.playing.load(Ordering::SeqCst);
    let channels = clock.output_channels.load(Ordering::Relaxed).max(1) as usize;
    let sample_rate = clock.output_sample_rate.load(Ordering::Relaxed).max(1) as f64;
    let rate = clock.rate() as f64;

    let drain = clock.drain_seq.load(Ordering::Acquire);
    if drain != *last_drain {
        let mut drained = 0usize;
        let mut empty = false;
        while drained < MAX_DRAIN_SAMPLES_PER_CALLBACK {
            match cons.try_pop() {
                Some(_) => drained += 1,
                None => {
                    empty = true;
                    break;
                }
            }
        }
        if empty {
            *last_drain = drain;
            clock.drain_pending.store(false, Ordering::Release);
        } else {
            // Still flushing stale PCM — silence this callback and finish next tick.
            for s in data.iter_mut() {
                *s = map(0.0);
            }
            return;
        }
    }

    if !playing {
        for s in data.iter_mut() {
            *s = map(0.0);
        }
        return;
    }

    let frames = data.len() / channels;
    let mut got_frames = 0usize;
    let mut popped_samples = 0u64;
    let mut missed = false;
    for frame_i in 0..frames {
        let base = frame_i * channels;
        let mut ok = true;
        for ch in 0..channels {
            if let Some(sample) = cons.try_pop() {
                data[base + ch] = map(sanitize_output_sample(sample));
                popped_samples += 1;
            } else {
                data[base + ch] = map(0.0);
                ok = false;
                missed = true;
            }
        }
        if ok {
            got_frames += 1;
        }
    }
    if missed
        && clock.playing.load(Ordering::SeqCst)
        && !clock.at_eof.load(Ordering::SeqCst)
        && !clock.drain_pending.load(Ordering::Relaxed)
    {
        clock.underrun.store(true, Ordering::Relaxed);
    }
    if popped_samples > 0 {
        clock.decrement_queued_samples(popped_samples);
    }

    if got_frames > 0 {
        let advance_us = ((got_frames as f64) / sample_rate * rate * 1_000_000.0) as u64;
        let _ = clock.position_us.fetch_add(advance_us, Ordering::Relaxed);
        let dur = clock.duration_us.load(Ordering::Relaxed);
        let pos = clock.position_us.load(Ordering::Relaxed);
        if dur > 0 && pos >= dur {
            clock.position_us.store(dur, Ordering::Relaxed);
            // Output owns the audible end: these three stores are the single
            // source of truth for "playback finished" (see engine.rs Ended check).
            clock.play_requested.store(false, Ordering::SeqCst);
            clock.playing.store(false, Ordering::SeqCst);
            clock.at_eof.store(true, Ordering::SeqCst);
        }
    }
}

#[inline]
fn sanitize_output_sample(sample: f32) -> f32 {
    if sample.is_finite() {
        sample.clamp(-1.0, 1.0)
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    use super::sanitize_output_sample;

    #[test]
    fn sanitize_output_sample_removes_non_finite_values() {
        assert_eq!(sanitize_output_sample(f32::NAN), 0.0);
        assert_eq!(sanitize_output_sample(f32::INFINITY), 0.0);
        assert_eq!(sanitize_output_sample(f32::NEG_INFINITY), 0.0);
        assert_eq!(sanitize_output_sample(2.0), 1.0);
        assert_eq!(sanitize_output_sample(-2.0), -1.0);
        assert_eq!(sanitize_output_sample(0.25), 0.25);
    }
}

//! CPAL output callback — Consumer is owned here (SPSC, no Mutex).

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use cpal::traits::DeviceTrait;
use cpal::{Device, SampleFormat, Stream, StreamConfig};
use ringbuf::traits::Consumer;

use super::clock::SharedClock;

pub(crate) fn build_output_stream(
    device: &Device,
    sample_format: SampleFormat,
    config: &StreamConfig,
    clock: Arc<SharedClock>,
    cons: impl Consumer<Item = f32> + Send + 'static,
) -> Result<Stream, String> {
    let last_drain = AtomicU64::new(0);
    let err_fn = |e| eprintln!("native_audio cpal error: {e}");

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
    last_drain: &mut AtomicU64,
    map: impl Fn(f32) -> T,
) {
    let playing = clock.playing.load(Ordering::Relaxed);
    let channels = clock.output_channels.load(Ordering::Relaxed).max(1) as usize;
    let sample_rate = clock.output_sample_rate.load(Ordering::Relaxed).max(1) as f64;
    let rate = clock.rate() as f64;

    let drain = clock.drain_seq.load(Ordering::Relaxed);
    if drain != last_drain.load(Ordering::Relaxed) {
        while cons.try_pop().is_some() {}
        last_drain.store(drain, Ordering::Relaxed);
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
                data[base + ch] = map(sample);
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
    if missed {
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
            clock.play_requested.store(false, Ordering::Relaxed);
            clock.playing.store(false, Ordering::Relaxed);
            clock.at_eof.store(true, Ordering::Relaxed);
        }
    }
}

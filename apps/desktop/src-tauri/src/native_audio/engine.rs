//! CPAL engine thread + PlayerHandle command plane.
//! Consumer is moved into the CPAL callback (no Mutex). Producer lives on decode.

use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream, StreamConfig, SupportedStreamConfig};
use ringbuf::traits::Split;
use ringbuf::{HeapProd, HeapRb};
use tauri::ipc::Channel;

use super::clock::SharedClock;
use super::decode::{decode_loop, probe_duration_sec};
use super::events::EventEmitter;
use super::output::{build_output_stream, StreamFault};
use super::types::{NativeAudioEvent, NativeAudioSnapshot};

const RING_CAPACITY: usize = 48_000 * 2 * 4;
const TIME_TICK_MS: u64 = 33;
const IMMEDIATE_PLAY_SAMPLES: u64 = 1024;
const UNDERRUN_EMIT_THRESHOLD: u32 = 3;
const UNDERRUN_REBUILD_THRESHOLD: u32 = 15;
const STALLED_OUTPUT_REBUILD_TICKS: u32 = 30;
const OUTPUT_REBUILD_COOLDOWN_MS: u64 = 2_000;
const XRUN_BURST_RESET_MS: u64 = 1_000;
const DEVICE_BUSY_RETRY_DELAY_MS: u64 = 500;
const DEVICE_BUSY_MAX_RETRIES: u32 = 3;
const PREFERRED_OUTPUT_RATE: u32 = 48_000;

#[derive(Default)]
pub struct NativeAudioState {
    inner: Mutex<Option<PlayerHandle>>,
}

impl NativeAudioState {
    pub fn stop(&self) {
        if let Ok(mut g) = self.inner.lock() {
            if let Some(handle) = g.take() {
                handle.stop();
            }
        }
    }

    pub(crate) fn replace(&self, handle: PlayerHandle) -> Result<(), String> {
        let mut g = self
            .inner
            .lock()
            .map_err(|_| "native audio state poisoned".to_string())?;
        if let Some(prev) = g.take() {
            prev.stop();
        }
        *g = Some(handle);
        Ok(())
    }

    pub(crate) fn with_player<R>(
        &self,
        f: impl FnOnce(&PlayerHandle) -> Result<R, String>,
    ) -> Result<R, String> {
        let g = self
            .inner
            .lock()
            .map_err(|_| "native audio state poisoned".to_string())?;
        let handle = g.as_ref().ok_or_else(|| "未加载音频".to_string())?;
        f(handle)
    }
}

enum EngineCmd {
    Play,
    Pause,
    Seek(f64),
    SetRate(f32),
    Stop,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EngineState {
    Loaded,
    Playing,
    Paused,
    Ended,
}

/// Send-safe handle: no CPAL Stream inside.
pub(crate) struct PlayerHandle {
    path: PathBuf,
    clock: Arc<SharedClock>,
    cmd_tx: Sender<EngineCmd>,
    engine_join: Mutex<Option<JoinHandle<()>>>,
}

impl PlayerHandle {
    pub(crate) fn open(
        path: PathBuf,
        duration_hint_sec: f64,
        on_event: Channel<NativeAudioEvent>,
    ) -> Result<Self, String> {
        let probed = probe_duration_sec(&path).unwrap_or(0.0);
        // Prefer the longer of layout hint vs probed so a short hint cannot
        // auto-stop playback after a fraction of a second.
        let duration_sec = match (duration_hint_sec > 0.0, probed > 0.0) {
            (true, true) => duration_hint_sec.max(probed),
            (true, false) => duration_hint_sec,
            (false, true) => probed,
            (false, false) => 0.0,
        };

        let (cmd_tx, cmd_rx) = mpsc::channel::<EngineCmd>();
        let (ready_tx, ready_rx) = mpsc::channel::<Result<Arc<SharedClock>, String>>();
        let path_eng = path.clone();
        let events = EventEmitter::new(on_event);

        let engine_join = thread::Builder::new()
            .name("native-audio-engine".into())
            .spawn(move || engine_main(path_eng, duration_sec, cmd_rx, ready_tx, events))
            .map_err(|e| format!("启动音频引擎线程失败: {e}"))?;

        let clock = ready_rx
            .recv_timeout(Duration::from_secs(30))
            .map_err(|_| "音频引擎启动超时".to_string())??;

        Ok(Self {
            path,
            clock,
            cmd_tx,
            engine_join: Mutex::new(Some(engine_join)),
        })
    }

    pub(crate) fn play(&self) -> Result<(), String> {
        self.cmd_tx
            .send(EngineCmd::Play)
            .map_err(|_| "音频引擎已停止".to_string())
    }

    pub(crate) fn pause(&self) -> Result<(), String> {
        self.cmd_tx
            .send(EngineCmd::Pause)
            .map_err(|_| "音频引擎已停止".to_string())
    }

    pub(crate) fn seek(&self, time_sec: f64) -> Result<(), String> {
        self.cmd_tx
            .send(EngineCmd::Seek(time_sec))
            .map_err(|_| "音频引擎已停止".to_string())
    }

    pub(crate) fn set_rate(&self, rate: f32) -> Result<(), String> {
        self.cmd_tx
            .send(EngineCmd::SetRate(rate))
            .map_err(|_| "音频引擎已停止".to_string())
    }

    pub(crate) fn snapshot(&self) -> NativeAudioSnapshot {
        NativeAudioSnapshot {
            playing: self.clock.playing.load(Ordering::Relaxed),
            current_time_sec: self.clock.current_time_sec(),
            duration_sec: self.clock.duration_sec(),
            rate: self.clock.rate(),
            path: self.path.display().to_string(),
        }
    }

    pub(crate) fn stop(self) {
        let _ = self.cmd_tx.send(EngineCmd::Stop);
        if let Ok(mut g) = self.engine_join.lock() {
            if let Some(h) = g.take() {
                let _ = h.join();
            }
        }
    }
}

struct OutputBundle {
    /// Kept alive so CPAL keeps calling the output callback.
    #[allow(dead_code)]
    stream: Stream,
}

struct PendingDeviceBusyRetry {
    message: String,
    attempts_remaining: u32,
    next_at: Instant,
    was_playing: bool,
}

fn open_default_output(
    clock: &Arc<SharedClock>,
    fault_tx: Sender<StreamFault>,
) -> Result<(cpal::Device, OutputBundle, HeapProd<f32>), String> {
    let host = cpal::default_host();
    let device = host
        .default_output_device()
        .ok_or_else(|| "无可用音频输出设备".to_string())?;
    let (sample_format, config) = pick_preferred_output_config(&device)?;
    let out_rate = config.sample_rate;
    let out_channels = config.channels as u32;
    clock
        .output_sample_rate
        .store(out_rate.max(1), Ordering::SeqCst);
    clock
        .output_channels
        .store(out_channels.max(1), Ordering::SeqCst);

    let rb = HeapRb::<f32>::new(RING_CAPACITY);
    let (prod, cons) = rb.split();
    let stream = build_output_stream(
        &device,
        sample_format,
        config,
        Arc::clone(clock),
        cons,
        fault_tx,
    )?;
    stream
        .play()
        .map_err(|e| format!("启动音频输出失败: {e}"))?;
    Ok((device, OutputBundle { stream }, prod))
}

fn rebuild_output_stream(
    clock: &Arc<SharedClock>,
    prod_tx: &Sender<HeapProd<f32>>,
    fault_tx: Sender<StreamFault>,
    was_playing: bool,
) -> Result<OutputBundle, String> {
    // Caller drops the previous Stream (and its consumer). A fresh ring has no
    // stale PCM to flush — only force decode to re-seek and re-prebuffer.
    clock.buffer_ready.store(false, Ordering::SeqCst);
    clock.queued_samples.store(0, Ordering::SeqCst);
    clock.seek_seq.fetch_add(1, Ordering::SeqCst);

    let (_device, bundle, prod) = open_default_output(clock, fault_tx)?;
    prod_tx
        .send(prod)
        .map_err(|_| "解码线程已停止，无法交接 producer".to_string())?;
    if was_playing || clock.play_requested.load(Ordering::Relaxed) {
        clock.play_requested.store(true, Ordering::SeqCst);
        // Resume once decode re-prebuffers into the new ring.
        clock.playing.store(false, Ordering::SeqCst);
    }
    Ok(bundle)
}

/// Prefer F32 so OS/mixer owns integer/24-bit conversion; avoid I24 endian traps.
fn pick_preferred_output_config(
    device: &cpal::Device,
) -> Result<(SampleFormat, StreamConfig), String> {
    let default = device
        .default_output_config()
        .map_err(|e| format!("读取输出配置失败: {e}"))?;
    let target_rate = if default.sample_rate() > 0 {
        default.sample_rate()
    } else {
        PREFERRED_OUTPUT_RATE
    };

    if let Ok(ranges) = device.supported_output_configs() {
        let mut best: Option<(i64, SupportedStreamConfig)> = None;
        for range in ranges {
            if range.sample_format() != SampleFormat::F32 {
                continue;
            }
            let rate = target_rate.clamp(range.min_sample_rate(), range.max_sample_rate());
            let supported = range.with_sample_rate(rate);
            let score =
                score_output_config(supported.channels(), supported.sample_rate(), target_rate);
            match best {
                Some((best_score, _)) if score <= best_score => {}
                _ => best = Some((score, supported)),
            }
        }
        if let Some((_, supported)) = best {
            return Ok((SampleFormat::F32, supported.into()));
        }
    }

    let sample_format = default.sample_format();
    match sample_format {
        SampleFormat::F32 | SampleFormat::I16 | SampleFormat::U16 => {
            Ok((sample_format, default.into()))
        }
        other => Err(format!("无可用的 F32/I16/U16 输出格式（默认: {other:?}）")),
    }
}

fn score_output_config(channels: u16, sample_rate: u32, target_rate: u32) -> i64 {
    let channel_score = match channels {
        2 => 1_000_000,
        1 => 500_000,
        n => 100_000 - i64::from(n) * 1_000,
    };
    let rate_penalty = (i64::from(sample_rate) - i64::from(target_rate)).abs();
    channel_score - rate_penalty
}

#[cfg(test)]
mod tests {
    use super::score_output_config;

    #[test]
    fn score_output_config_prefers_stereo_near_target_rate() {
        let stereo_48k = score_output_config(2, 48_000, 48_000);
        let mono_48k = score_output_config(1, 48_000, 48_000);
        let stereo_44k = score_output_config(2, 44_100, 48_000);
        assert!(stereo_48k > mono_48k);
        assert!(stereo_48k > stereo_44k);
    }
}

fn engine_main(
    path: PathBuf,
    duration_sec: f64,
    cmd_rx: Receiver<EngineCmd>,
    ready_tx: Sender<Result<Arc<SharedClock>, String>>,
    events: EventEmitter,
) {
    let (fault_tx, fault_rx) = mpsc::channel::<StreamFault>();
    let clock = Arc::new(SharedClock::new(duration_sec, 48_000, 2));

    let (_device, output, prod) = match open_default_output(&clock, fault_tx.clone()) {
        Ok(v) => v,
        Err(msg) => {
            events.emit(NativeAudioEvent::Error {
                message: msg.clone(),
            });
            let _ = ready_tx.send(Err(msg));
            return;
        }
    };
    let mut output: Option<OutputBundle> = Some(output);

    let _ = ready_tx.send(Ok(Arc::clone(&clock)));
    events.emit(NativeAudioEvent::Ready {
        duration_sec: clock.duration_sec(),
    });

    let (prod_tx, prod_rx) = mpsc::channel::<HeapProd<f32>>();
    let clock_dec = Arc::clone(&clock);
    let path_dec = path.clone();
    let events_dec = events.clone();
    let out_rate = clock.output_sample_rate.load(Ordering::Relaxed);
    let out_channels = clock.output_channels.load(Ordering::Relaxed);
    let decode_join = thread::Builder::new()
        .name("native-audio-decode".into())
        .spawn(move || {
            decode_loop(
                path_dec,
                clock_dec,
                prod,
                prod_rx,
                out_rate,
                out_channels,
                events_dec,
            )
        })
        .ok();

    let mut state = EngineState::Loaded;
    let mut last_emitted_playing = false;
    let mut last_time_tick = Instant::now();
    let mut last_output_rebuild_at: Option<Instant> = None;
    let mut consecutive_soft_underruns: u32 = 0;
    let mut consecutive_xruns: u32 = 0;
    let mut last_xrun_at: Option<Instant> = None;
    let mut pending_device_busy_retry: Option<PendingDeviceBusyRetry> = None;
    let mut last_progress_pos_us = 0u64;
    let mut stalled_output_ticks: u32 = 0;

    loop {
        // Drain CPAL faults before processing commands so DeviceChanged /
        // StreamInvalidated do not sit behind a play/pause.
        while let Ok(fault) = fault_rx.try_recv() {
            match fault {
                StreamFault::DeviceChanged(message)
                | StreamFault::StreamInvalidated(message)
                | StreamFault::DeviceNotAvailable(message) => {
                    let was_playing = clock.playing.load(Ordering::Relaxed)
                        || clock.play_requested.load(Ordering::Relaxed);
                    // Drop the old stream before rebuilding so the device can reopen.
                    output = None;
                    match rebuild_output_stream(&clock, &prod_tx, fault_tx.clone(), was_playing) {
                        Ok(bundle) => {
                            output = Some(bundle);
                            pending_device_busy_retry = None;
                            events.emit(NativeAudioEvent::DeviceChanged {
                                message: format!("output rebuilt after: {message}"),
                            });
                            if was_playing {
                                last_emitted_playing = false;
                            }
                        }
                        Err(err) => {
                            clock.play_requested.store(false, Ordering::SeqCst);
                            clock.playing.store(false, Ordering::SeqCst);
                            clock.drain_pending.store(false, Ordering::SeqCst);
                            last_emitted_playing = false;
                            state = EngineState::Paused;
                            events.emit(NativeAudioEvent::Error {
                                message: format!("输出设备失效且重建失败: {err} ({message})"),
                            });
                        }
                    }
                }
                StreamFault::DeviceBusy(message) => {
                    let was_playing = clock.playing.load(Ordering::Relaxed)
                        || clock.play_requested.load(Ordering::Relaxed);
                    output = None;
                    match rebuild_output_stream(&clock, &prod_tx, fault_tx.clone(), was_playing) {
                        Ok(bundle) => {
                            output = Some(bundle);
                            last_output_rebuild_at = Some(Instant::now());
                            pending_device_busy_retry = None;
                            events.emit(NativeAudioEvent::DeviceChanged {
                                message: format!("output rebuilt after device busy: {message}"),
                            });
                            if was_playing {
                                last_emitted_playing = false;
                            }
                        }
                        Err(err) => {
                            eprintln!("native_audio: device busy rebuild failed: {err}");
                            pending_device_busy_retry = Some(PendingDeviceBusyRetry {
                                message,
                                attempts_remaining: DEVICE_BUSY_MAX_RETRIES,
                                next_at: Instant::now()
                                    + Duration::from_millis(DEVICE_BUSY_RETRY_DELAY_MS),
                                was_playing,
                            });
                        }
                    }
                }
                StreamFault::PermissionDenied(message) => {
                    clock.play_requested.store(false, Ordering::SeqCst);
                    clock.playing.store(false, Ordering::SeqCst);
                    last_emitted_playing = false;
                    state = EngineState::Paused;
                    events.emit(NativeAudioEvent::Error {
                        message: format!("音频输出权限被拒绝: {message}"),
                    });
                }
                StreamFault::Xrun(message) => {
                    if pending_device_busy_retry.is_some() {
                        continue;
                    }
                    let now = Instant::now();
                    if last_xrun_at
                        .map(|t| t.elapsed() > Duration::from_millis(XRUN_BURST_RESET_MS))
                        .unwrap_or(false)
                    {
                        consecutive_xruns = 0;
                    }
                    last_xrun_at = Some(now);
                    consecutive_xruns = consecutive_xruns.saturating_add(1);
                    if consecutive_xruns >= UNDERRUN_EMIT_THRESHOLD
                        && !clock.underrun_reported.swap(true, Ordering::Relaxed)
                    {
                        eprintln!("native_audio: cpal xrun: {message}");
                        events.emit(NativeAudioEvent::Underrun {
                            consecutive: consecutive_xruns,
                        });
                    }
                    let can_rebuild = last_output_rebuild_at
                        .map(|t| t.elapsed() >= Duration::from_millis(OUTPUT_REBUILD_COOLDOWN_MS))
                        .unwrap_or(true);
                    if consecutive_xruns >= UNDERRUN_REBUILD_THRESHOLD
                        && can_rebuild
                        && (clock.playing.load(Ordering::Relaxed)
                            || clock.play_requested.load(Ordering::Relaxed))
                        && !clock.at_eof.load(Ordering::Relaxed)
                    {
                        let was_playing = true;
                        output = None;
                        match rebuild_output_stream(&clock, &prod_tx, fault_tx.clone(), was_playing)
                        {
                            Ok(bundle) => {
                                output = Some(bundle);
                                last_output_rebuild_at = Some(Instant::now());
                                consecutive_xruns = 0;
                                clock.underrun_reported.store(false, Ordering::Relaxed);
                                events.emit(NativeAudioEvent::DeviceChanged {
                                    message: format!(
                                        "output rebuilt after sustained xrun: {message}"
                                    ),
                                });
                                last_emitted_playing = false;
                            }
                            Err(err) => {
                                clock.play_requested.store(false, Ordering::SeqCst);
                                clock.playing.store(false, Ordering::SeqCst);
                                clock.drain_pending.store(false, Ordering::SeqCst);
                                last_emitted_playing = false;
                                state = EngineState::Paused;
                                events.emit(NativeAudioEvent::Error {
                                    message: format!("持续 xrun 后输出重建失败: {err} ({message})"),
                                });
                            }
                        }
                    }
                }
                StreamFault::Other(message) => {
                    eprintln!("native_audio cpal error: {message}");
                }
            }
        }

        let timed = cmd_rx.recv_timeout(Duration::from_millis(TIME_TICK_MS));
        match timed {
            Ok(EngineCmd::Play) => {
                if clock.at_eof.swap(false, Ordering::SeqCst) {
                    clock.buffer_ready.store(false, Ordering::SeqCst);
                    clock.queued_samples.store(0, Ordering::SeqCst);
                    clock.drain_pending.store(true, Ordering::SeqCst);
                    clock.drain_seq.fetch_add(1, Ordering::SeqCst);
                    clock.seek_seq.fetch_add(1, Ordering::SeqCst);
                }
                clock.underrun_reported.store(false, Ordering::Relaxed);
                consecutive_soft_underruns = 0;
                consecutive_xruns = 0;
                clock.play_requested.store(true, Ordering::SeqCst);
                if clock.buffer_ready.load(Ordering::Relaxed)
                    || clock.queued_samples.load(Ordering::Relaxed) >= IMMEDIATE_PLAY_SAMPLES
                {
                    clock.playing.store(true, Ordering::SeqCst);
                    state = EngineState::Playing;
                    if !last_emitted_playing {
                        events.emit(NativeAudioEvent::Playing);
                        last_emitted_playing = true;
                    }
                }
            }
            Ok(EngineCmd::Pause) => {
                clock.play_requested.store(false, Ordering::SeqCst);
                clock.playing.store(false, Ordering::SeqCst);
                if let Some(retry) = pending_device_busy_retry.as_mut() {
                    retry.was_playing = false;
                }
                if state != EngineState::Ended {
                    state = EngineState::Paused;
                    if last_emitted_playing {
                        events.emit(NativeAudioEvent::Paused);
                        last_emitted_playing = false;
                    }
                }
            }
            Ok(EngineCmd::Seek(t)) => {
                let dur = clock.duration_sec();
                let clamped = t.clamp(0.0, dur.max(0.0));
                clock
                    .position_us
                    .store((clamped * 1_000_000.0) as u64, Ordering::SeqCst);
                clock.at_eof.store(false, Ordering::SeqCst);
                clock.buffer_ready.store(false, Ordering::SeqCst);
                clock.underrun_reported.store(false, Ordering::Relaxed);
                consecutive_soft_underruns = 0;
                consecutive_xruns = 0;
                clock.queued_samples.store(0, Ordering::SeqCst);
                clock.drain_pending.store(true, Ordering::SeqCst);
                clock.drain_seq.fetch_add(1, Ordering::SeqCst);
                clock.seek_seq.fetch_add(1, Ordering::SeqCst);
                if state == EngineState::Ended {
                    state = if clock.playing.load(Ordering::Relaxed) {
                        EngineState::Playing
                    } else {
                        EngineState::Paused
                    };
                }
                events.emit(NativeAudioEvent::Seeked { sec: clamped });
                events.emit(NativeAudioEvent::TimeUpdate { sec: clamped });
            }
            Ok(EngineCmd::SetRate(rate)) => {
                let r = rate.clamp(0.25, 3.0);
                clock
                    .rate_milli
                    .store((r * 1000.0) as u32, Ordering::SeqCst);
            }
            Ok(EngineCmd::Stop) => {
                clock.play_requested.store(false, Ordering::SeqCst);
                clock.playing.store(false, Ordering::SeqCst);
                clock.stop.store(true, Ordering::SeqCst);
                clock.seek_seq.fetch_add(1, Ordering::SeqCst);
                break;
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                let now = Instant::now();
                let mut playing_now = clock.playing.load(Ordering::Relaxed);
                let mut play_requested = clock.play_requested.load(Ordering::Relaxed);
                let at_eof = clock.at_eof.load(Ordering::Relaxed);
                if pending_device_busy_retry
                    .as_ref()
                    .map(|retry| now >= retry.next_at)
                    .unwrap_or(false)
                {
                    let mut retry = pending_device_busy_retry
                        .take()
                        .expect("checked pending retry above");
                    output = None;
                    match rebuild_output_stream(
                        &clock,
                        &prod_tx,
                        fault_tx.clone(),
                        retry.was_playing || play_requested,
                    ) {
                        Ok(bundle) => {
                            output = Some(bundle);
                            last_output_rebuild_at = Some(now);
                            events.emit(NativeAudioEvent::DeviceChanged {
                                message: format!(
                                    "output rebuilt after device busy retry: {}",
                                    retry.message
                                ),
                            });
                            if retry.was_playing || play_requested {
                                last_emitted_playing = false;
                            }
                        }
                        Err(err) if retry.attempts_remaining > 1 => {
                            retry.attempts_remaining -= 1;
                            retry.next_at = now + Duration::from_millis(DEVICE_BUSY_RETRY_DELAY_MS);
                            eprintln!("native_audio: device busy retry failed: {err}");
                            pending_device_busy_retry = Some(retry);
                        }
                        Err(err) => {
                            clock.play_requested.store(false, Ordering::SeqCst);
                            clock.playing.store(false, Ordering::SeqCst);
                            clock.drain_pending.store(false, Ordering::SeqCst);
                            last_emitted_playing = false;
                            state = EngineState::Paused;
                            events.emit(NativeAudioEvent::Error {
                                message: format!("输出设备忙且重试失败: {err} ({})", retry.message),
                            });
                        }
                    }
                    playing_now = clock.playing.load(Ordering::Relaxed);
                    play_requested = clock.play_requested.load(Ordering::Relaxed);
                }

                if clock.underrun.swap(false, Ordering::Relaxed) {
                    consecutive_soft_underruns = consecutive_soft_underruns.saturating_add(1);
                    if consecutive_soft_underruns == UNDERRUN_EMIT_THRESHOLD
                        && !clock.underrun_reported.swap(true, Ordering::Relaxed)
                    {
                        eprintln!("native_audio: output underrun");
                        events.emit(NativeAudioEvent::Underrun {
                            consecutive: consecutive_soft_underruns,
                        });
                    }
                    let can_rebuild = last_output_rebuild_at
                        .map(|t| t.elapsed() >= Duration::from_millis(OUTPUT_REBUILD_COOLDOWN_MS))
                        .unwrap_or(true);
                    if consecutive_soft_underruns >= UNDERRUN_REBUILD_THRESHOLD
                        && can_rebuild
                        && (playing_now || play_requested)
                        && !at_eof
                    {
                        output = None;
                        match rebuild_output_stream(
                            &clock,
                            &prod_tx,
                            fault_tx.clone(),
                            playing_now || play_requested,
                        ) {
                            Ok(bundle) => {
                                output = Some(bundle);
                                last_output_rebuild_at = Some(Instant::now());
                                consecutive_soft_underruns = 0;
                                clock.underrun_reported.store(false, Ordering::Relaxed);
                                events.emit(NativeAudioEvent::DeviceChanged {
                                    message: "output rebuilt after sustained underrun".into(),
                                });
                                last_emitted_playing = false;
                            }
                            Err(err) => {
                                clock.play_requested.store(false, Ordering::SeqCst);
                                clock.playing.store(false, Ordering::SeqCst);
                                clock.drain_pending.store(false, Ordering::SeqCst);
                                last_emitted_playing = false;
                                state = EngineState::Paused;
                                events.emit(NativeAudioEvent::Error {
                                    message: format!("持续 underrun 后输出重建失败: {err}"),
                                });
                            }
                        }
                    }
                } else {
                    consecutive_soft_underruns = 0;
                }

                let pos = clock.current_time_sec();
                let dur = clock.duration_sec();
                let pos_us = clock.position_us.load(Ordering::Relaxed);
                let queued = clock.queued_samples.load(Ordering::Relaxed);

                if playing_now && !at_eof && queued > IMMEDIATE_PLAY_SAMPLES {
                    if pos_us == last_progress_pos_us {
                        stalled_output_ticks = stalled_output_ticks.saturating_add(1);
                    } else {
                        stalled_output_ticks = 0;
                        last_progress_pos_us = pos_us;
                    }
                    let can_rebuild = last_output_rebuild_at
                        .map(|t| t.elapsed() >= Duration::from_millis(OUTPUT_REBUILD_COOLDOWN_MS))
                        .unwrap_or(true);
                    if stalled_output_ticks >= STALLED_OUTPUT_REBUILD_TICKS && can_rebuild {
                        output = None;
                        match rebuild_output_stream(&clock, &prod_tx, fault_tx.clone(), true) {
                            Ok(bundle) => {
                                output = Some(bundle);
                                last_output_rebuild_at = Some(Instant::now());
                                stalled_output_ticks = 0;
                                last_progress_pos_us = clock.position_us.load(Ordering::Relaxed);
                                events.emit(NativeAudioEvent::DeviceChanged {
                                    message: "output rebuilt after stalled playback clock".into(),
                                });
                                last_emitted_playing = false;
                            }
                            Err(err) => {
                                clock.play_requested.store(false, Ordering::SeqCst);
                                clock.playing.store(false, Ordering::SeqCst);
                                clock.drain_pending.store(false, Ordering::SeqCst);
                                last_emitted_playing = false;
                                state = EngineState::Paused;
                                events.emit(NativeAudioEvent::Error {
                                    message: format!("播放时钟停滞后输出重建失败: {err}"),
                                });
                            }
                        }
                    }
                } else {
                    stalled_output_ticks = 0;
                    last_progress_pos_us = pos_us;
                }

                if play_requested && !playing_now && clock.buffer_ready.load(Ordering::Relaxed) {
                    clock.playing.store(true, Ordering::SeqCst);
                    state = EngineState::Playing;
                    if !last_emitted_playing {
                        events.emit(NativeAudioEvent::Playing);
                        last_emitted_playing = true;
                    }
                } else if last_emitted_playing && !playing_now {
                    last_emitted_playing = false;
                    if at_eof || (dur > 0.0 && pos >= dur - 0.02) {
                        state = EngineState::Ended;
                        events.emit(NativeAudioEvent::TimeUpdate { sec: pos.min(dur) });
                        events.emit(NativeAudioEvent::Ended);
                    } else {
                        state = EngineState::Paused;
                        events.emit(NativeAudioEvent::Paused);
                    }
                } else if playing_now
                    && state == EngineState::Playing
                    && last_time_tick.elapsed() >= Duration::from_millis(TIME_TICK_MS)
                {
                    last_time_tick = Instant::now();
                    events.emit(NativeAudioEvent::TimeUpdate { sec: pos });
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    clock.stop.store(true, Ordering::SeqCst);
    if let Some(h) = decode_join {
        let _ = h.join();
    }
    drop(output);
}

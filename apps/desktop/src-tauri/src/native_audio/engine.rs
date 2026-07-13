//! CPAL engine thread + PlayerHandle command plane.
//! Consumer is moved into the CPAL callback (no Mutex). Producer lives on decode.

use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::StreamConfig;
use ringbuf::traits::Split;
use ringbuf::HeapRb;
use tauri::ipc::Channel;

use super::clock::SharedClock;
use super::decode::{decode_loop, probe_duration_sec};
use super::events::EventEmitter;
use super::output::build_output_stream;
use super::types::{NativeAudioEvent, NativeAudioSnapshot};

const RING_CAPACITY: usize = 48_000 * 2 * 4;
const TIME_TICK_MS: u64 = 33;
const IMMEDIATE_PLAY_SAMPLES: u64 = 1024;

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

fn engine_main(
    path: PathBuf,
    duration_sec: f64,
    cmd_rx: Receiver<EngineCmd>,
    ready_tx: Sender<Result<Arc<SharedClock>, String>>,
    events: EventEmitter,
) {
    let host = cpal::default_host();
    let device = match host.default_output_device() {
        Some(d) => d,
        None => {
            let msg = "无可用音频输出设备".to_string();
            events.emit(NativeAudioEvent::Error {
                message: msg.clone(),
            });
            let _ = ready_tx.send(Err(msg));
            return;
        }
    };
    let supported = match device.default_output_config() {
        Ok(c) => c,
        Err(e) => {
            let msg = format!("读取输出配置失败: {e}");
            events.emit(NativeAudioEvent::Error {
                message: msg.clone(),
            });
            let _ = ready_tx.send(Err(msg));
            return;
        }
    };
    let sample_format = supported.sample_format();
    let config: StreamConfig = supported.into();
    let out_rate = config.sample_rate.0;
    let out_channels = config.channels as u32;

    let clock = Arc::new(SharedClock::new(duration_sec, out_rate, out_channels));
    let rb = HeapRb::<f32>::new(RING_CAPACITY);
    let (prod, cons) = rb.split();

    // Move Consumer into the callback — SPSC, no Mutex on the RT path.
    let stream = match build_output_stream(&device, sample_format, &config, Arc::clone(&clock), cons)
    {
        Ok(s) => s,
        Err(msg) => {
            events.emit(NativeAudioEvent::Error {
                message: msg.clone(),
            });
            let _ = ready_tx.send(Err(msg));
            return;
        }
    };
    if let Err(e) = stream.play() {
        let msg = format!("启动音频输出失败: {e}");
        events.emit(NativeAudioEvent::Error {
            message: msg.clone(),
        });
        let _ = ready_tx.send(Err(msg));
        return;
    }

    let _ = ready_tx.send(Ok(Arc::clone(&clock)));
    events.emit(NativeAudioEvent::Ready {
        duration_sec: clock.duration_sec(),
    });

    let clock_dec = Arc::clone(&clock);
    let path_dec = path.clone();
    let events_dec = events.clone();
    let decode_join = thread::Builder::new()
        .name("native-audio-decode".into())
        .spawn(move || decode_loop(path_dec, clock_dec, prod, out_rate, out_channels, events_dec))
        .ok();

    let mut state = EngineState::Loaded;
    let mut last_emitted_playing = false;
    let mut last_time_tick = std::time::Instant::now();

    loop {
        let timed = cmd_rx.recv_timeout(Duration::from_millis(TIME_TICK_MS));
        match timed {
            Ok(EngineCmd::Play) => {
                if clock.at_eof.swap(false, Ordering::SeqCst) {
                    clock.buffer_ready.store(false, Ordering::SeqCst);
                    clock.queued_samples.store(0, Ordering::SeqCst);
                    clock.drain_seq.fetch_add(1, Ordering::SeqCst);
                    clock.seek_seq.fetch_add(1, Ordering::SeqCst);
                }
                clock.underrun_reported.store(false, Ordering::Relaxed);
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
                clock.queued_samples.store(0, Ordering::SeqCst);
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
                // Soft underrun telemetry (non-fatal).
                if clock.underrun.swap(false, Ordering::Relaxed)
                    && !clock.underrun_reported.swap(true, Ordering::Relaxed)
                {
                    eprintln!("native_audio: output underrun");
                }

                let playing_now = clock.playing.load(Ordering::Relaxed);
                let play_requested = clock.play_requested.load(Ordering::Relaxed);
                let at_eof = clock.at_eof.load(Ordering::Relaxed);
                let pos = clock.current_time_sec();
                let dur = clock.duration_sec();

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
                    last_time_tick = std::time::Instant::now();
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
    drop(stream);
}

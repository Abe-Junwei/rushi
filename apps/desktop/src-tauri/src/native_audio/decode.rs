//! Symphonia demux/decode → ringbuf producer (owned by decode thread).

use std::fs::File;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::mpsc::Receiver;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use ringbuf::traits::{Observer, Producer};
use ringbuf::HeapProd;
use symphonia::core::codecs::audio::{AudioDecoder, AudioDecoderOptions};
use symphonia::core::errors::Error as SymError;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::{FormatOptions, FormatReader, SeekMode, SeekTo, TrackType};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::units::Time;

use super::clock::SharedClock;
use super::events::EventEmitter;
use super::tempo::{PitchPreservingTempo, TEMPO_RATE_EPSILON};
use super::types::NativeAudioEvent;

pub(crate) const PREBUFFER_MS: u64 = 120;

pub(crate) fn probe_duration_sec(path: &Path) -> Result<f64, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let format = symphonia::default::get_probe()
        .probe(
            &hint,
            mss,
            FormatOptions::default(),
            MetadataOptions::default(),
        )
        .map_err(|e| e.to_string())?;
    let track = format
        .default_track(TrackType::Audio)
        .ok_or_else(|| "no audio track".to_string())?;
    let sr = track
        .codec_params
        .as_ref()
        .and_then(|p| p.audio())
        .and_then(|a| a.sample_rate)
        .unwrap_or(1);
    if let Some(n) = track.num_frames {
        return Ok(n as f64 / sr as f64);
    }
    Ok(0.0)
}

fn compute_prebuffer_samples(clock: &SharedClock, out_rate: u32, out_channels: u32) -> u64 {
    let channels = out_channels.max(1) as u64;
    let rate = out_rate.max(1) as u64;
    let prebuffer_target_samples = ((rate * channels * PREBUFFER_MS) / 1000).max(1024);
    let duration_samples =
        (clock.duration_us.load(Ordering::Relaxed) * rate * channels) / 1_000_000;
    if duration_samples > 0 {
        prebuffer_target_samples.min(duration_samples.max(1))
    } else {
        prebuffer_target_samples
    }
}

#[inline]
fn sanitize_pcm_sample(sample: f32) -> f32 {
    if sample.is_finite() {
        sample.clamp(-1.0, 1.0)
    } else {
        0.0
    }
}

fn append_frame_with_output_channels(frame: &[f32], out_channels: usize, out: &mut Vec<f32>) {
    let out_channels = out_channels.max(1);
    if out_channels == 1 {
        let mono = if frame.is_empty() {
            0.0
        } else {
            frame.iter().sum::<f32>() / frame.len() as f32
        };
        out.push(sanitize_pcm_sample(mono));
        return;
    }

    for ch in 0..out_channels {
        let sample = if frame.is_empty() {
            0.0
        } else if frame.len() == 1 {
            frame[0]
        } else {
            frame[ch.min(frame.len() - 1)]
        };
        out.push(sanitize_pcm_sample(sample));
    }
}

fn make_decoder(
    params: &symphonia::core::codecs::audio::AudioCodecParameters,
) -> Result<Box<dyn AudioDecoder>, String> {
    symphonia::default::get_codecs()
        .make_audio_decoder(params, &AudioDecoderOptions::default())
        .map_err(|e| format!("创建解码器失败: {e}"))
}

fn open_format(path: &Path) -> Result<(Box<dyn FormatReader>, u32, u32), String> {
    let file = File::open(path).map_err(|e| format!("打开音频失败: {e}"))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let format = symphonia::default::get_probe()
        .probe(
            &hint,
            mss,
            FormatOptions::default(),
            MetadataOptions::default(),
        )
        .map_err(|e| format!("探测音频失败: {e}"))?;
    let track = format
        .default_track(TrackType::Audio)
        .ok_or_else(|| "音频无可用轨道".to_string())?;
    let track_id = track.id;
    let audio = track
        .codec_params
        .as_ref()
        .and_then(|p| p.audio())
        .ok_or_else(|| "无法读取编解码参数".to_string())?
        .clone();
    let sample_rate = audio
        .sample_rate
        .ok_or_else(|| "无法读取采样率".to_string())?;
    Ok((format, track_id, sample_rate))
}

fn seek_format(
    format: &mut Box<dyn FormatReader>,
    decoder: &mut Box<dyn AudioDecoder>,
    track_id: u32,
    time_sec: f64,
) -> Result<(), String> {
    let ms = (time_sec.max(0.0) * 1000.0) as u64;
    let time = Time::from_millis_u64(ms);
    format
        .seek(
            SeekMode::Accurate,
            SeekTo::Time {
                time,
                track_id: Some(track_id),
            },
        )
        .map_err(|e| format!("seek 失败: {e}"))?;
    decoder.reset();
    Ok(())
}

pub(crate) fn decode_loop(
    path: PathBuf,
    clock: Arc<SharedClock>,
    mut prod: HeapProd<f32>,
    prod_rx: Receiver<HeapProd<f32>>,
    mut out_rate: u32,
    mut out_channels: u32,
    events: EventEmitter,
) {
    let mut prebuffer_samples = compute_prebuffer_samples(&clock, out_rate, out_channels);
    let (mut format, track_id, src_rate) = match open_format(&path) {
        Ok(v) => v,
        Err(msg) => {
            events.emit(NativeAudioEvent::Error { message: msg });
            return;
        }
    };
    let Some(track) = format.tracks().iter().find(|t| t.id == track_id) else {
        events.emit(NativeAudioEvent::Error {
            message: "音频轨道丢失".into(),
        });
        return;
    };
    let Some(audio_params) = track.codec_params.as_ref().and_then(|p| p.audio()).cloned() else {
        events.emit(NativeAudioEvent::Error {
            message: "无法读取编解码参数".into(),
        });
        return;
    };
    let mut decoder = match make_decoder(&audio_params) {
        Ok(d) => d,
        Err(msg) => {
            events.emit(NativeAudioEvent::Error { message: msg });
            return;
        }
    };

    let mut last_seek_seq = clock.seek_seq.load(Ordering::SeqCst);
    let mut last_rate_seq = clock.rate_seq.load(Ordering::SeqCst);
    let mut src_phase: f64 = 0.0;
    let mut pending: Vec<f32> = Vec::new();
    let mut tempo = PitchPreservingTempo::new(out_rate, out_channels, clock.rate());
    let mut tempo_resampled = Vec::with_capacity(2048);
    let mut was_pitch_preserving = false;

    let start = clock.current_time_sec();
    if start > 0.02 {
        let _ = seek_format(&mut format, &mut decoder, track_id, start);
    }

    while !clock.stop.load(Ordering::Relaxed) {
        // Output-stream rebuild hands a fresh producer while keeping decode state.
        while let Ok(next) = prod_rx.try_recv() {
            prod = next;
            clock.queued_samples.store(0, Ordering::SeqCst);
            clock.buffer_ready.store(false, Ordering::SeqCst);
            out_rate = clock.output_sample_rate.load(Ordering::Relaxed).max(1);
            out_channels = clock.output_channels.load(Ordering::Relaxed).max(1);
            prebuffer_samples = compute_prebuffer_samples(&clock, out_rate, out_channels);
            // Channel/rate layout is baked into tempo grain sizes — recreate on handoff.
            tempo = PitchPreservingTempo::new(out_rate, out_channels, clock.rate());
            was_pitch_preserving = false;
            last_rate_seq = clock.rate_seq.load(Ordering::SeqCst);
        }

        let rate_seq = clock.rate_seq.load(Ordering::SeqCst);
        if rate_seq != last_rate_seq {
            last_rate_seq = rate_seq;
            tempo.reset();
            tempo_resampled.clear();
            was_pitch_preserving = false;
        }

        let seek_seq = clock.seek_seq.load(Ordering::SeqCst);
        if seek_seq != last_seek_seq {
            last_seek_seq = seek_seq;
            pending.clear();
            src_phase = 0.0;
            tempo.reset();
            was_pitch_preserving = false;
            let t = clock.current_time_sec();
            if seek_format(&mut format, &mut decoder, track_id, t).is_err() {
                thread::sleep(Duration::from_millis(5));
                continue;
            }
        }

        if clock.drain_pending.load(Ordering::Acquire) {
            thread::sleep(Duration::from_millis(1));
            continue;
        }

        if !clock.playing.load(Ordering::SeqCst) && !clock.play_requested.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(8));
            continue;
        }

        if prod.vacant_len() < out_channels as usize * 256 {
            thread::sleep(Duration::from_millis(2));
            continue;
        }

        // Need >=2 source samples to interpolate. Keep the trailing leftover and
        // APPEND the next packet so a single carried-over sample can never stall
        // the loop (old `is_empty()` gate stopped fetching after one packet).
        if pending.len() / (out_channels.max(1) as usize) < 2 {
            match format.next_packet() {
                Ok(Some(packet)) => {
                    if packet.track_id != track_id {
                        continue;
                    }
                    match decoder.decode(&packet) {
                        Ok(decoded) => {
                            if decoded.is_empty() {
                                continue;
                            }
                            let mut interleaved = Vec::new();
                            decoded.copy_to_vec_interleaved::<f32>(&mut interleaved);
                            let ch = decoded.spec().channels().count().max(1);
                            for frame in interleaved.chunks(ch) {
                                append_frame_with_output_channels(
                                    frame,
                                    out_channels as usize,
                                    &mut pending,
                                );
                            }
                        }
                        Err(SymError::DecodeError(_)) => continue,
                        Err(_) => break,
                    }
                }
                Ok(None) => {
                    // True demux EOF. Do not stop playback while queued audio
                    // remains; output owns the audible end and final Ended edge.
                    clock.at_eof.store(true, Ordering::SeqCst);
                    let queued = clock.queued_samples.load(Ordering::Relaxed);
                    let duration_samples = (clock.duration_us.load(Ordering::Relaxed)
                        * out_rate.max(1) as u64
                        * out_channels.max(1) as u64)
                        / 1_000_000;
                    if queued >= prebuffer_samples || (duration_samples == 0 && queued > 0) {
                        clock.buffer_ready.store(true, Ordering::SeqCst);
                    } else {
                        // Decode is starved (no more source data, buffer under target) —
                        // this is also a genuine playback end even if `position_us`
                        // never reaches the nominal duration (e.g. bad duration metadata).
                        clock.play_requested.store(false, Ordering::SeqCst);
                        clock.playing.store(false, Ordering::SeqCst);
                    }
                    let dur = clock.duration_us.load(Ordering::Relaxed);
                    let pos = clock.position_us.load(Ordering::Relaxed);
                    if dur > 0 && pos >= dur {
                        clock.position_us.store(dur, Ordering::Relaxed);
                    }
                    thread::sleep(Duration::from_millis(20));
                    continue;
                }
                Err(SymError::ResetRequired) => {
                    if let Ok(d) = make_decoder(&audio_params) {
                        decoder = d;
                    }
                    continue;
                }
                Err(_) => break,
            }
        }

        let rate = clock.rate() as f64;
        let pitch_preserving = (rate as f32 - 1.0).abs() > TEMPO_RATE_EPSILON;
        if pitch_preserving != was_pitch_preserving {
            // Drop leftover grains when crossing the 1.0x linear ↔ tempo boundary.
            tempo.reset();
            was_pitch_preserving = pitch_preserving;
        }
        tempo.set_rate(rate as f32);
        let step = (src_rate as f64 / out_rate as f64) * if pitch_preserving { 1.0 } else { rate };
        if step <= 0.0 {
            thread::sleep(Duration::from_millis(5));
            continue;
        }

        // Fast tempos shorten output vs 1.0x input — pull more source per wall tick
        // so CPAL (still out_rate) does not chronically underrun.
        let rate_boost = if pitch_preserving {
            rate.clamp(1.0, 3.0)
        } else {
            1.0
        };

        if pitch_preserving {
            let vacant_frames = prod.vacant_len() / out_channels as usize;
            let target_output = (((vacant_frames as f64) * rate_boost).ceil() as usize)
                .saturating_add(((1024.0 * rate_boost).ceil() as usize).max(1024))
                .min(8192);
            let batch_frames = ((2048.0 * rate_boost).ceil() as usize).clamp(2048, 6144);
            while tempo.available_output() < target_output {
                if clock.drain_pending.load(Ordering::Acquire)
                    || clock.seek_seq.load(Ordering::Relaxed) != last_seek_seq
                {
                    break;
                }
                let channels = out_channels as usize;
                let idx = src_phase.floor() as usize;
                let pending_frames = pending.len() / channels;
                if idx + 1 >= pending_frames {
                    if idx < pending_frames {
                        pending.drain(..idx * channels);
                        src_phase -= idx as f64;
                    } else {
                        pending.clear();
                        src_phase = 0.0;
                    }
                    break;
                }
                tempo_resampled.clear();
                while tempo_resampled.len() < batch_frames * channels {
                    let idx = src_phase.floor() as usize;
                    let pending_frames = pending.len() / channels;
                    if idx + 1 >= pending_frames {
                        break;
                    }
                    let frac = src_phase - idx as f64;
                    let base = idx * channels;
                    let next_base = (idx + 1) * channels;
                    for ch in 0..channels {
                        let a = pending[base + ch];
                        let b = pending[next_base + ch];
                        tempo_resampled.push(sanitize_pcm_sample(a + (b - a) * frac as f32));
                    }
                    src_phase += step;
                    let drop_n = src_phase.floor() as usize;
                    if drop_n > 2048 && drop_n < pending_frames {
                        pending.drain(..drop_n * channels);
                        src_phase -= drop_n as f64;
                    }
                }
                if tempo_resampled.is_empty() {
                    break;
                }
                tempo.push_input(&tempo_resampled);
                tempo.fill_output(target_output);
            }
        }

        while prod.vacant_len() >= out_channels as usize {
            if clock.drain_pending.load(Ordering::Acquire)
                || clock.seek_seq.load(Ordering::Relaxed) != last_seek_seq
            {
                break;
            }
            if pitch_preserving {
                if tempo.available_output() < out_channels as usize {
                    break;
                }
                let mut pushed = 0u64;
                for _ in 0..out_channels {
                    let Some(sample) = tempo.pop_sample() else {
                        break;
                    };
                    if prod.try_push(sample).is_err() {
                        break;
                    }
                    pushed += 1;
                }
                if pushed > 0 {
                    let queued = clock.queued_samples.fetch_add(pushed, Ordering::Relaxed) + pushed;
                    if queued >= prebuffer_samples {
                        clock.buffer_ready.store(true, Ordering::SeqCst);
                    }
                }
                continue;
            }
            let channels = out_channels as usize;
            let idx = src_phase.floor() as usize;
            let pending_frames = pending.len() / channels;
            if idx + 1 >= pending_frames {
                if idx < pending_frames {
                    pending.drain(..idx * channels);
                    src_phase -= idx as f64;
                } else {
                    pending.clear();
                    src_phase = 0.0;
                }
                break;
            }
            let frac = src_phase - idx as f64;
            let mut pushed = 0u64;
            let base = idx * channels;
            let next_base = (idx + 1) * channels;
            for ch in 0..channels {
                let a = pending[base + ch];
                let b = pending[next_base + ch];
                let sample = sanitize_pcm_sample(a + (b - a) * frac as f32);
                if prod.try_push(sample).is_err() {
                    break;
                }
                pushed += 1;
            }
            if pushed > 0 {
                let queued = clock.queued_samples.fetch_add(pushed, Ordering::Relaxed) + pushed;
                if queued >= prebuffer_samples {
                    clock.buffer_ready.store(true, Ordering::SeqCst);
                }
            }
            src_phase += step;
            let drop_n = src_phase.floor() as usize;
            if drop_n > 2048 && drop_n < pending_frames {
                pending.drain(..drop_n * channels);
                src_phase -= drop_n as f64;
            }
        }

        let channels = out_channels.max(1) as usize;
        let pending_frames = pending.len() / channels;
        if pending_frames > 48_000 * 2 {
            let keep_frames = 48_000;
            let drain_frames = pending_frames - keep_frames;
            pending.drain(..drain_frames * channels);
            src_phase = (src_phase - drain_frames as f64).max(0.0);
        }

        // When tempo still owes the ring buffer and we need more demux packets,
        // skip the pacing sleep so fast rates can catch up within the same wall budget.
        let starved_tempo = pitch_preserving
            && tempo.available_output() < out_channels as usize * 128
            && prod.vacant_len() >= out_channels as usize * 256;
        if !starved_tempo {
            thread::sleep(Duration::from_millis(1));
        }
    }
}

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
    let mut src_phase: f64 = 0.0;
    let mut pending: Vec<f32> = Vec::new();

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
        }

        let seek_seq = clock.seek_seq.load(Ordering::SeqCst);
        if seek_seq != last_seek_seq {
            last_seek_seq = seek_seq;
            pending.clear();
            src_phase = 0.0;
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

        if !clock.playing.load(Ordering::Relaxed) && !clock.play_requested.load(Ordering::Relaxed) {
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
        if pending.len() < 2 {
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
                                let mono = if frame.is_empty() {
                                    0.0
                                } else {
                                    frame.iter().sum::<f32>() / ch as f32
                                };
                                pending.push(sanitize_pcm_sample(mono));
                            }
                        }
                        Err(SymError::DecodeError(_)) => continue,
                        Err(_) => break,
                    }
                }
                Ok(None) => {
                    // True demux EOF. Do not stop playback while queued audio
                    // remains; output owns the audible end and final Ended edge.
                    clock.at_eof.store(true, Ordering::Relaxed);
                    let queued = clock.queued_samples.load(Ordering::Relaxed);
                    let duration_samples = (clock.duration_us.load(Ordering::Relaxed)
                        * out_rate.max(1) as u64
                        * out_channels.max(1) as u64)
                        / 1_000_000;
                    if queued >= prebuffer_samples || (duration_samples == 0 && queued > 0) {
                        clock.buffer_ready.store(true, Ordering::Relaxed);
                    } else {
                        clock.play_requested.store(false, Ordering::Relaxed);
                        clock.playing.store(false, Ordering::Relaxed);
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
        let step = (src_rate as f64 / out_rate as f64) * rate;
        if step <= 0.0 {
            thread::sleep(Duration::from_millis(5));
            continue;
        }

        while prod.vacant_len() >= out_channels as usize {
            if clock.drain_pending.load(Ordering::Acquire)
                || clock.seek_seq.load(Ordering::Relaxed) != last_seek_seq
            {
                break;
            }
            let idx = src_phase.floor() as usize;
            if idx + 1 >= pending.len() {
                if idx < pending.len() {
                    pending.drain(..idx);
                    src_phase -= idx as f64;
                } else {
                    pending.clear();
                    src_phase = 0.0;
                }
                break;
            }
            let frac = src_phase - idx as f64;
            let a = pending[idx];
            let b = pending[idx + 1];
            let sample = sanitize_pcm_sample(a + (b - a) * frac as f32);
            let mut pushed = 0u64;
            for _ in 0..out_channels {
                if prod.try_push(sample).is_err() {
                    break;
                }
                pushed += 1;
            }
            if pushed > 0 {
                let queued = clock.queued_samples.fetch_add(pushed, Ordering::Relaxed) + pushed;
                if queued >= prebuffer_samples {
                    clock.buffer_ready.store(true, Ordering::Relaxed);
                }
            }
            src_phase += step;
            let drop_n = src_phase.floor() as usize;
            if drop_n > 2048 && drop_n < pending.len() {
                pending.drain(..drop_n);
                src_phase -= drop_n as f64;
            }
        }

        if pending.len() > 48_000 * 2 {
            let keep = 48_000;
            let drain = pending.len() - keep;
            pending.drain(..drain);
            src_phase = (src_phase - drain as f64).max(0.0);
        }

        thread::sleep(Duration::from_millis(1));
    }
}

use std::ffi::c_void;
use std::ptr::NonNull;

use super::tempo::TEMPO_RATE_EPSILON;

const PROCESS_BLOCK_FRAMES: usize = 1024;

extern "C" {
    fn rushi_signalsmith_tempo_new(sample_rate: i32, channels: i32) -> *mut c_void;
    fn rushi_signalsmith_tempo_free(handle: *mut c_void);
    fn rushi_signalsmith_tempo_reset(handle: *mut c_void);
    fn rushi_signalsmith_tempo_process(
        handle: *mut c_void,
        input_interleaved: *const f32,
        input_frames: i32,
        output_interleaved: *mut f32,
        output_frames: i32,
    ) -> i32;
}

#[derive(Debug)]
pub(crate) struct SignalsmithTempo {
    handle: NonNull<c_void>,
    channels: usize,
    rate: f32,
    input: Vec<f32>,
    output: Vec<f32>,
    read_idx: usize,
    input_frame_debt: f64,
}

impl SignalsmithTempo {
    pub(crate) fn new(sample_rate: u32, channels: u32, rate: f32) -> Option<Self> {
        let handle = unsafe {
            rushi_signalsmith_tempo_new(sample_rate.max(8_000) as i32, channels.max(1) as i32)
        };
        let handle = NonNull::new(handle)?;
        Some(Self {
            handle,
            channels: channels.max(1) as usize,
            rate: sanitize_rate(rate),
            input: Vec::with_capacity(PROCESS_BLOCK_FRAMES * channels.max(1) as usize * 8),
            output: Vec::with_capacity(PROCESS_BLOCK_FRAMES * channels.max(1) as usize * 8),
            read_idx: 0,
            input_frame_debt: 0.0,
        })
    }

    pub(crate) fn reset(&mut self) {
        self.input.clear();
        self.output.clear();
        self.read_idx = 0;
        self.input_frame_debt = 0.0;
        unsafe {
            rushi_signalsmith_tempo_reset(self.handle.as_ptr());
        }
    }

    pub(crate) fn set_rate(&mut self, rate: f32) {
        self.rate = sanitize_rate(rate);
    }

    pub(crate) fn push_input(&mut self, samples: &[f32]) {
        debug_assert_eq!(samples.len() % self.channels, 0);
        self.input
            .extend(samples.iter().copied().map(sanitize_pcm_sample));
    }

    pub(crate) fn available_output(&self) -> usize {
        self.output.len().saturating_sub(self.read_idx)
    }

    pub(crate) fn fill_output(&mut self, target_available: usize) {
        self.compact_consumed_output();
        while self.available_output() < target_available && self.process_next_block() {}
        self.compact();
    }

    pub(crate) fn pop_sample(&mut self) -> Option<f32> {
        if self.read_idx >= self.output.len() {
            self.compact();
            return None;
        }
        let out = self.output[self.read_idx];
        self.read_idx += 1;
        if self.read_idx > PROCESS_BLOCK_FRAMES * self.channels * 4 {
            self.compact();
        }
        Some(out)
    }

    fn process_next_block(&mut self) -> bool {
        let output_frames = PROCESS_BLOCK_FRAMES;
        let exact_input = output_frames as f64 * self.rate as f64 + self.input_frame_debt;
        let input_frames = exact_input.floor().max(1.0) as usize;
        let available_input_frames = self.input.len() / self.channels;
        if available_input_frames < input_frames {
            return false;
        }
        self.input_frame_debt = exact_input - input_frames as f64;

        let input_samples = input_frames * self.channels;
        let output_samples = output_frames * self.channels;
        let mut processed = vec![0.0f32; output_samples];
        let produced = unsafe {
            rushi_signalsmith_tempo_process(
                self.handle.as_ptr(),
                self.input.as_ptr(),
                input_frames as i32,
                processed.as_mut_ptr(),
                output_frames as i32,
            )
        };
        if produced <= 0 {
            return false;
        }

        self.input.drain(..input_samples);
        processed.truncate(produced as usize * self.channels);
        self.output
            .extend(processed.into_iter().map(sanitize_pcm_sample));
        true
    }

    fn compact(&mut self) {
        if self.read_idx == 0 {
            return;
        }
        if self.read_idx >= self.output.len() {
            self.output.clear();
            self.read_idx = 0;
            return;
        }
        if self.read_idx > PROCESS_BLOCK_FRAMES * self.channels {
            self.output.drain(..self.read_idx);
            self.read_idx = 0;
        }
    }

    fn compact_consumed_output(&mut self) {
        if self.read_idx == 0 {
            return;
        }
        if self.read_idx >= self.output.len() {
            self.output.clear();
            self.read_idx = 0;
            return;
        }
        self.output.drain(..self.read_idx);
        self.read_idx = 0;
    }
}

impl Drop for SignalsmithTempo {
    fn drop(&mut self) {
        unsafe {
            rushi_signalsmith_tempo_free(self.handle.as_ptr());
        }
    }
}

fn sanitize_rate(rate: f32) -> f32 {
    if rate.is_finite() && (rate - 1.0).abs() > TEMPO_RATE_EPSILON {
        rate.clamp(0.25, 3.0)
    } else {
        1.0
    }
}

fn sanitize_pcm_sample(sample: f32) -> f32 {
    if sample.is_finite() {
        sample.clamp(-1.0, 1.0)
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    use std::f32::consts::PI;

    use super::*;

    fn sine(freq_hz: f32, duration_sec: f32, sample_rate: u32) -> Vec<f32> {
        let n = (duration_sec * sample_rate as f32) as usize;
        (0..n)
            .map(|i| {
                let t = i as f32 / sample_rate as f32;
                (2.0 * PI * freq_hz * t).sin() * 0.35
            })
            .collect()
    }

    fn drain_all(stretch: &mut SignalsmithTempo) -> Vec<f32> {
        let mut out = Vec::new();
        for _ in 0..128 {
            stretch.fill_output(4096);
            while let Some(sample) = stretch.pop_sample() {
                out.push(sample);
            }
            if stretch.input.len() / stretch.channels < PROCESS_BLOCK_FRAMES {
                break;
            }
        }
        out
    }

    fn estimate_zero_crossing_frequency(samples: &[f32], sample_rate: u32) -> f32 {
        let start = samples.len() / 5;
        let end = samples.len().saturating_sub(samples.len() / 5);
        let slice = &samples[start..end];
        let mut crossings = 0usize;
        for pair in slice.windows(2) {
            if pair[0] <= 0.0 && pair[1] > 0.0 {
                crossings += 1;
            }
        }
        let duration = slice.len() as f32 / sample_rate as f32;
        crossings as f32 / duration.max(1e-6)
    }

    #[test]
    fn signalsmith_slow_tempo_expands_without_lowering_pitch_like_resampling() {
        let sample_rate = 48_000;
        let input = sine(440.0, 2.0, sample_rate);
        let mut stretch = SignalsmithTempo::new(sample_rate, 1, 0.75).expect("signalsmith");
        stretch.push_input(&input);
        let out = drain_all(&mut stretch);

        let expected = input.len() as f32 / 0.75;
        assert!(
            (out.len() as f32 - expected).abs() / expected < 0.25,
            "len={} expected~{}",
            out.len(),
            expected
        );
        let freq = estimate_zero_crossing_frequency(&out, sample_rate);
        assert!(
            (freq - 440.0).abs() < 70.0,
            "expected pitch near 440Hz, got {freq}"
        );
    }

    #[test]
    fn signalsmith_stereo_tempo_preserves_channel_differences() {
        let sample_rate = 48_000;
        let left = sine(440.0, 1.2, sample_rate);
        let right = sine(660.0, 1.2, sample_rate);
        let mut input = Vec::with_capacity(left.len() * 2);
        for (&l, &r) in left.iter().zip(&right) {
            input.push(l);
            input.push(r * 0.6);
        }

        let mut stretch = SignalsmithTempo::new(sample_rate, 2, 1.25).expect("signalsmith");
        stretch.push_input(&input);
        let out = drain_all(&mut stretch);
        assert!(out.len() > 4096);

        let mut left_energy = 0.0f32;
        let mut right_energy = 0.0f32;
        let mut diff_energy = 0.0f32;
        for frame in out.chunks(2) {
            if frame.len() < 2 {
                continue;
            }
            left_energy += frame[0] * frame[0];
            right_energy += frame[1] * frame[1];
            let diff = frame[0] - frame[1];
            diff_energy += diff * diff;
        }
        assert!(left_energy > 1.0);
        assert!(right_energy > 1.0);
        assert!(
            diff_energy > left_energy.min(right_energy) * 0.25,
            "stereo channels should not collapse to mono"
        );
    }
}

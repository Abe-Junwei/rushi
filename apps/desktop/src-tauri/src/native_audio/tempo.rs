use std::f32::consts::PI;

pub(crate) const TEMPO_RATE_EPSILON: f32 = 0.01;

#[derive(Debug, Clone)]
pub(crate) struct PitchPreservingTempo {
    rate: f32,
    channels: usize,
    frame_len_frames: usize,
    overlap_len_frames: usize,
    hop_out_frames: usize,
    search_len_frames: usize,
    input: Vec<f32>,
    output: Vec<f32>,
    read_idx: usize,
    next_input_frame_pos: f64,
    initialized: bool,
}

impl PitchPreservingTempo {
    pub(crate) fn new(sample_rate: u32, channels: u32, rate: f32) -> Self {
        let sr = sample_rate.max(8_000) as usize;
        let channels = channels.max(1) as usize;
        let frame_len_frames = ((sr * 55) / 1000).clamp(768, 4096);
        let overlap_len_frames = ((sr * 15) / 1000).clamp(192, frame_len_frames / 2);
        let hop_out_frames = frame_len_frames.saturating_sub(overlap_len_frames).max(1);
        let search_len_frames = ((sr * 8) / 1000).clamp(96, 768);
        Self {
            rate: sanitize_rate(rate),
            channels,
            frame_len_frames,
            overlap_len_frames,
            hop_out_frames,
            search_len_frames,
            input: Vec::with_capacity(frame_len_frames * channels * 4),
            output: Vec::with_capacity(frame_len_frames * channels * 4),
            read_idx: 0,
            next_input_frame_pos: 0.0,
            initialized: false,
        }
    }

    pub(crate) fn reset(&mut self) {
        self.input.clear();
        self.output.clear();
        self.read_idx = 0;
        self.next_input_frame_pos = 0.0;
        self.initialized = false;
    }

    pub(crate) fn set_rate(&mut self, rate: f32) {
        self.rate = sanitize_rate(rate);
    }

    pub(crate) fn push_input(&mut self, samples: &[f32]) {
        debug_assert_eq!(samples.len() % self.channels, 0);
        self.input
            .extend(samples.iter().copied().map(sanitize_sample));
    }

    pub(crate) fn available_output(&self) -> usize {
        self.output.len().saturating_sub(self.read_idx)
    }

    pub(crate) fn fill_output(&mut self, target_available: usize) {
        while self.available_output() < target_available && self.can_emit_grain() {
            self.emit_next_grain();
        }
        self.compact();
    }

    pub(crate) fn pop_sample(&mut self) -> Option<f32> {
        if self.read_idx >= self.output.len() {
            self.compact();
            return None;
        }
        let out = self.output[self.read_idx];
        self.read_idx += 1;
        if self.read_idx > self.frame_len_frames * self.channels * 4 {
            self.compact();
        }
        Some(out)
    }

    fn can_emit_grain(&self) -> bool {
        let input_frames = self.input.len() / self.channels;
        if !self.initialized {
            return input_frames >= self.frame_len_frames;
        }
        let nominal = self.next_input_frame_pos.floor().max(0.0) as usize;
        let left = nominal.saturating_sub(self.search_len_frames);
        let right = nominal
            .saturating_add(self.search_len_frames)
            .min(input_frames);
        left < right && left.saturating_add(self.frame_len_frames) < input_frames
    }

    fn emit_next_grain(&mut self) {
        if !self.initialized {
            let samples = self.frame_len_frames * self.channels;
            self.output.extend_from_slice(&self.input[..samples]);
            self.initialized = true;
            self.next_input_frame_pos = self.hop_out_frames as f64 * self.rate as f64;
            self.drop_consumed_input();
            return;
        }

        let candidate = self.best_candidate_pos();
        let grain_start = candidate * self.channels;
        let grain_end = grain_start + self.frame_len_frames * self.channels;
        let grain = self.input[grain_start..grain_end].to_vec();
        self.overlap_append(&grain);
        self.next_input_frame_pos =
            candidate as f64 + self.hop_out_frames as f64 * self.rate as f64;
        self.drop_consumed_input();
    }

    fn best_candidate_pos(&self) -> usize {
        let input_frames = self.input.len() / self.channels;
        let nominal = self.next_input_frame_pos.round().max(0.0) as usize;
        let min_pos = nominal.saturating_sub(self.search_len_frames);
        let max_pos = nominal
            .saturating_add(self.search_len_frames)
            .min(input_frames.saturating_sub(self.frame_len_frames + 1));
        if min_pos >= max_pos || self.output.len() < self.overlap_len_frames * self.channels {
            return nominal.min(input_frames.saturating_sub(self.frame_len_frames + 1));
        }

        let tail_start = self.output.len() - self.overlap_len_frames * self.channels;
        let tail = &self.output[tail_start..];
        let mut best_pos = nominal.min(max_pos);
        let mut best_score = f32::NEG_INFINITY;
        for pos in min_pos..=max_pos {
            let head_start = pos * self.channels;
            let head_end = head_start + self.overlap_len_frames * self.channels;
            let head = &self.input[head_start..head_end];
            let score = normalized_frame_correlation(tail, head, self.channels);
            if score > best_score {
                best_score = score;
                best_pos = pos;
            }
        }
        best_pos
    }

    fn overlap_append(&mut self, grain: &[f32]) {
        if self.output.len() < self.overlap_len_frames * self.channels {
            self.output.extend_from_slice(grain);
            return;
        }
        let out_tail = self.output.len() - self.overlap_len_frames * self.channels;
        for frame_i in 0..self.overlap_len_frames {
            let w = raised_cosine(frame_i, self.overlap_len_frames);
            for ch in 0..self.channels {
                let offset = frame_i * self.channels + ch;
                let existing = self.output[out_tail + offset];
                let incoming = grain[offset];
                self.output[out_tail + offset] =
                    sanitize_sample(existing * (1.0 - w) + incoming * w);
            }
        }
        self.output
            .extend_from_slice(&grain[self.overlap_len_frames * self.channels..]);
    }

    fn drop_consumed_input(&mut self) {
        let keep_left = self.search_len_frames + self.frame_len_frames;
        let drop_frames = (self.next_input_frame_pos.floor() as usize).saturating_sub(keep_left);
        if drop_frames > 0 && drop_frames < self.input.len() / self.channels {
            let drop_samples = drop_frames * self.channels;
            self.input.drain(..drop_samples);
            self.next_input_frame_pos -= drop_frames as f64;
        }
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
        if self.read_idx > self.frame_len_frames * self.channels {
            self.output.drain(..self.read_idx);
            self.read_idx = 0;
        }
    }
}

fn sanitize_rate(rate: f32) -> f32 {
    if rate.is_finite() {
        rate.clamp(0.25, 3.0)
    } else {
        1.0
    }
}

fn sanitize_sample(sample: f32) -> f32 {
    if sample.is_finite() {
        sample.clamp(-1.0, 1.0)
    } else {
        0.0
    }
}

fn raised_cosine(i: usize, len: usize) -> f32 {
    if len <= 1 {
        return 1.0;
    }
    let x = i as f32 / (len - 1) as f32;
    0.5 - 0.5 * (PI * x).cos()
}

fn normalized_frame_correlation(a: &[f32], b: &[f32], channels: usize) -> f32 {
    let mut dot = 0.0f32;
    let mut aa = 0.0f32;
    let mut bb = 0.0f32;
    for (frame_a, frame_b) in a.chunks(channels).zip(b.chunks(channels)) {
        let x = frame_a.iter().sum::<f32>() / channels as f32;
        let y = frame_b.iter().sum::<f32>() / channels as f32;
        dot += x * y;
        aa += x * x;
        bb += y * y;
    }
    let denom = (aa * bb).sqrt();
    if denom > 1e-6 {
        dot / denom
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
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

    fn drain_all(stretch: &mut PitchPreservingTempo) -> Vec<f32> {
        let mut out = Vec::new();
        for _ in 0..128 {
            stretch.fill_output(4096);
            while let Some(sample) = stretch.pop_sample() {
                out.push(sample);
            }
            if stretch.input.len() / stretch.channels < stretch.frame_len_frames {
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
    fn fast_tempo_shortens_without_raising_sine_pitch_like_resampling() {
        let sample_rate = 48_000;
        let input = sine(440.0, 2.0, sample_rate);
        let mut stretch = PitchPreservingTempo::new(sample_rate, 1, 1.5);
        stretch.push_input(&input);
        let out = drain_all(&mut stretch);

        let expected = input.len() as f32 / 1.5;
        assert!(
            (out.len() as f32 - expected).abs() / expected < 0.2,
            "len={} expected~{}",
            out.len(),
            expected
        );
        let freq = estimate_zero_crossing_frequency(&out, sample_rate);
        assert!(
            (freq - 440.0).abs() < 70.0,
            "expected pitch near 440Hz, got {freq}"
        );
        assert!(
            (freq - 660.0).abs() > 120.0,
            "should not sound like naive 1.5x resampling"
        );
    }

    #[test]
    fn slow_tempo_expands_without_lowering_sine_pitch_like_resampling() {
        let sample_rate = 48_000;
        let input = sine(440.0, 2.0, sample_rate);
        let mut stretch = PitchPreservingTempo::new(sample_rate, 1, 0.75);
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
        assert!(
            (freq - 330.0).abs() > 60.0,
            "should not sound like naive 0.75x resampling"
        );
    }

    #[test]
    fn stereo_tempo_preserves_channel_differences() {
        let sample_rate = 48_000;
        let left = sine(440.0, 1.2, sample_rate);
        let right = sine(660.0, 1.2, sample_rate);
        let mut input = Vec::with_capacity(left.len() * 2);
        for (&l, &r) in left.iter().zip(&right) {
            input.push(l);
            input.push(r * 0.6);
        }

        let mut stretch = PitchPreservingTempo::new(sample_rate, 2, 1.25);
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

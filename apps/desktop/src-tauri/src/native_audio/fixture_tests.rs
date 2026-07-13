//! WAV fixture helpers + probe integration for native_audio.

#[cfg(test)]
mod wav_fixture_tests {
    use std::fs::File;
    use std::io::Write;
    use std::path::PathBuf;

    use crate::native_audio::decode::probe_duration_sec;

    fn write_sine_wav(path: &PathBuf, duration_sec: f64, sample_rate: u32) {
        let n_frames = (duration_sec * sample_rate as f64).round() as usize;
        let data_bytes = (n_frames * 2) as u32; // mono i16
        let mut buf: Vec<u8> = Vec::with_capacity(44 + data_bytes as usize);
        buf.extend_from_slice(b"RIFF");
        buf.extend_from_slice(&(36 + data_bytes).to_le_bytes());
        buf.extend_from_slice(b"WAVE");
        buf.extend_from_slice(b"fmt ");
        buf.extend_from_slice(&16u32.to_le_bytes());
        buf.extend_from_slice(&1u16.to_le_bytes()); // PCM
        buf.extend_from_slice(&1u16.to_le_bytes()); // mono
        buf.extend_from_slice(&sample_rate.to_le_bytes());
        let byte_rate = sample_rate * 2;
        buf.extend_from_slice(&byte_rate.to_le_bytes());
        buf.extend_from_slice(&2u16.to_le_bytes()); // block align
        buf.extend_from_slice(&16u16.to_le_bytes()); // bits
        buf.extend_from_slice(b"data");
        buf.extend_from_slice(&data_bytes.to_le_bytes());
        for i in 0..n_frames {
            let t = i as f64 / sample_rate as f64;
            let sample = (t * 440.0 * std::f64::consts::TAU).sin();
            let i16s = (sample * 0.2 * i16::MAX as f64) as i16;
            buf.extend_from_slice(&i16s.to_le_bytes());
        }
        let mut f = File::create(path).expect("create wav");
        f.write_all(&buf).expect("write wav");
    }

    #[test]
    fn probe_duration_reads_wav_fixture() {
        let dir = std::env::temp_dir().join("rushi_native_audio_fixture");
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("tone_0_5s.wav");
        write_sine_wav(&path, 0.5, 48_000);
        let dur = probe_duration_sec(&path).expect("probe");
        assert!((dur - 0.5).abs() < 0.02, "expected ~0.5s, got {dur}");
    }

    #[test]
    fn short_clip_probe_is_positive() {
        let dir = std::env::temp_dir().join("rushi_native_audio_fixture");
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("tone_50ms.wav");
        write_sine_wav(&path, 0.05, 48_000);
        let dur = probe_duration_sec(&path).expect("probe");
        assert!(dur > 0.04 && dur < 0.07, "got {dur}");
    }
}

use super::signalsmith_tempo::SignalsmithTempo;
use super::tempo::PitchPreservingTempo;

#[derive(Debug)]
pub(crate) enum TempoProcessor {
    Signalsmith(SignalsmithTempo),
    Fallback(PitchPreservingTempo),
}

impl TempoProcessor {
    pub(crate) fn new(sample_rate: u32, channels: u32, rate: f32) -> Self {
        if let Some(tempo) = SignalsmithTempo::new(sample_rate, channels, rate) {
            Self::Signalsmith(tempo)
        } else {
            Self::Fallback(PitchPreservingTempo::new(sample_rate, channels, rate))
        }
    }

    pub(crate) fn reset(&mut self) {
        match self {
            Self::Signalsmith(tempo) => tempo.reset(),
            Self::Fallback(tempo) => tempo.reset(),
        }
    }

    pub(crate) fn set_rate(&mut self, rate: f32) {
        match self {
            Self::Signalsmith(tempo) => tempo.set_rate(rate),
            Self::Fallback(tempo) => tempo.set_rate(rate),
        }
    }

    pub(crate) fn push_input(&mut self, samples: &[f32]) {
        match self {
            Self::Signalsmith(tempo) => tempo.push_input(samples),
            Self::Fallback(tempo) => tempo.push_input(samples),
        }
    }

    pub(crate) fn available_output(&self) -> usize {
        match self {
            Self::Signalsmith(tempo) => tempo.available_output(),
            Self::Fallback(tempo) => tempo.available_output(),
        }
    }

    pub(crate) fn fill_output(&mut self, target_available: usize) {
        match self {
            Self::Signalsmith(tempo) => tempo.fill_output(target_available),
            Self::Fallback(tempo) => tempo.fill_output(target_available),
        }
    }

    pub(crate) fn pop_sample(&mut self) -> Option<f32> {
        match self {
            Self::Signalsmith(tempo) => tempo.pop_sample(),
            Self::Fallback(tempo) => tempo.pop_sample(),
        }
    }
}

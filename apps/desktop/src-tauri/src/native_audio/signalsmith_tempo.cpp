#include "signalsmith-stretch.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <limits>
#include <vector>

namespace {

struct RushiSignalsmithTempo {
  int sample_rate = 48000;
  int channels = 1;
  signalsmith::stretch::SignalsmithStretch<float> stretch;
  std::vector<std::vector<float>> input;
  std::vector<std::vector<float>> output;
  std::vector<float *> input_ptrs;
  std::vector<float *> output_ptrs;

  RushiSignalsmithTempo(int sample_rate_in, int channels_in)
      : sample_rate(std::max(8000, sample_rate_in)),
        channels(std::max(1, channels_in)),
        stretch(1) {
    stretch.presetDefault(channels, static_cast<float>(sample_rate), false);
    input.resize(channels);
    output.resize(channels);
    input_ptrs.resize(channels);
    output_ptrs.resize(channels);
  }
};

float sanitize_sample(float sample) {
  if (!std::isfinite(sample)) return 0.0f;
  return std::max(-1.0f, std::min(1.0f, sample));
}

}  // namespace

extern "C" {

void *rushi_signalsmith_tempo_new(int sample_rate, int channels) {
  try {
    return new RushiSignalsmithTempo(sample_rate, channels);
  } catch (...) {
    return nullptr;
  }
}

void rushi_signalsmith_tempo_free(void *handle) {
  delete static_cast<RushiSignalsmithTempo *>(handle);
}

void rushi_signalsmith_tempo_reset(void *handle) {
  if (!handle) return;
  static_cast<RushiSignalsmithTempo *>(handle)->stretch.reset();
}

int rushi_signalsmith_tempo_input_latency(void *handle) {
  if (!handle) return 0;
  return static_cast<RushiSignalsmithTempo *>(handle)->stretch.inputLatency();
}

int rushi_signalsmith_tempo_output_latency(void *handle) {
  if (!handle) return 0;
  return static_cast<RushiSignalsmithTempo *>(handle)->stretch.outputLatency();
}

int rushi_signalsmith_tempo_process(
    void *handle,
    const float *input_interleaved,
    int input_frames,
    float *output_interleaved,
    int output_frames) {
  if (!handle || !input_interleaved || !output_interleaved || input_frames < 0 || output_frames < 0) {
    return 0;
  }

  auto *state = static_cast<RushiSignalsmithTempo *>(handle);
  const int channels = state->channels;
  for (int ch = 0; ch < channels; ++ch) {
    state->input[ch].assign(input_frames, 0.0f);
    state->output[ch].assign(output_frames, 0.0f);
    state->input_ptrs[ch] = state->input[ch].data();
    state->output_ptrs[ch] = state->output[ch].data();
  }

  for (int frame = 0; frame < input_frames; ++frame) {
    const int base = frame * channels;
    for (int ch = 0; ch < channels; ++ch) {
      state->input[ch][frame] = sanitize_sample(input_interleaved[base + ch]);
    }
  }

  try {
    state->stretch.process(state->input_ptrs.data(), input_frames, state->output_ptrs.data(), output_frames);
  } catch (...) {
    return 0;
  }

  for (int frame = 0; frame < output_frames; ++frame) {
    const int base = frame * channels;
    for (int ch = 0; ch < channels; ++ch) {
      output_interleaved[base + ch] = sanitize_sample(state->output[ch][frame]);
    }
  }

  return output_frames;
}

}  // extern "C"

declare module "@rushi/wasm-waveform" {
  export function draw_waveform(
    canvasId: string,
    samples: Float32Array,
    width: number,
    height: number,
    color: string,
    barWidth: number,
    gap: number,
  ): void;

  export function draw_waveform_simple(
    canvasId: string,
    samples: Float32Array,
    width: number,
    height: number,
  ): void;

  export default function init(): Promise<unknown>;
}

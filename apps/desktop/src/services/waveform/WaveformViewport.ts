export type WaveformViewportState = {
  scrollLeftPx: number;
  clientWidthPx: number;
  pxPerSec: number;
  durationSec: number;
};

export type ViewportListener = (state: WaveformViewportState) => void;

/** Imperative viewport snapshot; high-frequency updates stay outside React. */
export class WaveformViewport {
  private state: WaveformViewportState = {
    scrollLeftPx: 0,
    clientWidthPx: 0,
    pxPerSec: 56,
    durationSec: 0,
  };

  private listeners = new Set<ViewportListener>();

  subscribe(listener: ViewportListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): WaveformViewportState {
    return this.state;
  }

  patch(partial: Partial<WaveformViewportState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

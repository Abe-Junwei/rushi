export class ByteBudgetLruMap<K, V> {
  private readonly cache = new Map<K, { value: V; bytes: number }>();
  private readonly order: K[] = [];
  private totalBytes = 0;

  constructor(private readonly budgetBytes: number) {}

  has(key: K): boolean {
    return this.cache.has(key);
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    this.touch(key);
    return entry.value;
  }

  values(): V[] {
    return [...this.cache.values()].map((entry) => entry.value);
  }

  set(key: K, value: V, bytes: number, keepKey: K = key): void {
    const existing = this.cache.get(key);
    if (existing) {
      this.totalBytes -= existing.bytes;
      this.removeOrder(key);
    }
    this.cache.set(key, { value, bytes });
    this.order.push(key);
    this.totalBytes += bytes;
    this.evictToBudget(keepKey);
  }

  private evictToBudget(keepKey: K): void {
    while (this.totalBytes > this.budgetBytes && this.order.length > 1) {
      const oldest = this.order[0];
      if (oldest == null) break;
      if (Object.is(oldest, keepKey)) {
        this.touch(oldest);
        continue;
      }
      this.order.shift();
      const removed = this.cache.get(oldest);
      if (removed) {
        this.totalBytes -= removed.bytes;
        this.cache.delete(oldest);
      }
    }
  }

  private touch(key: K): void {
    this.removeOrder(key);
    if (this.cache.has(key)) {
      this.order.push(key);
    }
  }

  private removeOrder(key: K): void {
    const idx = this.order.findIndex((candidate) => Object.is(candidate, key));
    if (idx >= 0) {
      this.order.splice(idx, 1);
    }
  }
}

export function estimateWaveformLikeBytes(data: { length: number; channels?: unknown }): number {
  const channels = typeof data.channels === "number" ? data.channels || 1 : 1;
  return 24 + Math.max(1, data.length) * Math.max(1, channels) * 4;
}

export function estimateWaveSurferPeaksBundleBytes(
  peaks: Array<Float32Array | number[]>,
): number {
  return peaks.reduce((sum, ch) => {
    if (ch instanceof Float32Array) return sum + ch.byteLength;
    return sum + ch.length * 8;
  }, 0);
}

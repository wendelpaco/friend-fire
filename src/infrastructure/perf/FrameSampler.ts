import type { FrameSample, PerfSnapshot } from "./types";

/** Sliding-window frame time sampler (p50 / p95). */
export class FrameSampler {
  private readonly capacity: number;
  private readonly frameMs: number[];
  private readonly cpuMs: number[];
  private readonly renderMs: number[];
  private write = 0;
  private filled = 0;

  constructor(capacity = 120) {
    this.capacity = Math.max(8, Math.floor(capacity));
    this.frameMs = new Array(this.capacity).fill(0);
    this.cpuMs = new Array(this.capacity).fill(0);
    this.renderMs = new Array(this.capacity).fill(0);
  }

  push(sample: FrameSample): void {
    const i = this.write;
    this.frameMs[i] = sample.frameMs;
    this.cpuMs[i] = sample.cpuMs;
    this.renderMs[i] = sample.renderMs;
    this.write = (this.write + 1) % this.capacity;
    if (this.filled < this.capacity) this.filled += 1;
  }

  get size(): number {
    return this.filled;
  }

  clear(): void {
    this.write = 0;
    this.filled = 0;
  }

  snapshot(): PerfSnapshot {
    const n = this.filled;
    if (n === 0) {
      return {
        count: 0,
        p50FrameMs: 0,
        p95FrameMs: 0,
        p50CpuMs: 0,
        p95CpuMs: 0,
        p50RenderMs: 0,
        p95RenderMs: 0,
      };
    }
    return {
      count: n,
      p50FrameMs: percentile(this.frameMs, n, 0.5),
      p95FrameMs: percentile(this.frameMs, n, 0.95),
      p50CpuMs: percentile(this.cpuMs, n, 0.5),
      p95CpuMs: percentile(this.cpuMs, n, 0.95),
      p50RenderMs: percentile(this.renderMs, n, 0.5),
      p95RenderMs: percentile(this.renderMs, n, 0.95),
    };
  }
}

/** Percentile of first `n` samples (copy + sort; fine for n≤120). */
export function percentile(
  values: readonly number[],
  n: number,
  p: number,
): number {
  if (n <= 0) return 0;
  const slice = values.slice(0, n).sort((a, b) => a - b);
  const idx = Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1));
  return slice[idx]!;
}

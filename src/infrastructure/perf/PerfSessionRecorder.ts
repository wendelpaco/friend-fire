/**
 * Local perf session log for QA (W5). No server — download JSON only.
 * Ring buffer ~5 min at 1 Hz.
 */

import { targetMsForTier } from "@/domains/prefs/qualityLevels";
import type { GraphicsQuality } from "@/domains/prefs";
import type { AdaptReason, RuntimeKnobs } from "./types";

export const PERF_SESSION_VERSION = 1 as const;
/** 5 min soak @ 1 sample/s */
export const PERF_SESSION_MAX_SAMPLES = 300;
export const PERF_SESSION_SAMPLE_MS = 1000;

export type PerfSessionSample = {
  /** ms since recorder start */
  t: number;
  p50Ms: number;
  p95Ms: number;
  cpuMsP95: number;
  renderMsP95: number;
  fps: number;
  drawCalls: number;
  triangles: number;
  userTierMax: GraphicsQuality;
  autoEnabled: boolean;
  adaptReason: AdaptReason | null;
  knobs: Pick<
    RuntimeKnobs,
    | "maxPixelRatio"
    | "shadowsEnabled"
    | "shadowMapSize"
    | "fxBudget"
    | "dustCount"
    | "propDetail"
  >;
};

export type PerfSloResult = {
  profile: "reference" | "floor" | "ceiling";
  targetMs: number;
  p95Ms: number;
  pass: boolean;
};

export type PerfSessionReport = {
  version: typeof PERF_SESSION_VERSION;
  exportedAt: string;
  durationMs: number;
  userAgent: string;
  mapId?: string;
  networked?: boolean;
  samples: PerfSessionSample[];
  summary: {
    sampleCount: number;
    p50Ms: number;
    p95Ms: number;
    cpuMsP95: number;
    renderMsP95: number;
    fpsAvg: number;
  };
  slo: {
    reference: PerfSloResult;
    floor: PerfSloResult;
    ceiling: PerfSloResult;
  };
};

export type PerfSessionInput = {
  p50Ms: number;
  p95Ms: number;
  cpuMsP95: number;
  renderMsP95: number;
  fps: number;
  drawCalls: number;
  triangles: number;
  userTierMax: GraphicsQuality;
  autoEnabled: boolean;
  adaptReason: AdaptReason | null;
  knobs: RuntimeKnobs;
};

export class PerfSessionRecorder {
  private readonly maxSamples: number;
  private readonly samples: PerfSessionSample[] = [];
  private startedAt = 0;
  private lastSampleAt = 0;
  private mapId: string | undefined;
  private networked = false;

  constructor(maxSamples = PERF_SESSION_MAX_SAMPLES) {
    this.maxSamples = Math.max(5, Math.floor(maxSamples));
  }

  start(meta?: { mapId?: string; networked?: boolean }): void {
    this.samples.length = 0;
    this.startedAt = performance.now();
    this.lastSampleAt = 0;
    this.mapId = meta?.mapId;
    this.networked = Boolean(meta?.networked);
  }

  clear(): void {
    this.samples.length = 0;
    this.startedAt = 0;
    this.lastSampleAt = 0;
  }

  get sampleCount(): number {
    return this.samples.length;
  }

  setMeta(meta: { mapId?: string; networked?: boolean }): void {
    if (meta.mapId !== undefined) this.mapId = meta.mapId;
    if (meta.networked !== undefined) this.networked = meta.networked;
  }

  /**
   * Push a sample at most once per PERF_SESSION_SAMPLE_MS.
   * Safe to call from the ~2 Hz metrics cadence.
   */
  maybeSample(now: number, input: PerfSessionInput): void {
    if (this.startedAt <= 0) {
      this.startedAt = now;
    }
    if (this.lastSampleAt > 0 && now - this.lastSampleAt < PERF_SESSION_SAMPLE_MS) {
      return;
    }
    this.lastSampleAt = now;
    const sample: PerfSessionSample = {
      t: Math.round(now - this.startedAt),
      p50Ms: input.p50Ms,
      p95Ms: input.p95Ms,
      cpuMsP95: input.cpuMsP95,
      renderMsP95: input.renderMsP95,
      fps: input.fps,
      drawCalls: input.drawCalls,
      triangles: input.triangles,
      userTierMax: input.userTierMax,
      autoEnabled: input.autoEnabled,
      adaptReason: input.adaptReason,
      knobs: {
        maxPixelRatio: input.knobs.maxPixelRatio,
        shadowsEnabled: input.knobs.shadowsEnabled,
        shadowMapSize: input.knobs.shadowMapSize,
        fxBudget: input.knobs.fxBudget,
        dustCount: input.knobs.dustCount,
        propDetail: input.knobs.propDetail,
      },
    };
    if (this.samples.length >= this.maxSamples) {
      this.samples.shift();
    }
    this.samples.push(sample);
  }

  buildReport(now: number = performance.now()): PerfSessionReport {
    const summary = summarizeSamples(this.samples);
    const p95 = summary.p95Ms;
    return {
      version: PERF_SESSION_VERSION,
      exportedAt: new Date().toISOString(),
      durationMs: this.startedAt > 0 ? Math.round(now - this.startedAt) : 0,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      mapId: this.mapId,
      networked: this.networked,
      samples: this.samples.slice(),
      summary,
      slo: {
        reference: evaluateProfileSlo("reference", p95),
        floor: evaluateProfileSlo("floor", p95),
        ceiling: evaluateProfileSlo("ceiling", p95),
      },
    };
  }
}

export function summarizeSamples(samples: readonly PerfSessionSample[]): {
  sampleCount: number;
  p50Ms: number;
  p95Ms: number;
  cpuMsP95: number;
  renderMsP95: number;
  fpsAvg: number;
} {
  const n = samples.length;
  if (n === 0) {
    return {
      sampleCount: 0,
      p50Ms: 0,
      p95Ms: 0,
      cpuMsP95: 0,
      renderMsP95: 0,
      fpsAvg: 0,
    };
  }
  // Session-level p95 of the *reported* p95s (worst sustained windows)
  const p95s = samples.map((s) => s.p95Ms).sort((a, b) => a - b);
  const p50s = samples.map((s) => s.p50Ms).sort((a, b) => a - b);
  const cpus = samples.map((s) => s.cpuMsP95).sort((a, b) => a - b);
  const gpus = samples.map((s) => s.renderMsP95).sort((a, b) => a - b);
  let fpsSum = 0;
  for (const s of samples) fpsSum += s.fps;
  return {
    sampleCount: n,
    p50Ms: round1(percentileSorted(p50s, 0.5)),
    p95Ms: round1(percentileSorted(p95s, 0.95)),
    cpuMsP95: round1(percentileSorted(cpus, 0.95)),
    renderMsP95: round1(percentileSorted(gpus, 0.95)),
    fpsAvg: Math.round(fpsSum / n),
  };
}

export function evaluateProfileSlo(
  profile: "reference" | "floor" | "ceiling",
  p95Ms: number,
): PerfSloResult {
  const tier: GraphicsQuality =
    profile === "floor" ? "low" : profile === "ceiling" ? "high" : "medium";
  const targetMs = targetMsForTier(tier);
  return {
    profile,
    targetMs,
    p95Ms,
    pass: p95Ms > 0 && p95Ms <= targetMs,
  };
}

/** Trigger browser download of the JSON report. */
export function downloadPerfReport(
  report: PerfSessionReport,
  filename?: string,
): void {
  if (typeof document === "undefined") return;
  const name =
    filename ??
    `friend-fire-perf-${report.exportedAt.replace(/[:.]/g, "-")}.json`;
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function percentileSorted(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const idx = Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1));
  return sorted[idx]!;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

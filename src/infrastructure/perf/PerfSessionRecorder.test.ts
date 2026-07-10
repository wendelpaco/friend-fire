import { describe, expect, it } from "vitest";
import {
  PERF_SESSION_SAMPLE_MS,
  PerfSessionRecorder,
  evaluateProfileSlo,
  summarizeSamples,
  type PerfSessionSample,
} from "./PerfSessionRecorder";
import type { RuntimeKnobs } from "./types";

const knobs: RuntimeKnobs = {
  maxPixelRatio: 1.25,
  shadowsEnabled: true,
  shadowMapSize: 1024,
  shadowType: "pcf",
  propCastShadow: false,
  dustCount: 100,
  dustUpdateHz: 20,
  fxBudget: 1,
  animLodFullDist: 14,
  animLodMidDist: 24,
  propDetail: 1,
};

function input(over: Partial<{ p95Ms: number; p50Ms: number; fps: number }> = {}) {
  return {
    p50Ms: over.p50Ms ?? 14,
    p95Ms: over.p95Ms ?? 16,
    cpuMsP95: 5,
    renderMsP95: 9,
    fps: over.fps ?? 60,
    drawCalls: 100,
    triangles: 50_000,
    userTierMax: "medium" as const,
    autoEnabled: true,
    adaptReason: null,
    knobs,
  };
}

describe("evaluateProfileSlo", () => {
  it("reference/ceiling target 16.7, floor 22.2", () => {
    expect(evaluateProfileSlo("reference", 16).pass).toBe(true);
    expect(evaluateProfileSlo("reference", 17).pass).toBe(false);
    expect(evaluateProfileSlo("floor", 22).pass).toBe(true);
    expect(evaluateProfileSlo("floor", 23).pass).toBe(false);
    expect(evaluateProfileSlo("ceiling", 16.7).pass).toBe(true);
  });

  it("zero p95 is not a pass", () => {
    expect(evaluateProfileSlo("reference", 0).pass).toBe(false);
  });
});

describe("summarizeSamples", () => {
  it("empty", () => {
    expect(summarizeSamples([]).sampleCount).toBe(0);
  });

  it("aggregates session p95", () => {
    const samples: PerfSessionSample[] = Array.from({ length: 10 }, (_, i) => ({
      t: i * 1000,
      p50Ms: 12,
      p95Ms: 10 + i,
      cpuMsP95: 4,
      renderMsP95: 8,
      fps: 60,
      drawCalls: 1,
      triangles: 1,
      userTierMax: "medium",
      autoEnabled: true,
      adaptReason: null,
      knobs: {
        maxPixelRatio: 1.25,
        shadowsEnabled: true,
        shadowMapSize: 1024,
        fxBudget: 1,
        dustCount: 100,
        propDetail: 1,
      },
    }));
    const s = summarizeSamples(samples);
    expect(s.sampleCount).toBe(10);
    expect(s.p95Ms).toBeGreaterThanOrEqual(s.p50Ms);
  });
});

describe("PerfSessionRecorder", () => {
  it("throttles samples to ~1 Hz", () => {
    const r = new PerfSessionRecorder(50);
    r.start({ mapId: "dust" });
    r.maybeSample(1000, input());
    r.maybeSample(1000 + PERF_SESSION_SAMPLE_MS - 1, input({ p95Ms: 99 }));
    expect(r.sampleCount).toBe(1);
    r.maybeSample(1000 + PERF_SESSION_SAMPLE_MS, input({ p95Ms: 15 }));
    expect(r.sampleCount).toBe(2);
  });

  it("builds report with SLO block", () => {
    const r = new PerfSessionRecorder();
    r.start({ mapId: "dust", networked: false });
    r.maybeSample(0, input({ p95Ms: 15 }));
    r.maybeSample(PERF_SESSION_SAMPLE_MS, input({ p95Ms: 15.5 }));
    const report = r.buildReport(2000);
    expect(report.version).toBe(1);
    expect(report.mapId).toBe("dust");
    expect(report.samples.length).toBe(2);
    expect(report.slo.reference.targetMs).toBe(16.7);
    expect(report.slo.floor.targetMs).toBe(22.2);
  });

  it("rings when over capacity", () => {
    const r = new PerfSessionRecorder(5);
    r.start();
    for (let i = 0; i < 10; i++) {
      r.maybeSample(i * PERF_SESSION_SAMPLE_MS, input({ fps: 50 + i }));
    }
    expect(r.sampleCount).toBe(5);
  });
});

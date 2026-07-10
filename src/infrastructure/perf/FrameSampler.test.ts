import { describe, expect, it } from "vitest";
import { FrameSampler, percentile } from "./FrameSampler";

describe("percentile", () => {
  it("handles empty", () => {
    expect(percentile([], 0, 0.95)).toBe(0);
  });

  it("p50 and p95 on sorted series", () => {
    const v = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(v, 10, 0.5)).toBe(50);
    expect(percentile(v, 10, 0.95)).toBe(100);
  });
});

describe("FrameSampler", () => {
  it("aggregates p50/p95 for frame and sub-budgets", () => {
    const s = new FrameSampler(32);
    for (let i = 1; i <= 20; i++) {
      s.push({ frameMs: i, cpuMs: i * 0.4, renderMs: i * 0.6 });
    }
    const snap = s.snapshot();
    expect(snap.count).toBe(20);
    expect(snap.p50FrameMs).toBeGreaterThan(0);
    expect(snap.p95FrameMs).toBeGreaterThanOrEqual(snap.p50FrameMs);
    expect(snap.p95CpuMs).toBeGreaterThan(0);
    expect(snap.p95RenderMs).toBeGreaterThan(0);
  });

  it("rings when over capacity", () => {
    const s = new FrameSampler(8);
    for (let i = 0; i < 20; i++) {
      s.push({ frameMs: 100 + i, cpuMs: 1, renderMs: 1 });
    }
    expect(s.size).toBe(8);
    const snap = s.snapshot();
    expect(snap.count).toBe(8);
    // latest window should be high values
    expect(snap.p50FrameMs).toBeGreaterThanOrEqual(100);
  });
});

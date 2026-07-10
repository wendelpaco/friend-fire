/**
 * Perf sampling types. Runtime knobs live in domains/prefs (single source).
 */

export type {
  KnobLevels,
  RuntimeKnobs,
  ShadowType,
} from "@/domains/prefs/qualityLevels";

export type AdaptReason = "degrade" | "upgrade" | "user" | "grace" | "init";

export type FrameSample = {
  frameMs: number;
  cpuMs: number;
  renderMs: number;
};

export type PerfSnapshot = {
  count: number;
  p50FrameMs: number;
  p95FrameMs: number;
  p50CpuMs: number;
  p95CpuMs: number;
  p50RenderMs: number;
  p95RenderMs: number;
};

export type QualityControllerTickResult = {
  knobs: import("@/domains/prefs/qualityLevels").RuntimeKnobs;
  changed: boolean;
  reason: AdaptReason | null;
  levels: import("@/domains/prefs/qualityLevels").KnobLevels;
};

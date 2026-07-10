import { describe, expect, it } from "vitest";
import {
  HUD_COUNTER_MS,
  HUD_PERF_MS,
  hudCriticalSignature,
  isHudContinuousUrgent,
  shouldPublishHud,
  shouldRefreshPerf,
  type HudCriticalFields,
} from "./hudPublish";

const base: HudCriticalFields = {
  hp: 100,
  armor: 0,
  mag: 30,
  reserve: 90,
  money: 800,
  weaponSlot: 1,
  phase: "live",
  round: 1,
  scoreTR: 0,
  scoreCT: 0,
  alive: true,
  paused: false,
  showScoreboard: false,
  showHelp: false,
  showBuyMenu: false,
  hitMarker: false,
  reloading: false,
  lowAmmo: false,
  spectating: false,
  roundBanner: null,
  bombState: "carried",
  bombPrompt: null,
  buyMessage: null,
  killFeedHead: "",
  chatHead: "",
  cameraMode: "locked",
  matchOver: false,
};

describe("hudCriticalSignature", () => {
  it("changes when hp drops", () => {
    const a = hudCriticalSignature(base);
    const b = hudCriticalSignature({ ...base, hp: 80 });
    expect(a).not.toBe(b);
  });

  it("stable when only time-like fields omitted", () => {
    expect(hudCriticalSignature(base)).toBe(hudCriticalSignature({ ...base }));
  });
});

describe("isHudContinuousUrgent", () => {
  it("true for hit / reload / flash / plant", () => {
    expect(
      isHudContinuousUrgent({
        damageFlash: 0,
        plantProgress: 0,
        defuseProgress: 0,
        reloading: false,
        hitMarker: true,
      }),
    ).toBe(true);
    expect(
      isHudContinuousUrgent({
        damageFlash: 0.5,
        plantProgress: 0,
        defuseProgress: 0,
        reloading: false,
        hitMarker: false,
      }),
    ).toBe(true);
    expect(
      isHudContinuousUrgent({
        damageFlash: 0,
        plantProgress: 0.2,
        defuseProgress: 0,
        reloading: false,
        hitMarker: false,
      }),
    ).toBe(true);
  });

  it("false when idle", () => {
    expect(
      isHudContinuousUrgent({
        damageFlash: 0,
        plantProgress: 0,
        defuseProgress: 0,
        reloading: false,
        hitMarker: false,
      }),
    ).toBe(false);
  });
});

describe("shouldPublishHud", () => {
  it("always publishes on first call", () => {
    expect(
      shouldPublishHud({
        now: 1000,
        lastPublishAt: 0,
        criticalSig: "a",
        lastCriticalSig: "",
        continuousUrgent: false,
      }),
    ).toBe(true);
  });

  it("publishes immediately when critical signature changes", () => {
    expect(
      shouldPublishHud({
        now: 1001,
        lastPublishAt: 1000,
        criticalSig: "b",
        lastCriticalSig: "a",
        continuousUrgent: false,
      }),
    ).toBe(true);
  });

  it("throttles steady counters", () => {
    expect(
      shouldPublishHud({
        now: 1000 + HUD_COUNTER_MS - 1,
        lastPublishAt: 1000,
        criticalSig: "a",
        lastCriticalSig: "a",
        continuousUrgent: false,
      }),
    ).toBe(false);
    expect(
      shouldPublishHud({
        now: 1000 + HUD_COUNTER_MS + 1,
        lastPublishAt: 1000,
        criticalSig: "a",
        lastCriticalSig: "a",
        continuousUrgent: false,
      }),
    ).toBe(true);
  });

  it("streams while continuous urgent", () => {
    expect(
      shouldPublishHud({
        now: 1001,
        lastPublishAt: 1000,
        criticalSig: "a",
        lastCriticalSig: "a",
        continuousUrgent: true,
      }),
    ).toBe(true);
  });
});

describe("shouldRefreshPerf", () => {
  it("respects 4 Hz when showFps", () => {
    expect(shouldRefreshPerf(1000, 0, true)).toBe(true);
    expect(shouldRefreshPerf(1000 + HUD_PERF_MS - 1, 1000, true)).toBe(false);
    expect(shouldRefreshPerf(1000 + HUD_PERF_MS + 1, 1000, true)).toBe(true);
  });

  it("never when overlay off", () => {
    expect(shouldRefreshPerf(5000, 0, false)).toBe(false);
  });
});

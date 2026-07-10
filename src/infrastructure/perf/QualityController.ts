/**
 * Auto-quality with discrete knobs, user-tier ceiling, and hysteresis.
 * Spec: docs/superpowers/specs/2026-07-09-browser-performance-design.md §3
 */

import type { GraphicsQuality } from "@/domains/prefs";
import {
  knobsFromLevels,
  targetMsForTier,
  TIER_MAX_LEVELS,
  type KnobLevels,
  type RuntimeKnobs,
} from "@/domains/prefs/qualityLevels";
import type { AdaptReason, QualityControllerTickResult } from "./types";

/** Sacrifice order when degrading (first dropped under load). */
export const DEGRADE_ORDER: (keyof KnobLevels)[] = [
  "fxBudget",
  "dust",
  "animLod",
  "pixelRatio",
  "shadows",
  "propDetail",
];

/** Restore order when upgrading (most valuable first). */
export const UPGRADE_ORDER: (keyof KnobLevels)[] = [
  "pixelRatio",
  "shadows",
  "propDetail",
  "animLod",
  "dust",
  "fxBudget",
];

export { knobsFromLevels, knobsForTier, targetMsForTier, TIER_MAX_LEVELS } from "@/domains/prefs/qualityLevels";

const EVAL_INTERVAL_MS = 1000;
const GRACE_MS = 3000;
const DEGRADE_STREAK = 2;
const UPGRADE_STREAK = 4;
const DEGRADE_COOLDOWN_MS = 4000;
const UPGRADE_COOLDOWN_MS = 6000;
const DEGRADE_RATIO = 1.15;
const UPGRADE_P95_RATIO = 0.85;
const UPGRADE_P50_RATIO = 0.75;
const EXTREME_MS = 33;
const EXTREME_HOLD_MS = 5000;

export type QualityControllerOptions = {
  now?: () => number;
};

function clampToCeiling(levels: KnobLevels, ceiling: KnobLevels): KnobLevels {
  return {
    fxBudget: Math.min(levels.fxBudget, ceiling.fxBudget),
    dust: Math.min(levels.dust, ceiling.dust),
    animLod: Math.min(levels.animLod, ceiling.animLod),
    pixelRatio: Math.min(levels.pixelRatio, ceiling.pixelRatio),
    shadows: Math.min(levels.shadows, ceiling.shadows),
    propDetail: Math.min(levels.propDetail, ceiling.propDetail),
  };
}

function levelsEqual(a: KnobLevels, b: KnobLevels): boolean {
  return (
    a.fxBudget === b.fxBudget &&
    a.dust === b.dust &&
    a.animLod === b.animLod &&
    a.pixelRatio === b.pixelRatio &&
    a.shadows === b.shadows &&
    a.propDetail === b.propDetail
  );
}

function tryStepDown(levels: KnobLevels): KnobLevels | null {
  for (const axis of DEGRADE_ORDER) {
    if (levels[axis] > 0) {
      return { ...levels, [axis]: levels[axis] - 1 };
    }
  }
  return null;
}

function tryStepUp(levels: KnobLevels, ceiling: KnobLevels): KnobLevels | null {
  for (const axis of UPGRADE_ORDER) {
    if (levels[axis] < ceiling[axis]) {
      return { ...levels, [axis]: levels[axis] + 1 };
    }
  }
  return null;
}

export class QualityController {
  private readonly now: () => number;
  private userTier: GraphicsQuality = "medium";
  private levels: KnobLevels = { ...TIER_MAX_LEVELS.medium };
  private lastEvalAt = 0;
  private graceUntil = 0;
  private cooldownUntil = 0;
  private badStreak = 0;
  private goodStreak = 0;
  private extremeSince: number | null = null;
  private lastReason: AdaptReason | null = "init";

  constructor(opts: QualityControllerOptions = {}) {
    this.now = opts.now ?? (() => performance.now());
    const t = this.now();
    this.graceUntil = t + GRACE_MS;
    this.lastEvalAt = t;
  }

  getUserTier(): GraphicsQuality {
    return this.userTier;
  }

  getLevels(): KnobLevels {
    return { ...this.levels };
  }

  getKnobs(): RuntimeKnobs {
    return knobsFromLevels(this.levels);
  }

  getLastReason(): AdaptReason | null {
    return this.lastReason;
  }

  /** Reset to tier ceiling and start grace period (user changed quality). */
  setUserTier(tier: GraphicsQuality, at?: number): RuntimeKnobs {
    const t = at ?? this.now();
    this.userTier = tier;
    this.levels = { ...TIER_MAX_LEVELS[tier] };
    this.graceUntil = t + GRACE_MS;
    this.cooldownUntil = 0;
    this.badStreak = 0;
    this.goodStreak = 0;
    this.extremeSince = null;
    this.lastReason = "user";
    this.lastEvalAt = t;
    return this.getKnobs();
  }

  /** Force knobs to exact tier preset (auto off). */
  freezeToTier(tier: GraphicsQuality): RuntimeKnobs {
    this.userTier = tier;
    this.levels = { ...TIER_MAX_LEVELS[tier] };
    this.lastReason = "user";
    return this.getKnobs();
  }

  tick(
    metrics: { p50FrameMs: number; p95FrameMs: number },
    opts: {
      autoEnabled: boolean;
      userTierMax: GraphicsQuality;
      documentHidden?: boolean;
    },
  ): QualityControllerTickResult {
    const t = this.now();
    const ceiling = TIER_MAX_LEVELS[opts.userTierMax];

    if (!opts.autoEnabled) {
      const prev = { ...this.levels };
      this.userTier = opts.userTierMax;
      this.levels = { ...ceiling };
      const changed = !levelsEqual(prev, this.levels);
      if (changed) this.lastReason = "user";
      return {
        knobs: knobsFromLevels(this.levels),
        changed,
        reason: changed ? "user" : null,
        levels: { ...this.levels },
      };
    }

    if (opts.userTierMax !== this.userTier) {
      this.userTier = opts.userTierMax;
      this.levels = clampToCeiling(this.levels, ceiling);
    }

    this.levels = clampToCeiling(this.levels, ceiling);

    if (opts.documentHidden) {
      return {
        knobs: knobsFromLevels(this.levels),
        changed: false,
        reason: null,
        levels: { ...this.levels },
      };
    }

    if (t < this.graceUntil) {
      this.lastReason = this.lastReason === "user" ? "user" : "grace";
      return {
        knobs: knobsFromLevels(this.levels),
        changed: false,
        reason: "grace",
        levels: { ...this.levels },
      };
    }

    if (t - this.lastEvalAt < EVAL_INTERVAL_MS) {
      return {
        knobs: knobsFromLevels(this.levels),
        changed: false,
        reason: null,
        levels: { ...this.levels },
      };
    }
    this.lastEvalAt = t;

    if (t < this.cooldownUntil) {
      return {
        knobs: knobsFromLevels(this.levels),
        changed: false,
        reason: null,
        levels: { ...this.levels },
      };
    }

    const target = targetMsForTier(opts.userTierMax);
    const p95 = metrics.p95FrameMs;
    const p50 = metrics.p50FrameMs;

    if (p95 > EXTREME_MS) {
      if (this.extremeSince == null) this.extremeSince = t;
      if (t - this.extremeSince >= EXTREME_HOLD_MS) {
        const next = tryStepDown(this.levels);
        if (next) {
          this.levels = next;
          this.cooldownUntil = t + DEGRADE_COOLDOWN_MS;
          this.badStreak = 0;
          this.goodStreak = 0;
          this.lastReason = "degrade";
          return {
            knobs: knobsFromLevels(this.levels),
            changed: true,
            reason: "degrade",
            levels: { ...this.levels },
          };
        }
      }
    } else {
      this.extremeSince = null;
    }

    const tooSlow = p95 > target * DEGRADE_RATIO;
    const headroom =
      p95 < target * UPGRADE_P95_RATIO && p50 < target * UPGRADE_P50_RATIO;

    if (tooSlow) {
      this.badStreak += 1;
      this.goodStreak = 0;
      if (this.badStreak >= DEGRADE_STREAK) {
        const next = tryStepDown(this.levels);
        this.badStreak = 0;
        if (next) {
          this.levels = next;
          this.cooldownUntil = t + DEGRADE_COOLDOWN_MS;
          this.lastReason = "degrade";
          return {
            knobs: knobsFromLevels(this.levels),
            changed: true,
            reason: "degrade",
            levels: { ...this.levels },
          };
        }
      }
    } else if (headroom) {
      this.goodStreak += 1;
      this.badStreak = 0;
      if (this.goodStreak >= UPGRADE_STREAK) {
        const next = tryStepUp(this.levels, ceiling);
        this.goodStreak = 0;
        if (next) {
          this.levels = next;
          this.cooldownUntil = t + UPGRADE_COOLDOWN_MS;
          this.lastReason = "upgrade";
          return {
            knobs: knobsFromLevels(this.levels),
            changed: true,
            reason: "upgrade",
            levels: { ...this.levels },
          };
        }
      }
    } else {
      this.badStreak = 0;
      this.goodStreak = 0;
    }

    return {
      knobs: knobsFromLevels(this.levels),
      changed: false,
      reason: null,
      levels: { ...this.levels },
    };
  }
}

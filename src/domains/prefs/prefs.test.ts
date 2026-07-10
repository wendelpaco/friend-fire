import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AUTO_QUALITY_KEY,
  CAMERA_DEFAULT_KEY,
  FOG_ENABLED_KEY,
  GRAPHICS_QUALITY_KEY,
  SHOW_FPS_KEY,
  getAutoQuality,
  getCameraDefault,
  getFogEnabled,
  getGraphicsQuality,
  getShowFps,
  resolveQualityConfig,
  setAutoQuality,
  setCameraDefault,
  setFogEnabled,
  setGraphicsQuality,
  setShowFps,
} from "./index";

/** Minimal localStorage for node test env. */
function installMemoryStorage() {
  const store = new Map<string, string>();
  const memory = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: memory,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "window", {
    value: globalThis,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  installMemoryStorage();
});

afterEach(() => {
  try {
    localStorage.removeItem(FOG_ENABLED_KEY);
    localStorage.removeItem(CAMERA_DEFAULT_KEY);
    localStorage.removeItem(GRAPHICS_QUALITY_KEY);
    localStorage.removeItem(SHOW_FPS_KEY);
    localStorage.removeItem(AUTO_QUALITY_KEY);
  } catch {
    /* ignore */
  }
});

describe("getFogEnabled / setFogEnabled", () => {
  it("defaults to true when unset", () => {
    expect(getFogEnabled()).toBe(true);
  });

  it("round-trips false and true", () => {
    setFogEnabled(false);
    expect(getFogEnabled()).toBe(false);
    expect(localStorage.getItem(FOG_ENABLED_KEY)).toBe("false");

    setFogEnabled(true);
    expect(getFogEnabled()).toBe(true);
    expect(localStorage.getItem(FOG_ENABLED_KEY)).toBe("true");
  });

  it("treats common falsey strings as off", () => {
    localStorage.setItem(FOG_ENABLED_KEY, "0");
    expect(getFogEnabled()).toBe(false);
    localStorage.setItem(FOG_ENABLED_KEY, "off");
    expect(getFogEnabled()).toBe(false);
  });
});

describe("getCameraDefault / setCameraDefault", () => {
  it("defaults to locked when unset", () => {
    expect(getCameraDefault()).toBe("locked");
  });

  it("round-trips free and locked", () => {
    setCameraDefault("free");
    expect(getCameraDefault()).toBe("free");
    expect(localStorage.getItem(CAMERA_DEFAULT_KEY)).toBe("free");

    setCameraDefault("locked");
    expect(getCameraDefault()).toBe("locked");
  });

  it("falls back to locked on invalid values", () => {
    localStorage.setItem(CAMERA_DEFAULT_KEY, "orbit");
    expect(getCameraDefault()).toBe("locked");
  });
});

describe("graphics quality", () => {
  it("defaults to medium with laptop-friendly knobs", () => {
    expect(getGraphicsQuality()).toBe("medium");
    const c = resolveQualityConfig();
    expect(c.maxPixelRatio).toBe(1.25);
    expect(c.shadowsEnabled).toBe(true);
    expect(c.propCastShadow).toBe(false);
    expect(c.dustCount).toBe(100);
  });

  it("round-trips tiers and resolves low = no shadows / no dust", () => {
    setGraphicsQuality("low");
    expect(getGraphicsQuality()).toBe("low");
    const low = resolveQualityConfig("low");
    expect(low.shadowsEnabled).toBe(false);
    expect(low.dustCount).toBe(0);
    expect(low.maxPixelRatio).toBe(1);

    setGraphicsQuality("high");
    const high = resolveQualityConfig("high");
    expect(high.shadowMapSize).toBe(2048);
    expect(high.propCastShadow).toBe(true);
    expect(high.maxPixelRatio).toBe(2);
  });

  it("show FPS defaults off and round-trips", () => {
    expect(getShowFps()).toBe(false);
    setShowFps(true);
    expect(getShowFps()).toBe(true);
    setShowFps(false);
    expect(getShowFps()).toBe(false);
  });

  it("auto quality defaults on and round-trips", () => {
    expect(getAutoQuality()).toBe(true);
    setAutoQuality(false);
    expect(getAutoQuality()).toBe(false);
    expect(localStorage.getItem(AUTO_QUALITY_KEY)).toBe("false");
    setAutoQuality(true);
    expect(getAutoQuality()).toBe(true);
  });

  it("tier presets include fxBudget and anim LOD distances", () => {
    const mid = resolveQualityConfig("medium");
    expect(mid.fxBudget).toBe(1);
    expect(mid.animLodFullDist).toBe(14);
    expect(mid.animLodMidDist).toBe(24);
    expect(mid.propDetail).toBe(1);
  });
});

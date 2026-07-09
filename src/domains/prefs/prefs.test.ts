import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CAMERA_DEFAULT_KEY,
  FOG_ENABLED_KEY,
  getCameraDefault,
  getFogEnabled,
  setCameraDefault,
  setFogEnabled,
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

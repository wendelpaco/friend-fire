import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_OPERATOR_ID, getSkin, OPERATORS } from "./catalog";
import {
  getOperatorPrefs,
  OPERATOR_ID_KEY,
  setOperatorPrefs,
  SKIN_ID_KEY,
} from "./prefs";

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
    localStorage.removeItem(OPERATOR_ID_KEY);
    localStorage.removeItem(SKIN_ID_KEY);
  } catch {
    /* ignore */
  }
});

describe("getOperatorPrefs / setOperatorPrefs", () => {
  it("defaults to first masc operator + default skin", () => {
    const prefs = getOperatorPrefs();
    expect(prefs.operatorId).toBe(DEFAULT_OPERATOR_ID);
    const op = OPERATORS.find((o) => o.id === DEFAULT_OPERATOR_ID)!;
    expect(prefs.skinId).toBe(op.defaultSkinId);
  });

  it("round-trips valid operator + skin", () => {
    setOperatorPrefs({ operatorId: "vesper", skinId: "vesper-alt" });
    const prefs = getOperatorPrefs();
    expect(prefs).toEqual({ operatorId: "vesper", skinId: "vesper-alt" });
    expect(localStorage.getItem(OPERATOR_ID_KEY)).toBe("vesper");
    expect(localStorage.getItem(SKIN_ID_KEY)).toBe("vesper-alt");
  });

  it("falls back on invalid operator id", () => {
    localStorage.setItem(OPERATOR_ID_KEY, "not-real");
    localStorage.setItem(SKIN_ID_KEY, "brick-default");
    const prefs = getOperatorPrefs();
    expect(prefs.operatorId).toBe(DEFAULT_OPERATOR_ID);
    expect(getSkin(prefs.skinId)?.operatorId).toBe(prefs.operatorId);
  });

  it("resets skin when it belongs to another operator", () => {
    setOperatorPrefs({ operatorId: "rook", skinId: "nyx-default" });
    const prefs = getOperatorPrefs();
    expect(prefs.operatorId).toBe("rook");
    expect(prefs.skinId).toBe("rook-default");
  });

  it("sanitizes empty strings", () => {
    setOperatorPrefs({ operatorId: "", skinId: "" });
    const prefs = getOperatorPrefs();
    expect(prefs.operatorId).toBe(DEFAULT_OPERATOR_ID);
    expect(prefs.skinId.length).toBeGreaterThan(0);
  });
});

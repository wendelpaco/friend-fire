import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MAP_ID,
  getLastMapId,
  LAST_MAP_STORAGE_KEY,
  setLastMapId,
} from "./lastMap";

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
    localStorage.removeItem(LAST_MAP_STORAGE_KEY);
  } catch {
    /* ignore */
  }
});

describe("ff_last_map", () => {
  it("defaults to dust when empty", () => {
    expect(getLastMapId()).toBe(DEFAULT_MAP_ID);
  });

  it("round-trips known map ids", () => {
    setLastMapId("favela");
    expect(getLastMapId()).toBe("favela");
    setLastMapId("yard");
    expect(getLastMapId()).toBe("yard");
  });

  it("falls back on unknown ids", () => {
    setLastMapId("not-a-map");
    expect(getLastMapId()).toBe(DEFAULT_MAP_ID);
  });
});

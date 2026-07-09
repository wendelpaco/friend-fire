import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsQueue, drainImpressions, pushImpression } from "./queue";
import type { AdImpression } from "@/domains/ads";

const store: Record<string, string> = {};

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  });
  vi.stubGlobal("window", globalThis);
});

function sample(id = "imp_1"): AdImpression {
  return {
    id,
    placement: "lobby_banner",
    creativeId: "himetrica",
    sessionId: "sess_test",
    at: 1000,
  };
}

describe("analytics queue", () => {
  it("push then drain length >= 1", () => {
    pushImpression(sample());
    const list = drainImpressions();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]?.creativeId).toBe("himetrica");
  });

  it("AnalyticsQueue facade matches functions", () => {
    AnalyticsQueue.push(sample("imp_2"));
    expect(AnalyticsQueue.drain().length).toBe(1);
  });

  it("caps stored impressions at 200", () => {
    for (let i = 0; i < 210; i++) {
      pushImpression(sample(`imp_${i}`));
    }
    expect(drainImpressions().length).toBe(200);
  });
});

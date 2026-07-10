import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnalyticsQueue,
  drainEvents,
  drainImpressions,
  pushEvent,
  pushImpression,
  trackBuyTiming,
} from "./queue";
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

  it("tracks buy open→close duration", () => {
    trackBuyTiming({
      round: 2,
      buyOpenMs: 1000,
      buyCloseOrLiveMs: 4200,
    });
    const events = drainEvents();
    expect(events.length).toBe(1);
    expect(events[0]?.name).toBe("buy_timing");
    expect(events[0]?.props?.duration_ms).toBe(3200);
    expect(events[0]?.props?.buy_open_ms).toBe(1000);
    expect(events[0]?.props?.buy_close_or_live_ms).toBe(4200);
    expect(events[0]?.props?.round).toBe(2);
  });

  it("pushEvent is available on facade", () => {
    pushEvent({ id: "e1", name: "test", at: 1 });
    expect(AnalyticsQueue.drainEvents().some((e) => e.name === "test")).toBe(
      true,
    );
  });
});

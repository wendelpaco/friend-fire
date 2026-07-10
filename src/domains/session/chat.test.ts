import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIVE_CHAT_CHANNEL,
  canReceiveChat,
  isChatChannel,
  parseLiveChatOutbound,
  resolvePartyId,
  sanitizeChatText,
  visibleLiveChatMessages,
} from "./chat";

describe("canReceiveChat", () => {
  const a = { partyId: "PARTY1", team: "TR" };
  const bSameParty = { partyId: "PARTY1", team: "CT" };
  const cOtherParty = { partyId: "PARTY2", team: "TR" };
  const emptyParty = { partyId: "", team: "TR" };

  it("all delivers to everyone", () => {
    expect(canReceiveChat("all", a, bSameParty)).toBe(true);
    expect(canReceiveChat("all", a, cOtherParty)).toBe(true);
    expect(canReceiveChat("all", a, emptyParty)).toBe(true);
  });

  it("team only same team", () => {
    expect(canReceiveChat("team", a, cOtherParty)).toBe(true);
    expect(canReceiveChat("team", a, bSameParty)).toBe(false);
  });

  it("squad only matching non-empty partyId", () => {
    expect(canReceiveChat("squad", a, bSameParty)).toBe(true);
    expect(canReceiveChat("squad", a, cOtherParty)).toBe(false);
    expect(canReceiveChat("squad", a, emptyParty)).toBe(false);
    expect(canReceiveChat("squad", emptyParty, a)).toBe(false);
  });
});

describe("sanitizeChatText", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitizeChatText("  oi   squad  ")).toBe("oi squad");
  });

  it("caps at 120 chars", () => {
    const long = "x".repeat(200);
    expect(sanitizeChatText(long).length).toBe(120);
  });

  it("rejects non-strings and empty", () => {
    expect(sanitizeChatText(null)).toBe("");
    expect(sanitizeChatText("   ")).toBe("");
  });
});

describe("isChatChannel", () => {
  it("accepts only squad|team|all", () => {
    expect(isChatChannel("squad")).toBe(true);
    expect(isChatChannel("team")).toBe(true);
    expect(isChatChannel("all")).toBe(true);
    expect(isChatChannel("radio")).toBe(false);
  });
});

describe("resolvePartyId", () => {
  it("uses explicit party option", () => {
    expect(
      resolvePartyId({
        partyOption: "ABC234",
        roomCode: "XYZ789",
        sessionId: "sess1",
        humanCountBeforeJoin: 2,
      }),
    ).toBe("ABC234");
  });

  it("host (first human) gets room code", () => {
    expect(
      resolvePartyId({
        partyOption: null,
        roomCode: "HOST01",
        sessionId: "sess1",
        humanCountBeforeJoin: 0,
      }),
    ).toBe("HOST01");
  });

  it("later join without party is solo sessionId", () => {
    expect(
      resolvePartyId({
        partyOption: "",
        roomCode: "HOST01",
        sessionId: "sess99",
        humanCountBeforeJoin: 1,
      }),
    ).toBe("sess99");
  });
});

describe("parseLiveChatOutbound", () => {
  it("defaults to TIME/team channel", () => {
    expect(DEFAULT_LIVE_CHAT_CHANNEL).toBe("team");
    expect(parseLiveChatOutbound("bora B")).toEqual({
      channel: "team",
      text: "bora B",
    });
  });

  it("requires explicit /todos for all", () => {
    expect(parseLiveChatOutbound("/todos gg")).toEqual({
      channel: "all",
      text: "gg",
    });
    expect(parseLiveChatOutbound("/todos")).toBeNull();
  });

  it("supports /time /squad overrides", () => {
    expect(parseLiveChatOutbound("/time ok")).toEqual({
      channel: "team",
      text: "ok",
    });
    expect(parseLiveChatOutbound("/squad ready")).toEqual({
      channel: "squad",
      text: "ready",
    });
  });
});

describe("visibleLiveChatMessages", () => {
  it("keeps last 2 within fade window", () => {
    const msgs = [
      { id: "old", at: 0 },
      { id: "a", at: 1000 },
      { id: "b", at: 2000 },
      { id: "c", at: 3000 },
    ];
    // now=3500 → old (3500ms age) still in 6s window; last 2 of remaining = b,c
    expect(
      visibleLiveChatMessages(msgs, 3500, { count: 2, fadeMs: 6000 }).map(
        (m) => m.id,
      ),
    ).toEqual(["b", "c"]);
    // now=9001 → only c (age 6001 > 6000 expired for b; c age 6001? c@3000 → 6001)
    // c@3000 age 6001 → expired too. Use 8500: b@2000 age 6500 out; c@3000 age 5500 in.
    expect(
      visibleLiveChatMessages(msgs, 8500, { count: 2, fadeMs: 6000 }).map(
        (m) => m.id,
      ),
    ).toEqual(["c"]);
    expect(
      visibleLiveChatMessages(msgs, 12000, { count: 2, fadeMs: 6000 }),
    ).toEqual([]);
  });

  it("expires network-shaped rows when at is receipt-time performance.now", () => {
    // appendNetworkChat stamps performance.now at receipt (not server Date.now).
    // Fade filter uses the same monotic clock — aged messages must leave the dock.
    const receiptPerf = 12_000;
    const msgs = [
      { id: "net-old", at: receiptPerf - 7000 }, // age 7s > 6s fade
      { id: "net-fresh", at: receiptPerf - 500 }, // age 0.5s — visible
    ];
    expect(
      visibleLiveChatMessages(msgs, receiptPerf, { count: 2, fadeMs: 6000 }).map(
        (m) => m.id,
      ),
    ).toEqual(["net-fresh"]);
    expect(
      visibleLiveChatMessages(msgs, receiptPerf + 6000, {
        count: 2,
        fadeMs: 6000,
      }),
    ).toEqual([]);
  });
});

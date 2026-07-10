import { describe, expect, it } from "vitest";
import {
  canReceiveChat,
  isChatChannel,
  resolvePartyId,
  sanitizeChatText,
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

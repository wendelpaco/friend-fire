import { describe, expect, it } from "vitest";
import { recordImpression } from "./impressions";

describe("recordImpression", () => {
  it("builds impression with required fields", () => {
    const imp = recordImpression({
      placement: "lobby_banner",
      creativeId: "himetrica",
      sessionId: "sess_1",
      now: 1000,
    });
    expect(imp.placement).toBe("lobby_banner");
    expect(imp.creativeId).toBe("himetrica");
    expect(imp.sessionId).toBe("sess_1");
    expect(imp.at).toBe(1000);
    expect(imp.id).toMatch(/^imp_/);
  });
});

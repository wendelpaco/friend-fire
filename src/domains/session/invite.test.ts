import { describe, expect, it } from "vitest";
import { buildInviteUrl } from "./invite";

describe("buildInviteUrl", () => {
  it("builds guest invite with host=0", () => {
    expect(buildInviteUrl("abc234", { origin: "http://localhost:3000" })).toBe(
      "http://localhost:3000/play?mode=room&code=ABC234&host=0",
    );
  });

  it("builds host invite with host=1", () => {
    expect(
      buildInviteUrl("xyz789", { origin: "https://ff.gg", host: true }),
    ).toBe("https://ff.gg/play?mode=room&code=XYZ789&host=1");
  });
});

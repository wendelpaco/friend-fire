import { describe, expect, it } from "vitest";
import { createId } from "./ids";
import { clamp } from "./math";

describe("createId", () => {
  it("prefixes id", () => {
    expect(createId("ad")).toMatch(/^ad_/);
  });
});

describe("clamp", () => {
  it("clamps to range", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
});

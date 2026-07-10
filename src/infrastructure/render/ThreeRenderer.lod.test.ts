import { describe, expect, it } from "vitest";
import {
  ANIM_LOD_FULL_DIST,
  ANIM_LOD_MID_DIST,
  pickCharacterLod,
} from "./ThreeRenderer";

describe("pickCharacterLod", () => {
  it("local player always full", () => {
    expect(pickCharacterLod(true, true, 100)).toBe("full");
    expect(pickCharacterLod(true, false, 100)).toBe("full");
  });

  it("invisible non-local is far", () => {
    expect(pickCharacterLod(false, false, 5)).toBe("far");
  });

  it("bands by distance", () => {
    expect(pickCharacterLod(false, true, 0)).toBe("full");
    expect(pickCharacterLod(false, true, ANIM_LOD_FULL_DIST)).toBe("full");
    expect(pickCharacterLod(false, true, ANIM_LOD_FULL_DIST + 0.01)).toBe(
      "mid",
    );
    expect(pickCharacterLod(false, true, ANIM_LOD_MID_DIST)).toBe("mid");
    expect(pickCharacterLod(false, true, ANIM_LOD_MID_DIST + 0.01)).toBe(
      "far",
    );
  });
});

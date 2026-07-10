import { describe, expect, it } from "vitest";
import { SOLDIER_TARGET_HEIGHT, SOLDIER_GLTF_URL } from "./SoldierGltf";

describe("SoldierGltf constants", () => {
  it("exposes public model URL and sensible height", () => {
    expect(SOLDIER_GLTF_URL).toBe("/models/soldier.glb");
    expect(SOLDIER_TARGET_HEIGHT).toBeGreaterThan(1.4);
    expect(SOLDIER_TARGET_HEIGHT).toBeLessThan(2.2);
  });
});

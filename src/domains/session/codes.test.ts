import { describe, expect, it } from "vitest";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "./codes";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

describe("generateRoomCode", () => {
  it("returns 6 characters from the unambiguous alphabet", () => {
    const code = generateRoomCode(() => 0);
    expect(code).toHaveLength(6);
    for (const ch of code) {
      expect(ALPHABET).toContain(ch);
    }
  });

  it("uses rng to pick characters", () => {
    // always pick last alphabet char
    const last = ALPHABET.length - 1;
    const code = generateRoomCode(() => last / ALPHABET.length);
    expect(code).toBe(ALPHABET[last]!.repeat(6));
  });

  it("never emits ambiguous O/0/I/1", () => {
    let n = 0;
    const code = generateRoomCode(() => {
      const r = (n % ALPHABET.length) / ALPHABET.length;
      n += 1;
      return r;
    });
    expect(code).not.toMatch(/[O0I1]/);
  });
});

describe("normalizeRoomCode", () => {
  it("trims, uppercases, and strips non-alphanumerics", () => {
    expect(normalizeRoomCode("  ab-cd_ef ")).toBe("ABCDEF");
  });
});

describe("isValidRoomCode", () => {
  it("accepts 6-char codes from alphabet", () => {
    expect(isValidRoomCode("ABCDEF")).toBe(true);
    expect(isValidRoomCode("  abcd23 ")).toBe(true);
  });

  it("rejects wrong length", () => {
    expect(isValidRoomCode("ABCDE")).toBe(false);
    expect(isValidRoomCode("ABCDEFG")).toBe(false);
  });

  it("rejects ambiguous O/0/I/1", () => {
    expect(isValidRoomCode("ABCDE0")).toBe(false);
    expect(isValidRoomCode("ABCDEO")).toBe(false);
    expect(isValidRoomCode("ABCDE1")).toBe(false);
    expect(isValidRoomCode("ABCDEI")).toBe(false);
  });
});

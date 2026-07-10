import { describe, expect, it } from "vitest";
import {
  extractRoomCodeFromText,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  parseSalaQuery,
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

describe("parseSalaQuery", () => {
  it("reads ?sala= preferred deep link", () => {
    expect(parseSalaQuery("?sala=ABC234")).toBe("ABC234");
    expect(parseSalaQuery("sala=abc234&x=1")).toBe("ABC234");
  });

  it("falls back to ?code=", () => {
    expect(parseSalaQuery("?code=XYZ789")).toBe("XYZ789");
  });

  it("prefers sala over code", () => {
    expect(parseSalaQuery("?sala=ABC234&code=XYZ789")).toBe("ABC234");
  });

  it("rejects invalid codes", () => {
    expect(parseSalaQuery("?sala=ABCDE0")).toBeNull();
    expect(parseSalaQuery("?sala=HI")).toBeNull();
    expect(parseSalaQuery("")).toBeNull();
  });
});

describe("extractRoomCodeFromText", () => {
  it("accepts bare valid codes", () => {
    expect(extractRoomCodeFromText("  abcd23 ")).toBe("ABCD23");
  });

  it("extracts from invite URL", () => {
    expect(
      extractRoomCodeFromText(
        "https://ff.gg/play?mode=room&code=ABC234&host=0",
      ),
    ).toBe("ABC234");
  });

  it("extracts from lobby deep link", () => {
    expect(extractRoomCodeFromText("https://ff.gg/?sala=XYZ789")).toBe(
      "XYZ789",
    );
  });

  it("rejects garbage", () => {
    expect(extractRoomCodeFromText("hello world")).toBeNull();
    expect(extractRoomCodeFromText("")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  applyRoundEconomy,
  clampMoney,
  clampMoneyPostRound,
  LOSS_PAYOUT_TOTALS,
  lossPayout,
  MAX_LOSS_STREAK,
  MAX_MONEY,
  MIN_MONEY_POST_ROUND,
  nextLossBonus,
  nextLossStreak,
  ROUND_LOSS_REWARD,
  ROUND_WIN_REWARD,
} from "./economy";

describe("CS economy", () => {
  it("clamps money to 0..16000", () => {
    expect(clampMoney(-10)).toBe(0);
    expect(clampMoney(20_000)).toBe(MAX_MONEY);
    expect(clampMoney(800.9)).toBe(800);
  });

  it("post-round floor is $1000", () => {
    expect(clampMoneyPostRound(0)).toBe(MIN_MONEY_POST_ROUND);
    expect(clampMoneyPostRound(500)).toBe(MIN_MONEY_POST_ROUND);
    expect(clampMoneyPostRound(1500)).toBe(1500);
    expect(clampMoneyPostRound(20_000)).toBe(MAX_MONEY);
  });

  it("loss payout matches design v2 ladder (cap 2900)", () => {
    // first loss $1400, then $1900, $2400, $2900 (no 5th $3400 step)
    expect(lossPayout(1)).toBe(1400);
    expect(lossPayout(2)).toBe(1900);
    expect(lossPayout(3)).toBe(2400);
    expect(lossPayout(4)).toBe(2900);
    expect(lossPayout(5)).toBe(2900);
    expect(lossPayout(9)).toBe(2900);
    expect(LOSS_PAYOUT_TOTALS).toEqual([1400, 1900, 2400, 2900]);
    expect(lossPayout(1)).toBe(ROUND_LOSS_REWARD + 0);
    expect(lossPayout(2)).toBe(ROUND_LOSS_REWARD + 500);
  });

  it("nextLossBonus previews payout if team loses next round", () => {
    expect(nextLossBonus(0)).toBe(1400);
    expect(nextLossBonus(1)).toBe(1900);
    expect(nextLossBonus(3)).toBe(2900);
    expect(nextLossBonus(4)).toBe(2900);
  });

  it("resets loss streak on win; caps at 4", () => {
    expect(nextLossStreak(3, true)).toBe(0);
    expect(nextLossStreak(3, false)).toBe(4);
    expect(nextLossStreak(4, false)).toBe(MAX_LOSS_STREAK);
  });

  it("applyRoundEconomy pays win/loss, updates streaks, applies floor", () => {
    const players = [
      { team: "TR" as const, money: 800, id: "a" },
      { team: "CT" as const, money: 800, id: "b" },
    ];
    const r1 = applyRoundEconomy(players, "TR", 0, 0);
    expect(r1.lossStreakTR).toBe(0);
    expect(r1.lossStreakCT).toBe(1);
    expect(r1.players[0]!.money).toBe(800 + ROUND_WIN_REWARD);
    expect(r1.players[1]!.money).toBe(800 + 1400); // first loss

    const r2 = applyRoundEconomy(r1.players, "TR", r1.lossStreakTR, r1.lossStreakCT);
    expect(r2.lossStreakCT).toBe(2);
    expect(r2.players[1]!.money).toBe(
      r1.players[1]!.money + 1900, // second consecutive loss
    );

    const r3 = applyRoundEconomy(r2.players, "TR", r2.lossStreakTR, r2.lossStreakCT);
    expect(r3.lossStreakCT).toBe(3);
    expect(r3.players[1]!.money).toBe(r2.players[1]!.money + 2400);

    const r4 = applyRoundEconomy(r3.players, "TR", r3.lossStreakTR, r3.lossStreakCT);
    expect(r4.lossStreakCT).toBe(4);
    expect(r4.players[1]!.money).toBe(r3.players[1]!.money + 2900);
  });

  it("applyRoundEconomy never leaves wallet below post-round floor", () => {
    // Broke player who somehow ends with low cash before payout still floors
    const players = [{ team: "CT" as const, money: 0 }];
    const r = applyRoundEconomy(players, "TR", 0, 0);
    // 0 + 1400 = 1400 >= floor
    expect(r.players[0]!.money).toBe(1400);
    // Extreme: if pay were 0 we'd still floor — verify clamp helper path
    expect(clampMoneyPostRound(0 + 0)).toBe(MIN_MONEY_POST_ROUND);
  });

  it("never exceeds max money", () => {
    const players = [{ team: "TR" as const, money: 15_500 }];
    const r = applyRoundEconomy(players, "TR", 0, 0);
    expect(r.players[0]!.money).toBe(MAX_MONEY);
  });
});

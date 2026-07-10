import { describe, expect, it } from "vitest";
import {
  applyRoundEconomy,
  clampMoney,
  lossPayout,
  MAX_MONEY,
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

  it("loss payout grows with consecutive losses", () => {
    expect(lossPayout(1)).toBe(ROUND_LOSS_REWARD + 500);
    expect(lossPayout(2)).toBe(ROUND_LOSS_REWARD + 1000);
    expect(lossPayout(5)).toBe(ROUND_LOSS_REWARD + 2400);
    expect(lossPayout(9)).toBe(ROUND_LOSS_REWARD + 2400);
  });

  it("resets loss streak on win", () => {
    expect(nextLossStreak(3, true)).toBe(0);
    expect(nextLossStreak(3, false)).toBe(4);
    expect(nextLossStreak(5, false)).toBe(5);
  });

  it("applyRoundEconomy pays win/loss and updates streaks", () => {
    const players = [
      { team: "TR" as const, money: 800, id: "a" },
      { team: "CT" as const, money: 800, id: "b" },
    ];
    const r1 = applyRoundEconomy(players, "TR", 0, 0);
    expect(r1.lossStreakTR).toBe(0);
    expect(r1.lossStreakCT).toBe(1);
    expect(r1.players[0]!.money).toBe(800 + ROUND_WIN_REWARD);
    expect(r1.players[1]!.money).toBe(800 + lossPayout(1));

    const r2 = applyRoundEconomy(r1.players, "TR", r1.lossStreakTR, r1.lossStreakCT);
    expect(r2.lossStreakCT).toBe(2);
    expect(r2.players[1]!.money).toBe(
      r1.players[1]!.money + lossPayout(2),
    );
  });

  it("never exceeds max money", () => {
    const players = [{ team: "TR" as const, money: 15_500 }];
    const r = applyRoundEconomy(players, "TR", 0, 0);
    expect(r.players[0]!.money).toBe(MAX_MONEY);
  });
});

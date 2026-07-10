/**
 * CS-style round economy (client + offline sim).
 * Win / loss base + consecutive loss bonus, hard cap $16k.
 * Sprint 1 B3/F6: floor $1000 post-round; loss ladder 1400→2900.
 */

import type { Team } from "@/shared/types/team";

export const KILL_REWARD = 300;
/** Personal plant bonus (TR planter). */
export const PLANT_REWARD = 300;
/** Team bonus when bomb explodes (all TR). */
export const BOMB_EXPLODE_TEAM_REWARD = 800;
/** Round win payout (elimination / objective). */
export const ROUND_WIN_REWARD = 3250;
/** Base loss payout before consecutive-loss bonus. */
export const ROUND_LOSS_REWARD = 1400;
/** Max wallet after any credit. */
export const MAX_MONEY = 16_000;
/**
 * Absolute floor after round payouts (F6).
 * Does **not** apply during buy spend — players may go to $0 in freezetime.
 */
export const MIN_MONEY_POST_ROUND = 1_000;
/** Starting money (first join / match start / half reset). */
export const START_MONEY = 800;

/**
 * CS consecutive-loss bonus **added on top of** ROUND_LOSS_REWARD for losses 1…4.
 * Totals: $1400, $1900, $2400, $2900 (design v2 cap — no 5th $3400 step).
 */
export const LOSS_BONUS_STEPS = [0, 500, 1000, 1500] as const;

/** Design v2 loss payout totals for consecutive losses 1…4. */
export const LOSS_PAYOUT_TOTALS = [1400, 1900, 2400, 2900] as const;

/** Max consecutive loss streak tracked (ladder caps at 4). */
export const MAX_LOSS_STREAK = 4;

export function clampMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_MONEY, Math.floor(n)));
}

/** Post-round clamp: never below floor, never above max. */
export function clampMoneyPostRound(n: number): number {
  if (!Number.isFinite(n)) return MIN_MONEY_POST_ROUND;
  return Math.max(
    MIN_MONEY_POST_ROUND,
    Math.min(MAX_MONEY, Math.floor(n)),
  );
}

/**
 * @param consecutiveLosses how many losses in a row **including** this round (1…4+)
 * @returns design v2 total: 1400 / 1900 / 2400 / 2900
 */
export function lossPayout(consecutiveLosses: number): number {
  const n = Math.max(1, Math.min(MAX_LOSS_STREAK, Math.floor(consecutiveLosses)));
  const bonus = LOSS_BONUS_STEPS[n - 1] ?? 1500;
  return ROUND_LOSS_REWARD + bonus;
}

/**
 * What the team would earn if they **lose the next** round, given current streak
 * (streak is consecutive losses already banked, 0…4).
 */
export function nextLossBonus(currentStreak: number): number {
  const c = Math.max(0, Math.floor(currentStreak));
  return lossPayout(Math.min(MAX_LOSS_STREAK, c + 1));
}

/** After a round: win → streak 0; loss → streak+1 (capped 4). */
export function nextLossStreak(current: number, teamWon: boolean): number {
  if (teamWon) return 0;
  const c = Math.max(0, Math.floor(current));
  return Math.min(MAX_LOSS_STREAK, c + 1);
}

/**
 * Credit round money. Uses **pre-round** loss streaks (before increment).
 * Applies post-round floor $1000. Returns new money + updated streaks.
 */
export function applyRoundEconomy<
  T extends { team: Team; money: number },
>(
  players: readonly T[],
  winner: Team,
  lossStreakTR: number,
  lossStreakCT: number,
): {
  players: T[];
  lossStreakTR: number;
  lossStreakCT: number;
} {
  const nextTR = nextLossStreak(lossStreakTR, winner === "TR");
  const nextCT = nextLossStreak(lossStreakCT, winner === "CT");

  // Payout uses the streak **after** this loss for losers (CS: first loss = $1400)
  const trPay =
    winner === "TR" ? ROUND_WIN_REWARD : lossPayout(nextTR);
  const ctPay =
    winner === "CT" ? ROUND_WIN_REWARD : lossPayout(nextCT);

  const nextPlayers = players.map((p) => {
    const add = p.team === "TR" ? trPay : ctPay;
    return {
      ...p,
      money: clampMoneyPostRound(p.money + add),
    };
  });

  return {
    players: nextPlayers,
    lossStreakTR: nextTR,
    lossStreakCT: nextCT,
  };
}

/** @deprecated prefer applyRoundEconomy — kept for simple tests */
export function moneyAfterRound(
  team: Team,
  winner: Team,
  current: number,
  lossStreak = 0,
): number {
  if (team === winner) return clampMoneyPostRound(current + ROUND_WIN_REWARD);
  const next = nextLossStreak(lossStreak, false);
  return clampMoneyPostRound(current + lossPayout(next));
}

export function applyRoundMoney<T extends { team: Team; money: number }>(
  players: readonly T[],
  winner: Team,
  rewards: { win: number; loss: number } = {
    win: ROUND_WIN_REWARD,
    loss: ROUND_LOSS_REWARD,
  },
): T[] {
  return players.map((p) => ({
    ...p,
    money: clampMoneyPostRound(
      p.money + (p.team === winner ? rewards.win : rewards.loss),
    ),
  }));
}

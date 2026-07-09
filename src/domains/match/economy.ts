import type { Team } from "@/shared/types/team";

export const KILL_REWARD = 300;
export const ROUND_WIN_REWARD = 3250;
export const ROUND_LOSS_REWARD = 1400;

export function moneyAfterRound(
  team: Team,
  winner: Team,
  current: number,
): number {
  return current + (team === winner ? ROUND_WIN_REWARD : ROUND_LOSS_REWARD);
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
    money: p.money + (p.team === winner ? rewards.win : rewards.loss),
  }));
}

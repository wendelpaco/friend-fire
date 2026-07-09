export type RewardedResult = "completed" | "skipped" | "error";

export interface RewardedAdPort {
  show(placement: "rewarded_xp"): Promise<RewardedResult>;
}

export class StubRewardedAdPort implements RewardedAdPort {
  async show(): Promise<RewardedResult> {
    return "completed";
  }
}

export function grantRewardedXp(currentXp: number, amount: number): number {
  return Math.max(0, currentXp) + Math.max(0, amount);
}

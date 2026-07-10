import { Bomb } from "@/presentation/icons";

type ObjectiveChipProps = {
  /** Objective type shown as chip above hotbar. */
  kind: "c4_carry" | "c4_plant" | "c4_defuse" | "defend_a" | "defend_b";
  className?: string;
};

const LABEL: Record<ObjectiveChipProps["kind"], string> = {
  c4_carry: "C4 · SEGURE F",
  c4_plant: "PLANTE A C4",
  c4_defuse: "DESARME A C4",
  defend_a: "DEFENDA A",
  defend_b: "DEFENDA B",
};

/**
 * FF Tactical objective chip — compact amber badge above hotbar.
 * Replaces persistent full-width banners for state (not events).
 * Per spec C6: state = chip; event = banner ≤3s.
 */
export function ObjectiveChip({ kind, className = "" }: ObjectiveChipProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-[var(--ff-radius-sm)] border border-amber-500/50 bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100 shadow-[var(--ff-glow-amber)] ${className}`}
    >
      <Bomb size={12} />
      <span>{LABEL[kind]}</span>
    </div>
  );
}

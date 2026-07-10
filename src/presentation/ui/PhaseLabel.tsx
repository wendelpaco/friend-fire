import type { ReactNode } from "react";

export type TimerMode = "normal" | "low" | "bomb";

type PhaseLabelProps = {
  phase: "warmup" | "buy" | "live" | "ended" | "match_over";
  timeLeft: number;
  round?: number;
  className?: string;
  /**
   * Clock presentation:
   * - normal — default white
   * - low — round clock &lt;10s (amber warn)
   * - bomb — fuse clock (red + pulse handled by wrapper)
   */
  timerMode?: TimerMode;
  /** Brief plant toast under clock (≤2s). */
  plantFlash?: boolean;
  /** While CT is defusing (sub-label). */
  defusing?: boolean;
};

function formatTime(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * FF Tactical phase label — warmup/buy/live round header.
 * Timer is one visual tier above TR/CT score numbers (design v2).
 * On plant the same block becomes the C4 fuse (no second competing clock).
 */
export function PhaseLabel({
  phase,
  timeLeft,
  round,
  className = "",
  timerMode = "normal",
  plantFlash = false,
  defusing = false,
}: PhaseLabelProps) {
  const showClock = phase === "live" || phase === "buy" || phase === "warmup";
  const bombMode = timerMode === "bomb";
  const lowMode = timerMode === "low";

  const primary = showClock
    ? formatTime(timeLeft)
    : phase === "ended"
      ? "FIM DO ROUND"
      : phase === "match_over"
        ? "FIM DA PARTIDA"
        : formatTime(timeLeft);

  const clockClass = bombMode
    ? "font-mono text-4xl leading-none text-red-200 drop-shadow-[0_0_14px_rgba(239,68,68,0.55)]"
    : lowMode
      ? "font-mono text-4xl leading-none text-amber-200 motion-safe:animate-ff-blink-warn"
      : "font-mono text-4xl leading-none text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.18)]";

  let sub: ReactNode = null;
  if (plantFlash && bombMode) {
    sub = (
      <span className="text-[9px] font-black tracking-[0.28em] text-red-300">
        C4 PLANTADA
      </span>
    );
  } else if (bombMode) {
    sub = (
      <span className="text-[9px] font-semibold tracking-[0.28em] text-red-300/80">
        {defusing ? "DESARMANDO" : "C4"}
        {round != null && round > 0 ? ` · R${round}` : ""}
      </span>
    );
  } else if (phase === "buy" || phase === "warmup" || phase === "live") {
    sub = (
      <span className="text-[9px] font-semibold tracking-[0.28em] text-white/40">
        {phase === "buy" ? "COMPRA" : phase === "warmup" ? "WARMUP" : "ROUND"}{" "}
        {round != null && round > 0 ? round : "—"}
      </span>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <span
        className={`font-black tabular-nums tracking-wide ${
          showClock
            ? clockClass
            : "text-2xl leading-tight text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.18)]"
        }`}
      >
        {primary}
      </span>
      {sub}
    </div>
  );
}

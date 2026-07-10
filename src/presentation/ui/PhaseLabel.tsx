type PhaseLabelProps = {
  phase: "warmup" | "buy" | "live" | "ended" | "match_over";
  timeLeft: number;
  round?: number;
  className?: string;
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
 */
export function PhaseLabel({
  phase,
  timeLeft,
  round,
  className = "",
}: PhaseLabelProps) {
  const showClock = phase === "live" || phase === "buy" || phase === "warmup";
  const primary = showClock
    ? formatTime(timeLeft)
    : phase === "ended"
      ? "FIM DO ROUND"
      : phase === "match_over"
        ? "FIM DA PARTIDA"
        : formatTime(timeLeft);

  const sub =
    phase === "buy" || phase === "warmup" || phase === "live" ? (
      <span className="text-[9px] font-semibold tracking-[0.28em] text-white/40">
        {phase === "buy" ? "COMPRA" : phase === "warmup" ? "WARMUP" : "ROUND"}{" "}
        {round != null && round > 0 ? round : "—"}
      </span>
    ) : null;

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <span
        className={`font-black tabular-nums tracking-wide text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.18)] ${
          showClock
            ? "font-mono text-4xl leading-none"
            : "text-2xl leading-tight"
        }`}
      >
        {primary}
      </span>
      {sub}
    </div>
  );
}

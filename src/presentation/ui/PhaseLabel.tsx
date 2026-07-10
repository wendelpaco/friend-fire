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
 * Extracted from GameHud phaseLabel logic.
 */
export function PhaseLabel({
  phase,
  timeLeft,
  round,
  className = "",
}: PhaseLabelProps) {
  const map: Record<string, string> = {
    warmup: "AQUECIMENTO",
    buy: "COMPRA",
    ended: "FIM DO ROUND",
    match_over: "FIM DA PARTIDA",
    live: formatTime(timeLeft),
  };

  const label = map[phase] ?? formatTime(timeLeft);
  const sub = (phase === "buy" || phase === "warmup" || phase === "live") ? (
    <span className="text-[9px] font-semibold tracking-[0.28em] text-white/40">
      {phase === "buy" ? "COMPRA" : phase === "warmup" ? "WARMUP" : "ROUND"}{" "}
      {round != null && round > 0 ? round : "—"}
    </span>
  ) : null;

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <span className="text-2xl font-black tabular-nums tracking-wide text-white">
        {label}
      </span>
      {sub}
    </div>
  );
}

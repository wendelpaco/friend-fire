type TimerBarProps = {
  /** Remaining fraction 0–1 (1 = full time left). */
  progress: number;
  className?: string;
  label?: string;
};

/** FF Tactical countdown bar for showcase / freezetime cues. */
export function TimerBar({
  progress,
  className = "",
  label,
}: TimerBarProps) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="mb-1 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--ff-muted)]">
          {label}
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full border border-[color:var(--ff-border)] bg-black/50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-[width] duration-100 ease-linear"
          style={{ width: `${p * 100}%` }}
        />
      </div>
    </div>
  );
}

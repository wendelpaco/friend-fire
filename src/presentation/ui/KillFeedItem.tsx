type KillFeedItemProps = {
  killer: string;
  victim: string;
  weapon: string;
  /** Amber border when local player is the killer (kill confirm). */
  localKiller?: boolean;
  className?: string;
};

/**
 * FF Tactical kill-feed entry — killer · weapon · victim.
 * Extracted from GameHud inline kill-feed rendering.
 */
export function KillFeedItem({
  killer,
  victim,
  weapon,
  localKiller = false,
  className = "",
}: KillFeedItemProps) {
  const border = localKiller
    ? "border-amber-400/80 shadow-amber-500/20 ring-1 ring-amber-400/40"
    : "border-white/12";
  return (
    <div
      className={`motion-safe:animate-kill-feed-in flex items-center gap-2 rounded-md border bg-black/70 px-2.5 py-1.5 text-[11px] shadow-lg shadow-black/40 backdrop-blur-md ${border} ${className}`}
    >
      <span className="max-w-[7rem] truncate font-semibold text-[var(--ff-killer)]">
        {killer}
      </span>
      <span
        className="shrink-0 rounded border border-amber-400/25 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-amber-200/80"
        title={weapon}
      >
        {weapon}
      </span>
      <span className="max-w-[7rem] truncate font-semibold text-[var(--ff-victim)]">
        {victim}
      </span>
    </div>
  );
}

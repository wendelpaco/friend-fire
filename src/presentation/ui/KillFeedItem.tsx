type KillFeedItemProps = {
  killer: string;
  victim: string;
  weapon: string;
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
  className = "",
}: KillFeedItemProps) {
  return (
    <div
      className={`motion-safe:animate-kill-feed-in flex items-center gap-2 rounded-md border border-white/12 bg-black/70 px-2.5 py-1.5 text-[11px] shadow-lg shadow-black/40 backdrop-blur-md ${className}`}
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

"use client";

import { useEffect, useState } from "react";
import { recordImpression } from "@/domains/ads";
import { getOrCreateSessionId } from "@/domains/identity";
import {
  pickRotatingAd,
  type AdCreative,
  type AdPlacement,
} from "@/game/ads/catalog";
import { pushImpression } from "@/infrastructure/analytics/queue";

interface AdBannerProps {
  placement: AdPlacement;
  className?: string;
  rotateMs?: number;
  compact?: boolean;
}

export function AdBanner({
  placement,
  className = "",
  rotateMs = 8000,
  compact = false,
}: AdBannerProps) {
  const [index, setIndex] = useState(0);
  const ad = pickRotatingAd(placement, index);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => i + 1), rotateMs);
    return () => clearInterval(t);
  }, [rotateMs]);

  // Impression on mount and each creative rotation
  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    const imp = recordImpression({
      placement,
      creativeId: ad.id,
      sessionId,
    });
    pushImpression(imp);
  }, [placement, ad.id, index]);

  return (
    <a
      href={ad.url || "#"}
      target={ad.url ? "_blank" : undefined}
      rel={ad.url ? "noopener noreferrer" : undefined}
      onClick={(e) => {
        if (!ad.url) e.preventDefault();
      }}
      className={`group relative block overflow-hidden rounded-lg border border-white/10 shadow-lg transition hover:border-white/25 hover:shadow-xl ${className}`}
      style={{
        background: `linear-gradient(135deg, ${ad.bg}, ${ad.bg2 ?? ad.bg})`,
      }}
      aria-label={`Anúncio: ${ad.brand}`}
    >
      <div
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: ad.accent }}
      />
      <div
        className={`flex h-full flex-col justify-center ${compact ? "px-3 py-2" : "px-4 py-3"}`}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <span
            className="text-[10px] font-bold tracking-[0.2em]"
            style={{ color: ad.accent }}
          >
            {ad.brand}
          </span>
          <span className="rounded bg-black/35 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-white/55">
            AD
          </span>
        </div>
        <div
          className={`font-bold leading-tight ${compact ? "text-sm" : "text-base"}`}
          style={{ color: ad.text }}
        >
          {ad.headline}
        </div>
        {ad.subline && !compact && (
          <div className="mt-0.5 text-xs text-white/60">{ad.subline}</div>
        )}
        {ad.cta && (
          <div
            className="mt-2 inline-flex w-fit rounded px-2 py-0.5 text-[10px] font-bold tracking-wide"
            style={{ background: ad.accent, color: ad.bg }}
          >
            {ad.cta}
          </div>
        )}
      </div>
    </a>
  );
}

export function AdChip({ ad }: { ad: AdCreative }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-white/10 px-2 py-1 text-[10px]"
      style={{
        background: `linear-gradient(90deg, ${ad.bg}, ${ad.bg2 ?? ad.bg})`,
        color: ad.text,
      }}
    >
      <span style={{ color: ad.accent }} className="font-bold">
        {ad.brand}
      </span>
      <span className="opacity-70">{ad.headline}</span>
    </div>
  );
}

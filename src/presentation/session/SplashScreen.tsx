"use client";

import { useCallback, useEffect, useState } from "react";
import { GAME_NAME, GAME_TAGLINE } from "@/game/constants";
import { Button } from "@/presentation/ui/Panel";

const SKIP_KEY = "ff_skip_splash";

export type SplashScreenProps = {
  /** Called after splash dismiss (Enter / Jogar). */
  onEnter: () => void;
};

/**
 * Full-bleed cover splash (Meta-1).
 * Optional “não mostrar de novo” → localStorage `ff_skip_splash`.
 */
export function SplashScreen({ onEnter }: SplashScreenProps) {
  const [skipNext, setSkipNext] = useState(false);

  const dismiss = useCallback(() => {
    if (skipNext) {
      try {
        localStorage.setItem(SKIP_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    onEnter();
  }, [onEnter, skipNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-end overflow-hidden bg-[color:var(--ff-void)] text-white sm:justify-center">
      {/* Cover art */}
      <div className="pointer-events-none absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/covers/ff-cover.svg"
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--ff-void)] via-[color:var(--ff-void)]/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--ff-void)]/70 via-transparent to-[color:var(--ff-void)]/40" />
      </div>

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center px-6 pb-16 pt-24 text-center sm:pb-8">
        <p className="mb-3 text-[10px] font-semibold tracking-[0.4em] text-amber-500/90">
          ONLINE · BROWSER
        </p>
        <h1 className="text-5xl font-black leading-none tracking-tight sm:text-6xl md:text-7xl">
          <span className="bg-gradient-to-r from-red-500 via-orange-400 to-amber-300 bg-clip-text text-transparent">
            FRIEND
          </span>
          <span className="text-white"> FIRE</span>
        </h1>
        <p className="mt-4 text-xs font-medium tracking-[0.28em] text-white/45">
          {GAME_TAGLINE}
        </p>
        <p className="mt-2 text-sm text-white/35">
          Capa tática · identidade · loadout · live
        </p>

        <Button
          variant="primary"
          onClick={dismiss}
          className="mt-10 w-full max-w-xs py-4 text-base tracking-[0.28em]"
        >
          JOGAR
        </Button>
        <p className="mt-3 text-[11px] text-white/30">
          Enter · {GAME_NAME}
        </p>

        <label className="mt-8 flex cursor-pointer items-center gap-2 text-xs text-white/45 transition hover:text-white/70">
          <input
            type="checkbox"
            checked={skipNext}
            onChange={(e) => setSkipNext(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-white/20 accent-amber-500"
          />
          Não mostrar de novo
        </label>
      </div>
    </div>
  );
}

/** Read skip flag (client-only). */
export function shouldSkipSplash(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

export { SKIP_KEY as SPLASH_SKIP_KEY };

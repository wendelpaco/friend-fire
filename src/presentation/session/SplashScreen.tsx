"use client";

import { useCallback, useEffect, useState } from "react";
import { GAME_NAME, GAME_TAGLINE } from "@/game/constants";

const SKIP_KEY = "ff_skip_splash";

export type SplashScreenProps = { onEnter: () => void };

export function SplashScreen({ onEnter }: SplashScreenProps) {
  const [skipNext, setSkipNext] = useState(false);
  const dismiss = useCallback(() => {
    if (skipNext) { try { localStorage.setItem(SKIP_KEY, "1"); } catch {} }
    onEnter();
  }, [onEnter, skipNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dismiss(); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-end overflow-hidden bg-[#0B0D10] text-[#F4EFE3] sm:justify-center">
      {/* Cover art */}
      <div className="pointer-events-none absolute inset-0">
        <img src="/covers/ff-cover.svg" alt="" className="h-full w-full object-cover" draggable={false} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D10] via-[#0B0D10]/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0D10]/70 via-transparent to-[#0B0D10]/40" />
        {/* Scanlines */}
        <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)" }} />
      </div>

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center px-6 pb-16 pt-24 text-center sm:pb-8">
        <p className="mb-3 text-[10px] font-bold tracking-[0.35em] text-[#FFB300]">ONLINE · BROWSER</p>
        <h1 className="text-5xl font-black leading-none tracking-tight sm:text-6xl md:text-7xl">
          <span className="bg-gradient-to-r from-red-500 via-orange-400 to-[#FFD166] bg-clip-text text-transparent">FRIEND</span>
          <span className="text-[#F4EFE3]"> FIRE</span>
        </h1>
        <p className="mt-4 text-xs font-semibold tracking-[0.28em] text-[#6F6A5B]">{GAME_TAGLINE}</p>

        <button type="button" onClick={dismiss}
          className="btn-press-ff mt-10 w-full max-w-xs border-2 border-[#B87900] bg-[#FFB300] px-5 py-4 text-base font-black tracking-[0.25em] text-[#0B0D10]"
          style={{ boxShadow: "3px 3px 0 0 rgba(0,0,0,0.5)" }}>
          JOGAR
        </button>
        <p className="mt-3 text-[11px] text-[#6F6A5B]">Enter · {GAME_NAME}</p>

        <label className="mt-8 flex cursor-pointer items-center gap-2 text-xs text-[#6F6A5B] hover:text-[#B9B29F]">
          <input type="checkbox" checked={skipNext} onChange={(e) => setSkipNext(e.target.checked)} className="h-3.5 w-3.5 accent-[#FFB300]" />
          Não mostrar de novo
        </label>
      </div>
    </div>
  );
}

export function shouldSkipSplash(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(SKIP_KEY) === "1"; } catch { return false; }
}
export { SKIP_KEY as SPLASH_SKIP_KEY };

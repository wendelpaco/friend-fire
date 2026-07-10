"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GAME_NAME } from "@/game/constants";

export type MatchLoadingPhase = "connect" | "map" | "sync" | "ready";

type MatchLoadingScreenProps = {
  /** Map display name */
  mapName?: string;
  /** Operator name from prefs */
  operatorName?: string;
  /** Room code if multiplayer */
  roomCode?: string;
  /** External ready (engine booted) */
  engineReady?: boolean;
  /** Minimum time on screen for polish (ms) */
  minMs?: number;
  onFinished?: () => void;
};

/** Named load stages (Sprint 1 lobby/loading premium). */
export const LOADING_STEPS: {
  id: MatchLoadingPhase;
  label: string;
  at: number;
}[] = [
  { id: "connect", label: "Conectando à sala", at: 0 },
  { id: "map", label: "Carregando mapa", at: 0.28 },
  { id: "sync", label: "Sincronizando", at: 0.62 },
  { id: "ready", label: "Pronto", at: 0.94 },
];

/** One-line tactical tips — rotate lightly; never spam. */
export const LOADING_TIPS = [
  "Parado, seu primeiro tiro é perfeito.",
  "Som alto? Alguém está correndo perto.",
  "Economia: full buy juntos valem mais que eco solo.",
  "Bomba plantada: CT joga o clock, não o ego.",
  "Spray curto. Corrija com mirar, não com munição.",
] as const;

/**
 * Cinematic match boot splash — CS-style cover energy, original FF art.
 * Real staged progress; waits for engineReady + minMs before finish.
 */
export function MatchLoadingScreen({
  mapName = "Dust FF",
  operatorName = "Operador",
  roomCode,
  engineReady = false,
  minMs = 2800,
  onFinished,
}: MatchLoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [started] = useState(() => performance.now());
  const [done, setDone] = useState(false);
  const [tip] = useState(
    () => LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]!,
  );
  /** Prevent double-finish; never cancelled by effect cleanup. */
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const phase = useMemo(() => {
    let current = LOADING_STEPS[0]!;
    for (const s of LOADING_STEPS) {
      if (progress >= s.at) current = s;
    }
    return current;
  }, [progress]);

  useEffect(() => {
    let raf = 0;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const elapsed = performance.now() - started;
      // Weighted stages: ease toward 0.92 until engine ready, then sprint to 1
      const base = Math.min(0.92, elapsed / Math.max(1, minMs));
      const target = engineReady
        ? Math.min(1, Math.max(base, 0.55) + Math.max(0, elapsed - minMs) / 400)
        : base;
      setProgress((p) => {
        const next = p + (target - p) * 0.18;
        return next >= 0.998 ? 1 : next;
      });

      // Finish once: engine ready + min time + near-full bar
      if (
        !finishedRef.current &&
        engineReady &&
        elapsed >= minMs &&
        (target >= 1 || elapsed >= minMs + 800)
      ) {
        finishedRef.current = true;
        setProgress(1);
        setDone(true);
        // Small beat so user sees 100% / GO, then enter match
        window.setTimeout(() => {
          onFinishedRef.current?.();
        }, 220);
        return; // stop rAF loop
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [engineReady, minMs, started]);

  const pct = Math.min(100, Math.round(progress * 100));

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col overflow-hidden bg-[#07090e] text-white"
      role="status"
      aria-live="polite"
      aria-busy={!done}
      aria-label="Carregando partida"
    >
      {/* Atmosphere — keep cinematic art direction */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,#3b1a08_0%,transparent_55%),radial-gradient(ellipse_at_80%_100%,#0a2038_0%,transparent_50%),linear-gradient(180deg,#0c1018_0%,#05070a_100%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.04)_2px,rgba(255,255,255,0.04)_3px)]" />
        {/* Scan line */}
        <div className="absolute inset-x-0 top-0 h-px animate-pulse bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
        {/* Vignette */}
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.85)]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        {/* Brand mark */}
        <div className="mb-2 text-[10px] font-bold tracking-[0.55em] text-amber-500/90">
          TÁTICO · MULTIPLAYER · TOP-DOWN
        </div>
        <h1 className="text-center text-4xl font-black tracking-tight sm:text-6xl">
          <span className="bg-gradient-to-br from-amber-200 via-amber-400 to-orange-600 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(245,158,11,0.35)]">
            {GAME_NAME}
          </span>
        </h1>
        <p className="mt-3 max-w-md text-center text-sm text-white/45">
          {roomCode
            ? `Sala ${roomCode} · sincronizando combate`
            : "Operação solo · bots no setor"}
        </p>

        {/* Intel cards */}
        <div className="mt-10 grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-3">
          <IntelCard label="MAPA" value={mapName} accent="amber" />
          <IntelCard label="OPERADOR" value={operatorName} accent="sky" />
          <IntelCard
            label="STATUS"
            value={phase.id === "ready" ? "GO" : "LOAD"}
            accent="emerald"
            className="col-span-2 sm:col-span-1"
          />
        </div>

        {/* Real progress bar + named stages */}
        <div className="mt-12 w-full max-w-md">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="font-medium tracking-wide text-white/55">
              {phase.label}
            </span>
            <span className="font-mono tabular-nums text-amber-300/90">
              {pct}%
            </span>
          </div>
          <div
            className="relative h-1.5 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={phase.label}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-orange-300 shadow-[0_0_20px_rgba(245,158,11,0.55)] transition-[width] duration-150 ease-out"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute inset-y-0 w-8 bg-white/40 blur-sm"
              style={{ left: `calc(${pct}% - 1rem)` }}
            />
          </div>
          {/* Named stage ticks */}
          <div className="mt-3 flex justify-between gap-2 px-0.5">
            {LOADING_STEPS.filter((s) => s.id !== "ready").map((s) => {
              const active = progress >= s.at;
              return (
                <div
                  key={s.id}
                  className={`min-w-0 flex-1 text-center text-[9px] font-semibold tracking-wide ${
                    active ? "text-amber-300/90" : "text-white/25"
                  }`}
                >
                  <div
                    className={`mx-auto mb-1.5 h-1.5 w-1.5 rounded-full transition ${
                      active
                        ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                        : "bg-white/15"
                    }`}
                    aria-hidden
                  />
                  <span className="block truncate">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Single tactical tip line */}
        <p className="mt-8 max-w-md text-center text-xs leading-relaxed text-white/40">
          <span className="mr-1.5 text-[10px] font-bold tracking-[0.2em] text-amber-500/70">
            DICA
          </span>
          {tip}
        </p>

        <p className="mt-6 font-mono text-[10px] tracking-[0.25em] text-white/25">
          FRIEND FIRE // LOADING PROTOCOL
        </p>
      </div>
    </div>
  );
}

function IntelCard({
  label,
  value,
  accent,
  className = "",
}: {
  label: string;
  value: string;
  accent: "amber" | "sky" | "emerald";
  className?: string;
}) {
  const ring =
    accent === "amber"
      ? "border-amber-500/25"
      : accent === "sky"
        ? "border-sky-500/25"
        : "border-emerald-500/25";
  const lab =
    accent === "amber"
      ? "text-amber-400/80"
      : accent === "sky"
        ? "text-sky-400/80"
        : "text-emerald-400/80";
  return (
    <div
      className={`rounded-xl border bg-black/40 px-3 py-2.5 backdrop-blur-sm ${ring} ${className}`}
    >
      <div className={`text-[9px] font-bold tracking-[0.28em] ${lab}`}>
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-white/90">
        {value}
      </div>
    </div>
  );
}

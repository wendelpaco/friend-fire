"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { HudSnapshot } from "@/game/types";
import { GameHud } from "./GameHud";

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<import("@/game/engine/GameEngine").GameEngine | null>(
    null,
  );
  const router = useRouter();
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const onMatchContinue = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
    router.push("/");
  }, [router]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let disposed = false;

    const boot = async () => {
      try {
        const { GameEngine } = await import("@/game/engine/GameEngine");
        if (disposed) return;

        const engine = new GameEngine(canvas);
        engineRef.current = engine;
        engine.setHudListener((snapshot) => setHud(snapshot));

        const resize = () => {
          if (!engineRef.current || !container) return;
          engineRef.current.resize(
            container.clientWidth,
            container.clientHeight,
          );
        };
        resize();
        window.addEventListener("resize", resize);
        engine.start();
        setLoading(false);

        return () => window.removeEventListener("resize", resize);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Falha ao iniciar o jogo");
        setLoading(false);
      }
    };

    let cleanupResize: (() => void) | undefined;
    boot().then((fn) => {
      cleanupResize = fn;
    });

    return () => {
      disposed = true;
      cleanupResize?.();
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#0a0c10]"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-crosshair"
        tabIndex={0}
      />
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0a0c10]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400" />
          <p className="text-sm tracking-wide text-white/50">
            Carregando arena…
          </p>
        </div>
      )}
      {hud && (
        <GameHud
          hud={hud}
          onResume={() => engineRef.current?.setPaused(false)}
          onDismissHelp={() => engineRef.current?.dismissHelp()}
          onOpenHelp={() => engineRef.current?.openHelp()}
          onMatchContinue={onMatchContinue}
        />
      )}
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}

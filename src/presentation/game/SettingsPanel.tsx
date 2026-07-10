"use client";

import { useCallback, useState } from "react";
import type { GraphicsQuality } from "@/domains/prefs";
import { DEBUG_OVERLAYS } from "@/game/constants";

export type CameraDefault = "locked" | "free";

export type GamePrefs = {
  /** 0–100 → localStorage `ff_volume` */
  volume: number;
  /** localStorage `ff_fog_enabled` (default true) */
  fogEnabled: boolean;
  /** localStorage `ff_camera_default` */
  cameraDefault: CameraDefault;
  /** localStorage `ff_graphics_quality` (default medium) — ceiling for auto */
  graphicsQuality: GraphicsQuality;
  /** localStorage `ff_auto_quality` (default true) */
  autoQuality: boolean;
  /** localStorage `ff_show_fps` (default false) */
  showFps: boolean;
  /** localStorage `ff_high_contrast` (default false) — colorblind-friendly team colors */
  highContrast: boolean;
};

export const PREFS_EVENT = "ff-prefs";

const VOLUME_KEY = "ff_volume";
const FOG_KEY = "ff_fog_enabled";
const CAMERA_KEY = "ff_camera_default";
const QUALITY_KEY = "ff_graphics_quality";
const AUTO_QUALITY_KEY = "ff_auto_quality";
const FPS_KEY = "ff_show_fps";
const HIGH_CONTRAST_KEY = "ff_high_contrast";

function clampVolume(n: number): number {
  if (!Number.isFinite(n)) return 70;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseQuality(raw: string | null): GraphicsQuality {
  if (raw === "low" || raw === "high" || raw === "medium") return raw;
  return "medium";
}

function parseBool(raw: string | null, defaultValue: boolean): boolean {
  if (raw == null) return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return defaultValue;
}

export function readGamePrefs(): GamePrefs {
  if (typeof window === "undefined") {
    return {
      volume: 70,
      fogEnabled: true,
      cameraDefault: "locked",
      graphicsQuality: "medium",
      autoQuality: true,
      showFps: false,
      highContrast: false,
    };
  }
  try {
    const volume = clampVolume(Number(localStorage.getItem(VOLUME_KEY) ?? "70"));
    const fogRaw = localStorage.getItem(FOG_KEY);
    const fogEnabled = fogRaw == null ? true : fogRaw !== "0" && fogRaw !== "false";
    const camRaw = localStorage.getItem(CAMERA_KEY);
    const cameraDefault: CameraDefault =
      camRaw === "free" ? "free" : "locked";
    const graphicsQuality = parseQuality(localStorage.getItem(QUALITY_KEY));
    const autoQuality = parseBool(localStorage.getItem(AUTO_QUALITY_KEY), true);
    const showFps = parseBool(localStorage.getItem(FPS_KEY), false);
    const highContrast = parseBool(localStorage.getItem(HIGH_CONTRAST_KEY), false);
    return {
      volume,
      fogEnabled,
      cameraDefault,
      graphicsQuality,
      autoQuality,
      showFps,
      highContrast,
    };
  } catch {
    return {
      volume: 70,
      fogEnabled: true,
      cameraDefault: "locked",
      graphicsQuality: "medium",
      autoQuality: true,
      showFps: false,
      highContrast: false,
    };
  }
}

export function persistGamePrefs(prefs: GamePrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VOLUME_KEY, String(clampVolume(prefs.volume)));
    localStorage.setItem(FOG_KEY, prefs.fogEnabled ? "1" : "0");
    localStorage.setItem(CAMERA_KEY, prefs.cameraDefault);
    localStorage.setItem(QUALITY_KEY, prefs.graphicsQuality);
    localStorage.setItem(
      AUTO_QUALITY_KEY,
      prefs.autoQuality ? "true" : "false",
    );
    localStorage.setItem(FPS_KEY, prefs.showFps ? "true" : "false");
    localStorage.setItem(HIGH_CONTRAST_KEY, prefs.highContrast ? "true" : "false");
  } catch {
    /* private mode / quota */
  }
}

/** Notify renderer / GameClient of pref changes (custom event + optional window hook). */
export function dispatchPrefs(prefs: GamePrefs): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: prefs }));
  const w = window as Window & { __ffOnPrefs?: (p: GamePrefs) => void };
  if (typeof w.__ffOnPrefs === "function") {
    try {
      w.__ffOnPrefs(prefs);
    } catch {
      /* ignore consumer errors */
    }
  }
}

export function writeGamePrefs(partial: Partial<GamePrefs>): GamePrefs {
  const next = { ...readGamePrefs(), ...partial };
  next.volume = clampVolume(next.volume);
  next.cameraDefault = next.cameraDefault === "free" ? "free" : "locked";
  next.graphicsQuality = parseQuality(next.graphicsQuality);
  next.autoQuality = Boolean(next.autoQuality);
  next.showFps = Boolean(next.showFps);
  next.highContrast = Boolean(next.highContrast);
  persistGamePrefs(next);
  dispatchPrefs(next);
  return next;
}

interface SettingsPanelProps {
  onBack: () => void;
}

export function SettingsPanel({ onBack }: SettingsPanelProps) {
  const [prefs, setPrefs] = useState<GamePrefs>(() => readGamePrefs());

  const apply = useCallback((partial: Partial<GamePrefs>) => {
    setPrefs(writeGamePrefs(partial));
  }, []);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/12 bg-[#0e1118] p-6 shadow-2xl">
      <div className="mb-1 text-center text-[10px] font-semibold tracking-[0.3em] text-white/40">
        CONFIGURAÇÕES
      </div>
      <h2 className="mb-5 text-center text-2xl font-black">Ajustes</h2>

      <div className="flex flex-col gap-5">
        <label className="block">
          <div className="mb-2 flex items-center justify-between text-xs text-white/55">
            <span>Volume</span>
            <span className="tabular-nums text-white/80">{prefs.volume}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={prefs.volume}
            aria-label="Volume"
            onChange={(e) => apply({ volume: Number(e.target.value) })}
            className="h-1.5 w-full cursor-pointer accent-amber-500"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
          <span className="text-sm font-semibold text-white/85">
            Visão limitada (fog)
          </span>
          <input
            type="checkbox"
            checked={prefs.fogEnabled}
            aria-label="Visão limitada (fog)"
            onChange={(e) => apply({ fogEnabled: e.target.checked })}
            className="h-4 w-4 accent-amber-500"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
          <div className="min-w-0">
            <span className="text-sm font-semibold text-white/85">
              Alto contraste (daltônico)
            </span>
            <p className="mt-0.5 text-[10px] leading-snug text-white/40">
              Cores de time mais intensas e distintas.
            </p>
          </div>
          <input
            type="checkbox"
            checked={prefs.highContrast}
            aria-label="Alto contraste"
            onChange={(e) => {
              apply({ highContrast: e.target.checked });
              if (typeof document !== "undefined") {
                if (e.target.checked) {
                  document.documentElement.setAttribute("data-ff-high-contrast", "true");
                } else {
                  document.documentElement.removeAttribute("data-ff-high-contrast");
                }
              }
            }}
            className="h-4 w-4 shrink-0 accent-amber-500"
          />
        </label>

        <label className="block">
          <div className="mb-2 text-xs text-white/55">Câmera padrão</div>
          <select
            value={prefs.cameraDefault}
            aria-label="Câmera padrão"
            onChange={(e) =>
              apply({
                cameraDefault:
                  e.target.value === "free" ? "free" : "locked",
              })
            }
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm font-semibold text-white/90 outline-none focus:border-amber-500/50"
          >
            <option value="locked">Travada (seguir jogador)</option>
            <option value="free">Livre (pan com WASD)</option>
          </select>
        </label>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
          <div className="mb-3 text-[10px] font-semibold tracking-[0.2em] text-white/40">
            DESEMPENHO
          </div>

          <label className="block">
            <div className="mb-2 text-xs text-white/55">
              Qualidade gráfica (limite)
            </div>
            <select
              value={prefs.graphicsQuality}
              aria-label="Qualidade gráfica"
              onChange={(e) =>
                apply({
                  graphicsQuality: parseQuality(e.target.value),
                })
              }
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm font-semibold text-white/90 outline-none focus:border-amber-500/50"
            >
              <option value="low">Baixa (mais FPS)</option>
              <option value="medium">Média (recomendado)</option>
              <option value="high">Alta (sombras soft + poeira)</option>
            </select>
            <p className="mt-1.5 text-[10px] leading-snug text-white/40">
              Limite máximo; com Auto ligado o jogo pode baixar efeitos para
              manter FPS.
            </p>
          </label>

          <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
            <div>
              <span className="text-sm font-semibold text-white/85">
                Qualidade automática
              </span>
              <p className="mt-0.5 text-[10px] leading-snug text-white/40">
                {prefs.autoQuality
                  ? "Ajusta sombras, nitidez e efeitos para manter o jogo fluido."
                  : "Usa exatamente o preset da qualidade escolhida."}
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.autoQuality}
              aria-label="Qualidade automática"
              onChange={(e) => apply({ autoQuality: e.target.checked })}
              className="h-4 w-4 shrink-0 accent-amber-500"
            />
          </label>

          {/* Advanced debug overlays: compile-time gated out of production builds. */}
          {DEBUG_OVERLAYS && (
            <>
              <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                <div className="min-w-0">
                  <span className="block text-sm font-semibold text-white/85">
                    Overlay avançado de FPS
                  </span>
                  <span className="mt-0.5 block text-[11px] text-white/45">
                    Mini contador sempre visível. Liga p50/gpu/draws e tier.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.showFps}
                  aria-label="Overlay avançado de FPS"
                  onChange={(e) => apply({ showFps: e.target.checked })}
                  className="h-4 w-4 shrink-0 accent-amber-500"
                />
              </label>

              <button
                type="button"
                className="mt-3 w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-100/95 transition hover:bg-emerald-500/20"
                onClick={() => {
                  if (typeof window === "undefined") return;
                  window.dispatchEvent(new CustomEvent("ff-export-perf"));
                }}
              >
                Exportar sessão de performance (JSON)
              </button>
              <p className="mt-1.5 text-[10px] leading-snug text-white/40">
                Baixa p50/p95 e SLOs Reference/Floor/Ceiling para QA. Ver{" "}
                <span className="text-white/55">docs/performance-measurement.md</span>
                .
              </p>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-6 w-full rounded-lg border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
      >
        Voltar
      </button>
    </div>
  );
}

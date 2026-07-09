/**
 * Default camera mode preference (localStorage).
 * Key: ff_camera_default — "locked" | "free" (default locked).
 */

import { getLocal, setLocal } from "@/infrastructure/storage/local";
import type { CameraDefault } from "./types";

export const CAMERA_DEFAULT_KEY = "ff_camera_default";
export const DEFAULT_CAMERA: CameraDefault = "locked";

function parseCameraDefault(raw: string | null): CameraDefault {
  if (raw == null) return DEFAULT_CAMERA;
  const v = raw.trim().toLowerCase();
  if (v === "free") return "free";
  if (v === "locked") return "locked";
  return DEFAULT_CAMERA;
}

/** Read camera default; falls back to locked when missing/invalid. */
export function getCameraDefault(): CameraDefault {
  return parseCameraDefault(getLocal(CAMERA_DEFAULT_KEY));
}

/** Persist camera default (`locked` | `free`). */
export function setCameraDefault(mode: CameraDefault): void {
  if (mode !== "locked" && mode !== "free") return;
  setLocal(CAMERA_DEFAULT_KEY, mode);
}

/**
 * Operator + skin prefs (localStorage).
 * Keys: ff_operator_id, ff_skin_id
 */

import {
  DEFAULT_OPERATOR_ID,
  getOperator,
  getSkin,
  OPERATORS,
  skinsForOperator,
} from "./catalog";
import type { OperatorLoadoutPrefs } from "./types";

export const OPERATOR_ID_KEY = "ff_operator_id";
export const SKIN_ID_KEY = "ff_skin_id";

/** In-process fallback when localStorage is unavailable. */
let memoryOperatorId: string | null = null;
let memorySkinId: string | null = null;

/**
 * Cached snapshot for React useSyncExternalStore — getSnapshot must return
 * the same object reference when operator/skin ids are unchanged.
 */
let prefsSnapshot: OperatorLoadoutPrefs | null = null;

function defaultPrefs(): OperatorLoadoutPrefs {
  const op =
    OPERATORS.find((o) => o.id === DEFAULT_OPERATOR_ID) ?? OPERATORS[0]!;
  return {
    operatorId: op.id,
    skinId: op.defaultSkinId,
  };
}

function sanitizePrefs(
  operatorId: string | null | undefined,
  skinId: string | null | undefined,
): OperatorLoadoutPrefs {
  const defaults = defaultPrefs();
  const op = getOperator(operatorId) ?? getOperator(defaults.operatorId)!;
  const skins = skinsForOperator(op.id);
  const skin =
    (skinId && getSkin(skinId)?.operatorId === op.id
      ? getSkin(skinId)
      : undefined) ??
    getSkin(op.defaultSkinId) ??
    skins[0]!;
  return {
    operatorId: op.id,
    skinId: skin.id,
  };
}

function rememberSnapshot(next: OperatorLoadoutPrefs): OperatorLoadoutPrefs {
  if (
    prefsSnapshot &&
    prefsSnapshot.operatorId === next.operatorId &&
    prefsSnapshot.skinId === next.skinId
  ) {
    return prefsSnapshot;
  }
  prefsSnapshot = next;
  return prefsSnapshot;
}

export function getOperatorPrefs(): OperatorLoadoutPrefs {
  if (typeof window === "undefined") {
    return rememberSnapshot(sanitizePrefs(memoryOperatorId, memorySkinId));
  }
  try {
    // Prefer localStorage; memory only when storage throws (private mode).
    return rememberSnapshot(
      sanitizePrefs(
        localStorage.getItem(OPERATOR_ID_KEY),
        localStorage.getItem(SKIN_ID_KEY),
      ),
    );
  } catch {
    return rememberSnapshot(sanitizePrefs(memoryOperatorId, memorySkinId));
  }
}

export function setOperatorPrefs(prefs: OperatorLoadoutPrefs): OperatorLoadoutPrefs {
  const next = sanitizePrefs(prefs.operatorId, prefs.skinId);
  memoryOperatorId = next.operatorId;
  memorySkinId = next.skinId;
  prefsSnapshot = next;
  if (typeof window === "undefined") return next;
  try {
    localStorage.setItem(OPERATOR_ID_KEY, next.operatorId);
    localStorage.setItem(SKIN_ID_KEY, next.skinId);
  } catch {
    /* ignore quota / private mode */
  }
  return next;
}

/** True when both keys exist and resolve to a valid catalog pair. */
export function hasOperatorPrefs(): boolean {
  if (typeof window === "undefined") {
    return memoryOperatorId != null && memorySkinId != null;
  }
  try {
    const op = localStorage.getItem(OPERATOR_ID_KEY);
    const skin = localStorage.getItem(SKIN_ID_KEY);
    if (!op || !skin) return false;
    const o = getOperator(op);
    const s = getSkin(skin);
    return Boolean(o && s && s.operatorId === o.id);
  } catch {
    return memoryOperatorId != null && memorySkinId != null;
  }
}

/** Parse raw strings into valid prefs (for tests / SSR). */
export function parseOperatorPrefs(
  operatorId: string | null | undefined,
  skinId: string | null | undefined,
): OperatorLoadoutPrefs {
  return sanitizePrefs(operatorId, skinId);
}

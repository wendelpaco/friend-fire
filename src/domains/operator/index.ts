export type {
  GenderPresentation,
  OperatorDef,
  OperatorLoadoutPrefs,
  SkinDef,
  SkinRarity,
} from "./types";

/** Alias used by OperatorSelect UI. */
export type OperatorId = string;

export {
  DEFAULT_OPERATOR_ID,
  OPERATORS,
  SKINS,
  getOperator,
  getSkin,
  operatorsByGender,
  resolveSkinColors,
  skinsForOperator,
} from "./catalog";

// UI-friendly aliases (Meta-1 parallel worktree API)
export {
  getOperator as getOperatorById,
  getSkin as getSkinById,
  skinsForOperator as listSkinsForOperator,
} from "./catalog";

import { OPERATORS } from "./catalog";
import type { OperatorLoadoutPrefs } from "./types";

/** Stable list reference for React memo deps. */
const OPERATORS_LIST = [...OPERATORS];

export function listOperators() {
  return OPERATORS_LIST;
}

/** Stable default prefs (useSyncExternalStore / SSR getServerSnapshot safe). */
const DEFAULT_PREFS: OperatorLoadoutPrefs = (() => {
  const op = OPERATORS.find((o) => o.id === "brick") ?? OPERATORS[0]!;
  return { operatorId: op.id, skinId: op.defaultSkinId };
})();

export function defaultOperatorPrefs(): OperatorLoadoutPrefs {
  return DEFAULT_PREFS;
}

export {
  OPERATOR_ID_KEY,
  SKIN_ID_KEY,
  getOperatorPrefs,
  setOperatorPrefs,
  hasOperatorPrefs,
  parseOperatorPrefs,
} from "./prefs";

export {
  DEFAULT_PLAY_NEXT,
  operatorSelectHref,
  resolveOperatorNext,
  sanitizeNextPath,
} from "./paths";

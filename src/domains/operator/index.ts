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

export function listOperators() {
  return [...OPERATORS];
}

export function defaultOperatorPrefs() {
  const op = OPERATORS.find((o) => o.id === "brick") ?? OPERATORS[0]!;
  return { operatorId: op.id, skinId: op.defaultSkinId };
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

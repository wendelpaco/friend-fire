export type {
  GenderPresentation,
  OperatorDef,
  OperatorLoadoutPrefs,
  SkinDef,
  SkinRarity,
} from "./types";

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

export {
  OPERATOR_ID_KEY,
  SKIN_ID_KEY,
  getOperatorPrefs,
  setOperatorPrefs,
} from "./prefs";

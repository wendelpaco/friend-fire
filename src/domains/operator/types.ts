/** Masc / fem presentation for operator roster (not gameplay stats). */
export type GenderPresentation = "masc" | "fem";

export type SkinRarity = "common" | "rare" | "epic";

export type OperatorDef = {
  id: string;
  name: string;
  gender: GenderPresentation;
  blurb: string;
  defaultSkinId: string;
};

export type SkinDef = {
  id: string;
  operatorId: string;
  name: string;
  rarity: SkinRarity;
  /** Three.js accent tint (vest / pads / helmet stripe). */
  primaryColor: number;
  /** Three.js fatigues tint. */
  secondaryColor: number;
  /** CSS gradient for 2D operator cards. */
  previewGradient: string;
};

export type OperatorLoadoutPrefs = {
  operatorId: string;
  skinId: string;
};

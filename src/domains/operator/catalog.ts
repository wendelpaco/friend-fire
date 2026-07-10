/**
 * v1 operator roster: 4 operators × 2 free skins.
 * Colors are Three.js hex ints; previewGradient for UI cards.
 */

import type { OperatorDef, SkinDef } from "./types";

export const OPERATORS: readonly OperatorDef[] = [
  {
    id: "brick",
    name: "Brick",
    gender: "masc",
    blurb: "Heavy CT-ish anchor. Holds angles, soaks pressure.",
    defaultSkinId: "brick-default",
  },
  {
    id: "rook",
    name: "Rook",
    gender: "masc",
    blurb: "TR street entry. Aggressive mid-control energy.",
    defaultSkinId: "rook-default",
  },
  {
    id: "vesper",
    name: "Vesper",
    gender: "fem",
    blurb: "Precision opener. Quiet feet, loud AWP dreams.",
    defaultSkinId: "vesper-default",
  },
  {
    id: "nyx",
    name: "Nyx",
    gender: "fem",
    blurb: "Shadow eco specialist. Low profile, high impact.",
    defaultSkinId: "nyx-default",
  },
] as const;

export const SKINS: readonly SkinDef[] = [
  // Brick
  {
    id: "brick-default",
    operatorId: "brick",
    name: "Default",
    rarity: "common",
    primaryColor: 0x3a6ea5,
    secondaryColor: 0x3a4230,
    previewGradient: "linear-gradient(135deg, #3a6ea5 0%, #3a4230 100%)",
  },
  {
    id: "brick-alt",
    operatorId: "brick",
    name: "Steel Shift",
    rarity: "common",
    primaryColor: 0x5a8ab8,
    secondaryColor: 0x2a3540,
    previewGradient: "linear-gradient(135deg, #5a8ab8 0%, #2a3540 100%)",
  },
  // Rook
  {
    id: "rook-default",
    operatorId: "rook",
    name: "Default",
    rarity: "common",
    primaryColor: 0xc45c26,
    secondaryColor: 0x3a3228,
    previewGradient: "linear-gradient(135deg, #c45c26 0%, #3a3228 100%)",
  },
  {
    id: "rook-alt",
    operatorId: "rook",
    name: "Ash Trail",
    rarity: "common",
    primaryColor: 0xe07840,
    secondaryColor: 0x2a2018,
    previewGradient: "linear-gradient(135deg, #e07840 0%, #2a2018 100%)",
  },
  // Vesper
  {
    id: "vesper-default",
    operatorId: "vesper",
    name: "Default",
    rarity: "common",
    primaryColor: 0x8b5cf6,
    secondaryColor: 0x2a2838,
    previewGradient: "linear-gradient(135deg, #8b5cf6 0%, #2a2838 100%)",
  },
  {
    id: "vesper-alt",
    operatorId: "vesper",
    name: "Lilac Edge",
    rarity: "common",
    primaryColor: 0xc4b5fd,
    secondaryColor: 0x3a3048,
    previewGradient: "linear-gradient(135deg, #c4b5fd 0%, #3a3048 100%)",
  },
  // Nyx
  {
    id: "nyx-default",
    operatorId: "nyx",
    name: "Default",
    rarity: "common",
    primaryColor: 0x2a2a32,
    secondaryColor: 0x141418,
    previewGradient: "linear-gradient(135deg, #2a2a32 0%, #141418 100%)",
  },
  {
    id: "nyx-alt",
    operatorId: "nyx",
    name: "Slate Ghost",
    rarity: "common",
    primaryColor: 0x4a5568,
    secondaryColor: 0x1e2430,
    previewGradient: "linear-gradient(135deg, #4a5568 0%, #1e2430 100%)",
  },
] as const;

/** First masc operator — default prefs target. */
export const DEFAULT_OPERATOR_ID = "brick";

export function getOperator(id: string | null | undefined): OperatorDef | undefined {
  if (!id) return undefined;
  return OPERATORS.find((o) => o.id === id);
}

export function getSkin(id: string | null | undefined): SkinDef | undefined {
  if (!id) return undefined;
  return SKINS.find((s) => s.id === id);
}

export function skinsForOperator(operatorId: string): SkinDef[] {
  return SKINS.filter((s) => s.operatorId === operatorId);
}

export function operatorsByGender(
  gender: OperatorDef["gender"] | "all",
): OperatorDef[] {
  if (gender === "all") return [...OPERATORS];
  return OPERATORS.filter((o) => o.gender === gender);
}

/**
 * Resolve skin tints from optional network / prefs ids.
 * Falls back to operator default skin, then first catalog skin.
 */
export function resolveSkinColors(
  operatorId?: string | null,
  skinId?: string | null,
): { primaryColor: number; secondaryColor: number } | null {
  const bySkin = getSkin(skinId);
  if (bySkin) {
    return {
      primaryColor: bySkin.primaryColor,
      secondaryColor: bySkin.secondaryColor,
    };
  }
  const op = getOperator(operatorId);
  if (op) {
    const def = getSkin(op.defaultSkinId);
    if (def) {
      return {
        primaryColor: def.primaryColor,
        secondaryColor: def.secondaryColor,
      };
    }
  }
  return null;
}

/**
 * Armor formula (preserved from GameEngine):
 * armor absorbs min(armor, dmg * 0.5), then dmg -= absorbed * 0.5, then hp -= dmg.
 *
 * `armorPen` (0–1): scales how much of that soak reduces HP.
 * - 0 (default): classic half soak
 * - 1: full pen — HP takes full damage; armor still chips (AWP §4.4)
 */
export function applyDamage(
  target: { hp: number; armor: number },
  damage: number,
  opts?: { armorPen?: number },
): { hp: number; armor: number; absorbed: number } {
  let dmg = damage;
  let armor = target.armor;
  let hp = target.hp;
  let absorbed = 0;
  const armorPen = Math.max(0, Math.min(1, opts?.armorPen ?? 0));

  if (armor > 0) {
    absorbed = Math.min(armor, dmg * 0.5);
    armor -= absorbed;
    dmg -= absorbed * 0.5 * (1 - armorPen);
  }

  hp -= dmg;
  return { hp, armor, absorbed };
}

export function isDead(hp: number): boolean {
  return hp <= 0;
}
